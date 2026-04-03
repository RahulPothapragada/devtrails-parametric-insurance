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
from app.models.models import Claim, ClaimStatus, PayoutStatus
from app.services.payout.payout_service import (
    initiate_payout, confirm_payout, rollback_payout, payout_status_check,
)

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
