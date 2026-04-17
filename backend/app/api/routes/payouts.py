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
from datetime import datetime, timedelta



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


@router.post("/{claim_id}/auto-disburse-single", summary="Parametric auto-payout for a single claim (UPI + IMPS fallback)")
async def auto_disburse_single(
    claim_id: int,
    db: AsyncSession = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """Single-claim parametric disbursal: UPI first, IMPS fallback. No rider clicks needed."""
    from app.services.payout.payout_service import auto_disburse_claim
    result_row = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result_row.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if claim.rider_id != current_rider.id:
        raise HTTPException(status_code=403, detail="Not your claim")
    result = await auto_disburse_claim(claim_id, db)
    await db.commit()
    return result


@router.post("/end-of-week", summary="End-of-week batch: pay all pending AUTO_APPROVED claims")
async def end_of_week_batch(db: AsyncSession = Depends(get_db)):
    """
    Parametric end-of-week settlement.
    Finds every AUTO_APPROVED claim with payout NOT_INITIATED and pays them all
    automatically via UPI (IMPS fallback). No rider action required.
    Called by a scheduled job in production (e.g. every Sunday midnight).
    """
    from app.services.payout.payout_service import auto_disburse_claim

    result = await db.execute(
        select(Claim).where(
            Claim.status.in_([ClaimStatus.AUTO_APPROVED, ClaimStatus.APPROVED]),
            Claim.payout_status.in_([PayoutStatus.NOT_INITIATED, PayoutStatus.ROLLED_BACK]),
            Claim.payout_amount > 0,
        )
    )
    pending = result.scalars().all()

    paid, failed, total_amount = 0, 0, 0.0
    transactions = []
    for claim in pending:
        txn = await auto_disburse_claim(claim.id, db)
        if txn.get("success"):
            paid += 1
            total_amount += txn.get("amount", 0)
        else:
            failed += 1
        transactions.append({
            "claim_id": claim.id,
            "rider_id": claim.rider_id,
            "amount": claim.payout_amount,
            "channel": txn.get("channel"),
            "ref": txn.get("ref"),
            "success": txn.get("success"),
            "message": txn.get("message"),
        })

    await db.commit()
    return {
        "batch": "end_of_week",
        "total_claims": len(pending),
        "paid": paid,
        "failed": failed,
        "total_disbursed": round(total_amount, 2),
        "success_rate": f"{round(paid / len(pending) * 100, 1)}%" if pending else "100%",
        "transactions": transactions[:50],  # cap response size
    }


@router.post("/auto-disburse", summary="Instant auto-disburse approved claims for current rider")
async def auto_disburse(
    db: AsyncSession = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """
    Parametric auto-disburse: processes all approved/auto_approved claims for
    the authenticated rider that haven't been paid yet.
    Called automatically by the frontend on Payouts page load.
    """
    from app.services.payout.payout_service import auto_disburse_claim

    result = await db.execute(
        select(Claim).where(
            Claim.rider_id == current_rider.id,
            Claim.status.in_([ClaimStatus.AUTO_APPROVED, ClaimStatus.APPROVED]),
            Claim.payout_status.in_([PayoutStatus.NOT_INITIATED, PayoutStatus.ROLLED_BACK]),
            Claim.payout_amount > 0,
        )
    )
    pending = result.scalars().all()

    succeeded, failed_then_recovered, permanently_failed, total_disbursed = 0, 0, 0, 0.0
    for claim in pending:
        txn = await auto_disburse_claim(claim.id, db)
        if txn.get("success"):
            if txn.get("attempts", 1) > 1:
                failed_then_recovered += 1
            else:
                succeeded += 1
            total_disbursed += txn.get("amount", 0)
        else:
            permanently_failed += 1

    await db.commit()
    return {
        "processed": len(pending),
        "succeeded": succeeded,
        "failed_then_recovered": failed_then_recovered,
        "permanently_failed": permanently_failed,
        "total_disbursed": round(total_disbursed, 2),
    }


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


@router.post("/seed-demo", summary="Seed demo claims across admin workflow statuses")
async def seed_demo(db: AsyncSession = Depends(get_db)):
    """Creates demo claims across paid, approved, pending review, flagged, denied, and auto-approved."""
    # Find 25 riders with active policies
    riders_result = await db.execute(
        select(Rider)
        .join(Policy, Rider.id == Policy.rider_id)
        .where(Policy.status == "ACTIVE")
        .limit(25)
    )
    riders = riders_result.scalars().all()

    claim_templates = [
        {"status": ClaimStatus.AUTO_APPROVED, "payout_status": PayoutStatus.NOT_INITIATED, "fraud_score": 12.0},
        {"status": ClaimStatus.APPROVED, "payout_status": PayoutStatus.NOT_INITIATED, "fraud_score": 28.0},
        {"status": ClaimStatus.PENDING_REVIEW, "payout_status": PayoutStatus.NOT_INITIATED, "fraud_score": 49.0},
        {"status": ClaimStatus.FLAGGED, "payout_status": PayoutStatus.NOT_INITIATED, "fraud_score": 58.0},
        {"status": ClaimStatus.DENIED, "payout_status": PayoutStatus.NOT_INITIATED, "fraud_score": 72.0},
        {"status": ClaimStatus.PAID, "payout_status": PayoutStatus.CONFIRMED, "fraud_score": 18.0},
    ]

    seeded_by_status: dict[str, int] = {}
    count = 0
    now = datetime.utcnow()
    for idx, rider in enumerate(riders):
        # Get policy
        pol_res = await db.execute(select(Policy).where(Policy.rider_id == rider.id).limit(1))
        policy = pol_res.scalar_one_or_none()
        if not policy:
            continue

        template = claim_templates[idx % len(claim_templates)]
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
            status=template["status"],
            payout_status=template["payout_status"],
            fraud_score=template["fraud_score"],
            event_time=now - timedelta(minutes=idx * 7),
        )
        db.add(claim)
        count += 1
        seeded_by_status[template["status"].value] = seeded_by_status.get(template["status"].value, 0) + 1

    await db.commit()
    return {
        "message": f"Seeded {count} demo claims across review states.",
        "count": count,
        "breakdown": seeded_by_status,
    }

