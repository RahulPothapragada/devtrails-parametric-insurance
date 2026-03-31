"""Wall 2 — Device Fingerprint Check (0-20 pts). Shared device / emulator detection."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Rider
from app.services.mock_platform import EMULATOR_SIGNATURES

THRESHOLDS = {"max_riders_per_device": 1}


async def check_device_fingerprint(db: AsyncSession, rider_id: int) -> dict:
    result = await db.execute(select(Rider).where(Rider.id == rider_id))
    rider = result.scalar_one_or_none()

    if not rider or not rider.device_fingerprint:
        return {"passed": False, "score": 10.0, "details": {"reason": "No device fingerprint on file", "issues": ["No fingerprint"]}}

    issues = []
    score = 0.0
    fp = rider.device_fingerprint

    if fp in EMULATOR_SIGNATURES:
        score += 15.0
        issues.append(f"Device matches known emulator: {fp}")

    shared_result = await db.execute(
        select(Rider).where(Rider.device_fingerprint == fp, Rider.id != rider_id)
    )
    shared_riders = shared_result.scalars().all()
    num_shared = len(shared_riders)

    if num_shared > 0:
        score += min(num_shared * 8.0, 20.0)
        issues.append(f"Device shared with {num_shared} other rider(s): {[r.id for r in shared_riders]}")

    score = min(score, 20.0)
    return {"passed": score < 10.0, "score": round(score, 1), "details": {
        "device_fingerprint": fp[:8] + "...",
        "is_emulator": fp in EMULATOR_SIGNATURES,
        "shared_with_count": num_shared,
        "issues": issues,
    }}
