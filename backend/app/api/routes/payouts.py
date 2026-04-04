"""
Payout routes — UPI / IMPS / Razorpay sandbox simulation.

Endpoints:
  POST /payouts/{claim_id}/initiate   → Step 1: initiate transfer
  POST /payouts/{claim_id}/confirm    → Step 2: confirm / simulate webhook
  POST /payouts/{claim_id}/rollback   → Manual rollback on failure
  GET  /payouts/{claim_id}/status     → Check current payout state
  POST /payouts/bulk-initiate         → Initiate payouts for all approved claims
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_rider
from app.models.models import Claim, ClaimStatus, PayoutStatus, Rider, Policy, TriggerType
from app.services.payout.payout_service import (
    initiate_payout, confirm_payout, rollback_payout, payout_status_check,
    auto_payout_all,
)
import random
from datetime import datetime, timezone



router = APIRouter()


@router.post("/{claim_id}/initiate")
async def initiate(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """Initiate payout for an approved claim. Selects best channel (UPI preferred)."""
    # Verify ownership
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.rider_id != current_rider.id:
        raise HTTPException(status_code=403, detail="Not your claim")

    response = await initiate_payout(claim_id, db)
    await db.commit()

    if not response.get("success"):
        raise HTTPException(status_code=400, detail=response.get("error", "Payout initiation failed"))
    return response


@router.post("/{claim_id}/confirm")
async def confirm(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """
    Simulate payout confirmation (sandbox mode).
    In production, this is triggered by Razorpay/NPCI webhook.
    96%+ success rate — failures auto-rollback.
    """
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.rider_id != current_rider.id:
        raise HTTPException(status_code=403, detail="Not your claim")

    response = await confirm_payout(claim_id, db)
    await db.commit()
    return response


@router.post("/{claim_id}/rollback")
async def rollback(
    claim_id: int,
    reason: str = Query(default="Manual rollback requested"),
    db: AsyncSession = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """Manually rollback a failed payout. Resets claim to APPROVED for retry."""
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.rider_id != current_rider.id:
        raise HTTPException(status_code=403, detail="Not your claim")

    response = await rollback_payout(claim_id, db, reason)
    await db.commit()
    return response


@router.get("/{claim_id}/status")
async def status(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """Get current payout status, channel, reference ID, and timestamps."""
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.rider_id != current_rider.id:
        raise HTTPException(status_code=403, detail="Not your claim")

    return await payout_status_check(claim_id, db)


@router.post("/bulk-initiate")
async def bulk_initiate(
    db: AsyncSession = Depends(get_db),
):
    """
    Admin endpoint — initiate payouts for all auto-approved/approved claims
    that haven't been paid yet. Used after a trigger event.
    """
    result = await db.execute(
        select(Claim).where(
            Claim.status.in_([ClaimStatus.AUTO_APPROVED, ClaimStatus.APPROVED]),
            Claim.payout_status == PayoutStatus.NOT_INITIATED,
            Claim.payout_amount > 0,
        )
    )
    claims = result.scalars().all()

    initiated = []
    failed = []
    for claim in claims:
        resp = await initiate_payout(claim.id, db)
        if resp.get("success"):
            initiated.append({"claim_id": claim.id, "ref": resp["payout_ref"], "amount": resp["amount"]})
        else:
            failed.append({"claim_id": claim.id, "error": resp.get("error")})

    await db.commit()

    return {
        "total_claims": len(claims),
        "initiated": len(initiated),
        "failed": len(failed),
        "details": initiated,
        "errors": failed,
        "message": f"{len(initiated)} payouts initiated, {len(failed)} failed.",
    }


@router.post("/auto-disburse", summary="Instant auto-disburse all approved claims")
async def auto_disburse(db: AsyncSession = Depends(get_db)):
    """
    Demo endpoint: processes ALL approved/auto_approved claims instantly.
    Simulates the full payout lifecycle including failure recovery with
    UPI → IMPS channel fallback. No authentication required (admin/demo endpoint).
    """
    report = await auto_payout_all(db)
    await db.commit()
    return report


@router.get("/demo-summary", summary="Aggregate payout stats for demo dashboard")
async def demo_summary(db: AsyncSession = Depends(get_db)):
    """Returns aggregate payout stats across all claims for the demo dashboard."""
    from sqlalchemy import func as sa_func

    # Total paid
    paid_result = await db.execute(
        select(
            sa_func.count(Claim.id),
            sa_func.coalesce(sa_func.sum(Claim.payout_amount), 0),
        ).where(Claim.status == ClaimStatus.PAID)
    )
    paid_row = paid_result.one()
    total_paid_count = paid_row[0]
    total_paid_amount = round(float(paid_row[1]), 2)

    # Total failed
    failed_result = await db.execute(
        select(sa_func.count(Claim.id)).where(Claim.payout_status == PayoutStatus.FAILED)
    )
    total_failed = failed_result.scalar() or 0

    # Total pending (approved but not yet paid)
    pending_result = await db.execute(
        select(
            sa_func.count(Claim.id),
            sa_func.coalesce(sa_func.sum(Claim.payout_amount), 0),
        ).where(
            Claim.status.in_([ClaimStatus.AUTO_APPROVED, ClaimStatus.APPROVED]),
            Claim.payout_status.in_([PayoutStatus.NOT_INITIATED, PayoutStatus.ROLLED_BACK]),
            Claim.payout_amount > 0,
        )
    )
    pending_row = pending_result.one()
    total_pending_count = pending_row[0]
    total_pending_amount = round(float(pending_row[1]), 2)

    return {
        "total_paid_count": total_paid_count,
        "total_paid_amount": total_paid_amount,
        "total_failed": total_failed,
        "total_pending_count": total_pending_count,
        "total_pending_amount": total_pending_amount,
        "recovery_rate": round(
            (total_paid_count / (total_paid_count + total_failed) * 100), 1
        ) if (total_paid_count + total_failed) > 0 else 100.0,
    }


@router.post("/seed-demo", summary="Seed 25 approved claims for demo purposes")
async def seed_demo(db: AsyncSession = Depends(get_db)):
    """Creates 25 approved claims for riders with active policies."""
    # Find 25 riders with active policies
    riders_result = await db.execute(
        select(Rider)
        .join(Policy, Rider.id == Policy.rider_id)
        .where(Policy.status == "ACTIVE")
        .limit(25)
    )
    riders = riders_result.scalars().all()
    
    count = 0
    for rider in riders:
        # Get policy
        pol_res = await db.execute(select(Policy).where(Policy.rider_id == rider.id).limit(1))
        policy = pol_res.scalar_one_or_none()
        if not policy: continue
        trigger_enum = random.choice(list(TriggerType))
        payout_val = 30.0
        if policy.coverage_triggers and trigger_enum.value in policy.coverage_triggers:
            payout_val = float(policy.coverage_triggers[trigger_enum.value])

        claim = Claim(
            rider_id=rider.id,
            policy_id=policy.id,
            trigger_type=trigger_enum,
            trigger_value=120.0,
            trigger_threshold=64.5,
            payout_amount=payout_val,
            status=ClaimStatus.APPROVED,
            payout_status=PayoutStatus.NOT_INITIATED,
            event_time=datetime.now(timezone.utc)
        )
        db.add(claim)
        count += 1
    
    await db.commit()
    return {"message": f"Seeded {count} claims for demo.", "count": count}



