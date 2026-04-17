"""
Auto Claim Generation System.
When a trigger fires, creates claims for all riders with active policies in the zone.
Runs fraud detection, estimates hours lost, calculates payout.
"""

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import (
    Policy, Claim, Rider, Zone, City, TriggerReading, RiderActivity,
    PolicyStatus, ClaimStatus, TriggerType,
)
from app.services.fraud.fraud_engine import FraudEngine
from app.services.mock_platform import generate_rider_activity
from app.services.pricing.pricing_engine import coverage_triggers_from_premium, premium_to_weekly_cap
from app.services.payout.payout_service import auto_disburse_claim

COVERAGE_PCT = 0.50
MIN_LOSS_FOR_PAYOUT = 0.0   # weekly cap already bounds the max; don't drop low-tier riders
AUTO_APPROVE_MAX = 40       # matches fraud engine: scores 0-40 = trusted/normal → auto-approve
PENDING_REVIEW_MAX = 60

# Hourly rates by zone tier (base for Tier 1 Urban)
ZONE_HOURLY_RATES = {
    "high": 170,
    "medium": 140,
    "low": 110,
}

# City tier multiplier — reflects earning potential
CITY_TIER_RATE_MULT = {
    "tier_1": 1.0,    # Metros
    "tier_2": 0.80,   # Major cities
    "tier_3": 0.60,   # Smaller cities
}

# Area type multiplier — urban riders earn more than rural
AREA_TYPE_RATE_MULT = {
    "urban": 1.0,
    "semi_urban": 0.75,
    "rural": 0.55,
}

fraud_engine = FraudEngine()


async def generate_claims_for_trigger(
    db: AsyncSession,
    trigger_reading: TriggerReading,
    rider_id: int | None = None,
) -> dict:
    """Generate claims for all active policies in the triggered zone.
    If rider_id is set, only generate for that specific rider (demo mode).
    """
    zone_id = trigger_reading.zone_id

    # Skip activity population for simulated triggers — Wall 7 peer-behavior auto-passes them
    is_simulated_trigger = isinstance(trigger_reading.raw_data, dict) and trigger_reading.raw_data.get("simulated")
    if not is_simulated_trigger:
        await _populate_activities(db, trigger_reading.timestamp, zone_id)

    # Find active policies in zone — optionally scoped to one rider
    policy_query = select(Policy).where(Policy.zone_id == zone_id, Policy.status == PolicyStatus.ACTIVE)
    if rider_id is not None:
        policy_query = policy_query.where(Policy.rider_id == rider_id)
    policies_result = await db.execute(policy_query)
    active_policies = policies_result.scalars().all()

    results = {
        "trigger_id": trigger_reading.id,
        "zone_id": zone_id,
        "total_policies": len(active_policies),
        "claims_generated": 0,
        "auto_approved": 0,
        "pending_review": 0,
        "denied": 0,
        "total_payout": 0.0,
        "claim_details": [],
    }

    for policy in active_policies:
        rider_result = await db.execute(select(Rider).where(Rider.id == policy.rider_id))
        rider = rider_result.scalar_one_or_none()
        if not rider:
            continue

        # Get zone tier + area type + city tier for hourly rate
        zone_result = await db.execute(select(Zone).where(Zone.id == zone_id))
        zone = zone_result.scalar_one_or_none()
        tier_str = zone.tier.value if zone else "medium"
        area_type_str = zone.area_type.value if zone and zone.area_type else "urban"

        # Get city tier
        city_tier_str = "tier_1"
        if zone:
            city_result = await db.execute(select(City).where(City.id == zone.city_id))
            city = city_result.scalar_one_or_none()
            city_tier_str = city.city_tier.value if city and city.city_tier else "tier_1"

        # UNDERWRITING RULE: Trigger must match worker's active hours
        # Simulated triggers bypass this — demo can fire at any time
        if not is_simulated_trigger:
            hour = trigger_reading.timestamp.hour
            shift_match = (
                rider.shift_type == "flexible"
                or (rider.shift_type == "morning" and 5 <= hour <= 17)
                or (rider.shift_type == "evening" and 14 <= hour <= 24)
                or (rider.shift_type == "night" and (hour >= 20 or hour <= 8))
            )
            if not shift_match:
                continue

        if not is_simulated_trigger:  # one payout per policy week — bypassed for demo
            existing_paid_like_result = await db.execute(
                select(Claim).where(
                    Claim.policy_id == policy.id,
                    Claim.rider_id == rider.id,
                    Claim.event_time >= policy.week_start,
                    Claim.event_time < policy.week_end,
                    Claim.payout_amount > 0,
                    Claim.status != ClaimStatus.DENIED,
                )
            )
            if existing_paid_like_result.scalars().first():
                # One payout per rider per policy week, even if multiple triggers hit.
                continue

        base_rate = ZONE_HOURLY_RATES.get(tier_str, 140)
        tier_mult = CITY_TIER_RATE_MULT.get(city_tier_str, 1.0)
        area_mult = AREA_TYPE_RATE_MULT.get(area_type_str, 1.0)
        hourly_rate = round(base_rate * tier_mult * area_mult)

        hours_lost = trigger_reading.duration_hours if trigger_reading.duration_hours else 3.0

        weekly_cap = premium_to_weekly_cap(policy.premium_amount)
        trigger_losses = policy.coverage_triggers or coverage_triggers_from_premium(policy.premium_amount)

        # PARAMETRIC PAYOUT: coverage_triggers now represent estimated income loss
        # by peril. The product covers 50% of that loss, capped once per week.
        trigger_name = trigger_reading.trigger_type.value
        estimated_loss = float(trigger_losses.get(trigger_name, 0.0))
        if estimated_loss <= 0:
            fallback_losses = coverage_triggers_from_premium(policy.premium_amount)
            estimated_loss = float(fallback_losses.get(trigger_name, 0.0))

        if estimated_loss < MIN_LOSS_FOR_PAYOUT:
            continue

        payout_amount = min(round(estimated_loss * COVERAGE_PCT, 2), weekly_cap)

        # Determine trigger type
        trigger_type = trigger_reading.trigger_type

        claim = Claim(
            rider_id=rider.id,
            policy_id=policy.id,
            trigger_reading_id=trigger_reading.id,
            trigger_type=trigger_type,
            trigger_value=trigger_reading.value,
            trigger_threshold=trigger_reading.threshold,
            trigger_sources=trigger_reading.raw_data,
            payout_amount=payout_amount,
            hours_lost=hours_lost,
            hourly_rate_used=hourly_rate,
            status=ClaimStatus.PENDING_REVIEW,
            event_time=trigger_reading.timestamp,
        )
        db.add(claim)
        await db.flush()

        # Run fraud detection
        verdict = await fraud_engine.evaluate_claim(
            claim=claim, rider=rider, db=db, trigger_reading=trigger_reading,
        )

        fraud_score = verdict.total_score
        if fraud_score <= AUTO_APPROVE_MAX:
            status = ClaimStatus.AUTO_APPROVED
            results["auto_approved"] += 1
        elif fraud_score <= PENDING_REVIEW_MAX:
            status = ClaimStatus.PENDING_REVIEW
            results["pending_review"] += 1
        else:
            status = ClaimStatus.DENIED
            results["denied"] += 1

        claim.status = status
        claim.fraud_score = fraud_score
        # Keep original payout_amount for audit trail; payout_service checks status before disbursing
        claim.fraud_walls_passed = [
            {"wall": w.wall_name, "passed": w.passed, "score": w.score, "reason": w.reason}
            for w in verdict.walls
        ]
        await db.flush()

        # ── PARAMETRIC AUTO-PAYOUT: immediately disburse for AUTO_APPROVED claims ──
        payout_record = None
        if status == ClaimStatus.AUTO_APPROVED and payout_amount > 0:
            payout_record = await auto_disburse_claim(claim.id, db)

        results["claims_generated"] += 1
        results["total_payout"] += payout_amount
        results["claim_details"].append({
            "claim_id": claim.id,
            "rider_id": rider.id,
            "rider_name": rider.name,
            "upi_id": rider.upi_id,
            "status": status.value,
            "fraud_score": fraud_score,
            "payout_amount": payout_amount,
            "classification": verdict.classification,
            "auto_payout": payout_record,
        })

    results["total_payout"] = round(results["total_payout"], 2)
    return results


async def _populate_activities(db: AsyncSession, date: datetime, zone_id: int):
    """Generate mock activity records for all riders in the zone."""
    riders_result = await db.execute(
        select(Rider).where(Rider.zone_id == zone_id, Rider.is_active == True)
    )
    riders = riders_result.scalars().all()

    for rider in riders:
        trigger_date = date.replace(hour=0, minute=0, second=0)
        existing = await db.execute(
            select(RiderActivity).where(
                RiderActivity.rider_id == rider.id,
                RiderActivity.date >= trigger_date,
            )
        )
        if existing.scalar_one_or_none():
            continue

        zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id))
        zone = zone_result.scalar_one_or_none()
        if not zone:
            continue

        activity_data = generate_rider_activity(
            rider_id=rider.id,
            date=date,
            zone_lat=zone.lat,
            zone_lng=zone.lng,
            is_suspicious=rider.is_suspicious,
        )

        activity = RiderActivity(**activity_data)
        db.add(activity)

    await db.flush()


async def _calculate_zone_impact(db: AsyncSession, zone_id: int, trigger_reading: TriggerReading) -> float:
    """Calculate what percentage of riders were actually impacted."""
    from datetime import timedelta

    trigger_date = trigger_reading.timestamp.replace(hour=0, minute=0, second=0)
    riders_result = await db.execute(
        select(Rider).where(Rider.zone_id == zone_id, Rider.is_active == True)
    )
    zone_riders = riders_result.scalars().all()

    if not zone_riders:
        return 0.8

    total = len(zone_riders)
    stopped = 0

    for rider in zone_riders:
        act_result = await db.execute(
            select(RiderActivity).where(
                RiderActivity.rider_id == rider.id,
                RiderActivity.date >= trigger_date,
                RiderActivity.date < trigger_date + timedelta(days=1),
            )
        )
        activity = act_result.scalar_one_or_none()
        if not activity or not activity.is_working or activity.deliveries_completed <= 2:
            stopped += 1

    impact = stopped / total if total > 0 else 0.8
    return round(max(impact, 0.3), 2)
