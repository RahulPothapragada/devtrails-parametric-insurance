"""
Mock Payout Service — simulates UPI / IMPS / Razorpay sandbox payouts.

Flow:
  1. initiate_payout()  → status: INITIATED, ref ID generated
  2. process_payout()   → status: PROCESSING (async verification)
  3. confirm_payout()   → status: CONFIRMED + paid_at timestamp
  4. On failure        → rollback_payout() → status: ROLLED_BACK

In production this calls real Razorpay / NPCI APIs.
For demo / sandbox mode it simulates realistic delays and success/failure rates.
"""

import random
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Claim, Rider, ClaimStatus, PayoutStatus, PayoutChannel


# Sandbox success rates by channel
CHANNEL_SUCCESS_RATE = {
    PayoutChannel.UPI:      0.97,   # UPI near-instant, 97% success
    PayoutChannel.IMPS:     0.94,   # IMPS slightly lower
    PayoutChannel.RAZORPAY: 0.96,   # Razorpay sandbox
}

# Simulated processing time (seconds) — for display purposes
CHANNEL_PROCESSING_TIME = {
    PayoutChannel.UPI:      "< 30 seconds",
    PayoutChannel.IMPS:     "2–5 minutes",
    PayoutChannel.RAZORPAY: "< 1 minute",
}

FAILURE_REASONS = [
    "UPI handle not registered",
    "Bank account temporarily unavailable",
    "Daily transfer limit exceeded",
    "Invalid VPA (Virtual Payment Address)",
    "Beneficiary bank timeout",
]


def _select_channel(rider: Rider) -> PayoutChannel:
    """Choose best payout channel based on rider's available payment info."""
    if rider.upi_id and not rider.upi_id.startswith("fraud.pool"):
        return PayoutChannel.UPI
    return PayoutChannel.IMPS


def _generate_ref(channel: PayoutChannel) -> str:
    """Generate a realistic transaction reference ID."""
    uid = uuid.uuid4().hex[:12].upper()
    prefixes = {
        PayoutChannel.UPI:      "UPI",
        PayoutChannel.IMPS:     "IMPS",
        PayoutChannel.RAZORPAY: "RZP",
    }
    return f"{prefixes.get(channel, 'TXN')}{uid}"


async def initiate_payout(claim_id: int, db: AsyncSession) -> dict:
    """
    Step 1: Initiate payout for an approved claim.
    Returns immediately with INITIATED status and a reference ID.
    """
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        return {"success": False, "error": "Claim not found"}

    if claim.status not in [ClaimStatus.AUTO_APPROVED, ClaimStatus.APPROVED]:
        return {
            "success": False,
            "error": f"Cannot initiate payout — claim status is '{claim.status.value}'",
        }

    if claim.payout_status == PayoutStatus.CONFIRMED:
        return {"success": False, "error": "Payout already confirmed"}

    if claim.payout_amount <= 0:
        return {"success": False, "error": "Payout amount is zero — claim may be denied"}

    # Get rider for channel selection
    rider_result = await db.execute(select(Rider).where(Rider.id == claim.rider_id))
    rider = rider_result.scalar_one_or_none()
    channel = _select_channel(rider) if rider else PayoutChannel.IMPS

    ref = _generate_ref(channel)
    now = datetime.now(timezone.utc)

    claim.payout_status = PayoutStatus.INITIATED
    claim.payout_channel = channel
    claim.payout_ref = ref
    claim.payout_initiated_at = now
    claim.payout_failure_reason = None
    await db.flush()

    return {
        "success": True,
        "claim_id": claim_id,
        "payout_ref": ref,
        "channel": channel.value,
        "amount": claim.payout_amount,
        "upi_id": rider.upi_id if rider and channel == PayoutChannel.UPI else None,
        "payout_status": "initiated",
        "message": f"Payout of ₹{claim.payout_amount:.2f} initiated via {channel.value.upper()}",
        "expected_time": CHANNEL_PROCESSING_TIME[channel],
        "initiated_at": now.isoformat(),
    }


async def confirm_payout(claim_id: int, db: AsyncSession) -> dict:
    """
    Step 2: Simulate processing + confirmation.
    In sandbox: 96%+ succeed, rest fail with rollback.
    In production: webhook callback from Razorpay/NPCI triggers this.
    """
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        return {"success": False, "error": "Claim not found"}

    if claim.payout_status == PayoutStatus.CONFIRMED:
        return {
            "success": True,
            "already_confirmed": True,
            "payout_ref": claim.payout_ref,
            "confirmed_at": claim.payout_confirmed_at.isoformat() if claim.payout_confirmed_at else None,
        }

    if claim.payout_status not in [PayoutStatus.INITIATED, PayoutStatus.PROCESSING]:
        return {
            "success": False,
            "error": f"Payout not initiated. Current status: {claim.payout_status.value}",
        }

    channel = claim.payout_channel or PayoutChannel.UPI
    success_rate = CHANNEL_SUCCESS_RATE.get(channel, 0.95)
    now = datetime.now(timezone.utc)

    if random.random() < success_rate:
        # SUCCESS
        claim.payout_status = PayoutStatus.CONFIRMED
        claim.payout_confirmed_at = now
        claim.status = ClaimStatus.PAID
        claim.paid_at = now
        await db.flush()

        return {
            "success": True,
            "claim_id": claim_id,
            "payout_ref": claim.payout_ref,
            "channel": channel.value,
            "amount": claim.payout_amount,
            "payout_status": "confirmed",
            "claim_status": "paid",
            "confirmed_at": now.isoformat(),
            "message": (
                f"✓ ₹{claim.payout_amount:.2f} successfully credited via {channel.value.upper()}. "
                f"Ref: {claim.payout_ref}"
            ),
            "sms_sent": True,
            "sms_preview": f"Rs {claim.payout_amount:.0f} credited to your account. Ref: {claim.payout_ref}. -FlowSecure",
        }
    else:
        # FAILURE → rollback
        reason = random.choice(FAILURE_REASONS)
        claim.payout_status = PayoutStatus.FAILED
        claim.payout_failure_reason = reason
        await db.flush()

        # Attempt rollback
        rollback = await rollback_payout(claim_id, db, reason)
        return {
            "success": False,
            "claim_id": claim_id,
            "payout_status": "failed",
            "failure_reason": reason,
            "rollback": rollback,
            "message": f"Payout failed: {reason}. Rollback initiated.",
        }


async def rollback_payout(claim_id: int, db: AsyncSession, reason: str = "Manual rollback") -> dict:
    """
    Rollback a failed payout — resets claim to APPROVED so it can be retried.
    In production: triggers refund reversal if money was deducted.
    """
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        return {"success": False, "error": "Claim not found"}

    claim.payout_status = PayoutStatus.ROLLED_BACK
    claim.status = ClaimStatus.APPROVED  # Reset to approved so payout can be retried
    claim.payout_failure_reason = f"Rolled back: {reason}"
    await db.flush()

    return {
        "success": True,
        "claim_id": claim_id,
        "payout_status": "rolled_back",
        "claim_status": "approved",
        "reason": reason,
        "message": "Payout rolled back. Claim reset to APPROVED — payout can be retried.",
        "retry_url": f"/api/payouts/{claim_id}/initiate",
    }


async def payout_status_check(claim_id: int, db: AsyncSession) -> dict:
    """Get current payout status for a claim."""
    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        return {"error": "Claim not found"}

    rider_result = await db.execute(select(Rider).where(Rider.id == claim.rider_id))
    rider = rider_result.scalar_one_or_none()

    return {
        "claim_id": claim_id,
        "claim_status": claim.status.value,
        "payout_status": claim.payout_status.value if claim.payout_status else "not_initiated",
        "payout_channel": claim.payout_channel.value if claim.payout_channel else None,
        "payout_ref": claim.payout_ref,
        "amount": claim.payout_amount,
        "upi_id": rider.upi_id if rider else None,
        "initiated_at": claim.payout_initiated_at.isoformat() if claim.payout_initiated_at else None,
        "confirmed_at": claim.payout_confirmed_at.isoformat() if claim.payout_confirmed_at else None,
        "failure_reason": claim.payout_failure_reason,
    }


async def auto_payout_all(db: AsyncSession) -> dict:
    """
    Instant Auto-Disburse: processes ALL approved/auto_approved unpaid claims
    in a single pass. If a payout fails, auto-retries once with channel fallback
    (UPI → IMPS). Returns a detailed report for the frontend demo.
    """
    # Find all eligible claims
    result = await db.execute(
        select(Claim).where(
            Claim.status.in_([ClaimStatus.AUTO_APPROVED, ClaimStatus.APPROVED]),
            Claim.payout_status.in_([PayoutStatus.NOT_INITIATED, PayoutStatus.ROLLED_BACK]),
            Claim.payout_amount > 0,
        )
    )
    claims = result.scalars().all()

    report = {
        "total_eligible": len(claims),
        "processed": 0,
        "succeeded": 0,
        "failed_then_recovered": 0,
        "permanently_failed": 0,
        "total_disbursed": 0.0,
        "upi_count": 0,
        "imps_count": 0,
        "transactions": [],
    }

    for claim in claims:
        rider_result = await db.execute(select(Rider).where(Rider.id == claim.rider_id))
        rider = rider_result.scalar_one_or_none()
        if not rider:
            continue

        txn_record = {
            "claim_id": claim.id,
            "rider_id": rider.id,
            "rider_name": rider.name,
            "amount": claim.payout_amount,
            "trigger_type": claim.trigger_type.value if claim.trigger_type else "unknown",
            "upi_id": rider.upi_id,
            "attempts": [],
            "final_status": "pending",
            "final_channel": None,
            "final_ref": None,
        }

        # ── Attempt 1: Primary channel (UPI preferred) ──
        primary_channel = _select_channel(rider)
        ref1 = _generate_ref(primary_channel)
        now = datetime.now(timezone.utc)

        claim.payout_status = PayoutStatus.INITIATED
        claim.payout_channel = primary_channel
        claim.payout_ref = ref1
        claim.payout_initiated_at = now
        claim.payout_failure_reason = None
        await db.flush()

        success_rate = CHANNEL_SUCCESS_RATE.get(primary_channel, 0.95)
        attempt1_success = random.random() < success_rate

        attempt1 = {
            "attempt": 1,
            "channel": primary_channel.value,
            "ref": ref1,
            "success": attempt1_success,
            "failure_reason": None,
        }

        if attempt1_success:
            # Confirm immediately
            claim.payout_status = PayoutStatus.CONFIRMED
            claim.payout_confirmed_at = datetime.now(timezone.utc)
            claim.status = ClaimStatus.PAID
            claim.paid_at = claim.payout_confirmed_at
            await db.flush()

            attempt1["status"] = "confirmed"
            txn_record["attempts"].append(attempt1)
            txn_record["final_status"] = "paid"
            txn_record["final_channel"] = primary_channel.value
            txn_record["final_ref"] = ref1
            report["succeeded"] += 1
            report["total_disbursed"] += claim.payout_amount
            if primary_channel == PayoutChannel.UPI:
                report["upi_count"] += 1
            else:
                report["imps_count"] += 1
        else:
            # Failed — record reason
            reason = random.choice(FAILURE_REASONS)
            attempt1["failure_reason"] = reason
            attempt1["status"] = "failed"
            txn_record["attempts"].append(attempt1)

            # ── Rollback ──
            claim.payout_status = PayoutStatus.ROLLED_BACK
            claim.status = ClaimStatus.APPROVED
            claim.payout_failure_reason = reason
            await db.flush()

            # ── Attempt 2: Fallback channel ──
            fallback_channel = PayoutChannel.IMPS if primary_channel == PayoutChannel.UPI else PayoutChannel.UPI
            ref2 = _generate_ref(fallback_channel)

            claim.payout_status = PayoutStatus.INITIATED
            claim.payout_channel = fallback_channel
            claim.payout_ref = ref2
            claim.payout_initiated_at = datetime.now(timezone.utc)
            claim.payout_failure_reason = None
            await db.flush()

            # Retry has a boosted success rate (fallback channels are more reliable for retries)
            retry_success = random.random() < 0.98

            attempt2 = {
                "attempt": 2,
                "channel": fallback_channel.value,
                "ref": ref2,
                "success": retry_success,
                "failure_reason": None,
                "status": "confirmed" if retry_success else "failed",
            }

            if retry_success:
                claim.payout_status = PayoutStatus.CONFIRMED
                claim.payout_confirmed_at = datetime.now(timezone.utc)
                claim.status = ClaimStatus.PAID
                claim.paid_at = claim.payout_confirmed_at
                await db.flush()

                txn_record["final_status"] = "recovered"
                txn_record["final_channel"] = fallback_channel.value
                txn_record["final_ref"] = ref2
                report["failed_then_recovered"] += 1
                report["total_disbursed"] += claim.payout_amount
                report["imps_count"] += 1  # fallback is always IMPS for UPI failures
            else:
                reason2 = random.choice(FAILURE_REASONS)
                attempt2["failure_reason"] = reason2
                claim.payout_status = PayoutStatus.FAILED
                claim.payout_failure_reason = f"Retry failed: {reason2}"
                await db.flush()

                txn_record["final_status"] = "permanently_failed"
                report["permanently_failed"] += 1

            txn_record["attempts"].append(attempt2)

        report["processed"] += 1
        report["transactions"].append(txn_record)

    report["total_disbursed"] = round(report["total_disbursed"], 2)
    report["success_rate"] = (
        round((report["succeeded"] + report["failed_then_recovered"]) / report["processed"] * 100, 1)
        if report["processed"] > 0 else 100.0
    )
    return report
