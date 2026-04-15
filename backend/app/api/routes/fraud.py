"""Fraud detection routes — check claim, stats."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.models import Claim, Rider, TriggerReading, FraudCheck
from app.schemas.schemas import FraudCheckOut
from app.services.fraud.fraud_engine import FraudEngine

router = APIRouter()
fraud_engine = FraudEngine()


@router.get("/check/{claim_id}", response_model=FraudCheckOut)
async def check_claim_fraud(claim_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    rider_result = await db.execute(select(Rider).where(Rider.id == claim.rider_id))
    rider = rider_result.scalar_one()

    # Get trigger reading if claim has one
    trigger_reading = None
    if claim.trigger_reading_id:
        tr_result = await db.execute(select(TriggerReading).where(TriggerReading.id == claim.trigger_reading_id))
        trigger_reading = tr_result.scalar_one_or_none()

    verdict = await fraud_engine.evaluate_claim(claim=claim, rider=rider, db=db, trigger_reading=trigger_reading)

    claim.fraud_score = verdict.total_score
    claim.fraud_walls_passed = [
        {"wall": w.wall_name, "passed": w.passed, "score": w.score, "reason": w.reason}
        for w in verdict.walls
    ]
    if verdict.auto_approve:
        claim.status = "auto_approved"
    elif verdict.total_score >= 60:
        claim.status = "flagged"
    await db.flush()

    return FraudCheckOut(
        claim_id=claim.id,
        fraud_score=verdict.total_score,
        classification=verdict.classification,
        walls=[
            {"wall": w.wall_name, "passed": w.passed, "score": w.score, "reason": w.reason}
            for w in verdict.walls
        ],
        auto_approved=verdict.auto_approve,
        processing_time=verdict.processing_time,
        ml_anomaly_score=verdict.ml_anomaly_score,
    )


@router.get("/stats")
async def fraud_stats(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(Claim.id)))).scalar() or 0
    flagged = (await db.execute(
        select(func.count(Claim.id)).where(Claim.status == "flagged")
    )).scalar() or 0
    auto_approved = (await db.execute(
        select(func.count(Claim.id)).where(Claim.status == "auto_approved")
    )).scalar() or 0
    return {
        "total_claims": total,
        "flagged": flagged,
        "auto_approved": auto_approved,
        "fraud_rate_pct": round(flagged / max(total, 1) * 100, 2),
    }


@router.get("/leaderboard")
async def fraud_leaderboard(limit: int = 20, db: AsyncSession = Depends(get_db)):
    """Aggregates fraud scores by rider to detect systematic abusers across multiple claims."""
    from sqlalchemy import desc as sql_desc

    stmt = (
        select(
            Claim.rider_id,
            Rider.phone,
            Rider.name,
            func.avg(Claim.fraud_score).label("avg_score"),
            func.count(Claim.id).label("total_claims"),
        )
        .join(Rider, Claim.rider_id == Rider.id)
        .group_by(Claim.rider_id, Rider.phone, Rider.name)
        .having(func.count(Claim.id) > 0)
        .order_by(sql_desc("avg_score"))
        .limit(limit)
    )

    result = await db.execute(stmt)
    records = result.all()

    def classify(score: float) -> str:
        if score < 20:
            return "Trusted"
        elif score < 40:
            return "Normal"
        elif score < 60:
            return "Watch"
        elif score < 80:
            return "Review"
        return "Block"

    return [
        {
            "rider_id": rider_id,
            "name": name,
            "phone": phone,
            "avg_fraud_score": round(float(avg_score), 2),
            "total_claims": total_claims,
            "classification": classify(float(avg_score)),
        }
        for rider_id, phone, name, avg_score, total_claims in records
    ]
