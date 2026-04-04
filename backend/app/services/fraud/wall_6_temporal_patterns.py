"""Wall 6 — Temporal Pattern Analysis (0-15 pts). Claim frequency anomalies."""

from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Claim, Rider


async def check_temporal_patterns(db: AsyncSession, rider_id: int) -> dict:
    rider_result = await db.execute(select(Rider).where(Rider.id == rider_id))
    rider = rider_result.scalar_one_or_none()
    if not rider:
        return {"passed": True, "score": 0.0, "details": {"reason": "Rider not found"}}

    claims_result = await db.execute(
        select(Claim).where(Claim.rider_id == rider_id).order_by(Claim.event_time.desc())
    )
    rider_claims = claims_result.scalars().all()
    rider_claim_count = len(rider_claims)

    if rider_claim_count < 2:
        return {"passed": True, "score": 0.0, "details": {"reason": "Insufficient claim history", "rider_claims": rider_claim_count}}

    # Get zone average
    zone_riders_result = await db.execute(
        select(Rider).where(Rider.zone_id == rider.zone_id, Rider.is_active == True)
    )
    zone_riders = zone_riders_result.scalars().all()
    zone_rider_ids = [r.id for r in zone_riders]

    zone_claims_result = await db.execute(select(Claim).where(Claim.rider_id.in_(zone_rider_ids)))
    zone_claims = zone_claims_result.scalars().all()

    zone_claim_counts = defaultdict(int)
    for c in zone_claims:
        zone_claim_counts[c.rider_id] += 1

    avg_zone_claims = sum(zone_claim_counts.values()) / max(len(zone_claim_counts), 1)

    issues = []
    score = 0.0

    # Check 1: Claim frequency
    if avg_zone_claims > 0:
        claim_ratio = rider_claim_count / max(avg_zone_claims, 1)
        if claim_ratio > 3.0:
            score += 10.0
            issues.append(f"Claim frequency {claim_ratio:.1f}x zone average ({rider_claim_count} vs avg {avg_zone_claims:.1f})")
        elif claim_ratio > 2.0:
            score += 5.0
            issues.append(f"Claim frequency {claim_ratio:.1f}x zone average")

    # Check 2: Suspiciously identical payout amounts
    rider_amounts = [c.payout_amount for c in rider_claims if c.payout_amount > 0]
    if len(rider_amounts) >= 3:
        avg_amount = sum(rider_amounts) / len(rider_amounts)
        if avg_amount > 0:
            deviations = [abs(a - avg_amount) / avg_amount for a in rider_amounts]
            avg_deviation = sum(deviations) / len(deviations)
            if avg_deviation < 0.05:
                score += 5.0
                issues.append(f"Claim amounts suspiciously identical (avg deviation: {avg_deviation:.1%})")

    # Check 3: Too-frequent claims
    if len(rider_claims) >= 3:
        claim_gaps = []
        for i in range(1, len(rider_claims)):
            if rider_claims[i - 1].event_time and rider_claims[i].event_time:
                t1 = rider_claims[i - 1].event_time
                t2 = rider_claims[i].event_time
                # Normalize to naive to avoid offset-aware vs offset-naive errors
                if t1.tzinfo is not None:
                    t1 = t1.replace(tzinfo=None)
                if t2.tzinfo is not None:
                    t2 = t2.replace(tzinfo=None)
                gap = (t1 - t2).days
                claim_gaps.append(gap)
        if claim_gaps:
            avg_gap = sum(claim_gaps) / len(claim_gaps)
            if avg_gap < 2 and len(claim_gaps) >= 3:
                score += 3.0
                issues.append(f"Claims filed very frequently (avg gap: {avg_gap:.1f} days)")

    score = min(score, 15.0)
    return {"passed": score < 8.0, "score": round(score, 1), "details": {
        "rider_total_claims": rider_claim_count,
        "zone_avg_claims": round(avg_zone_claims, 1),
        "issues": issues,
    }}
