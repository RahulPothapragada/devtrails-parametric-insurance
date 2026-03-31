"""Admin dashboard routes — platform stats, live feed, cities, claim review."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.models import Rider, Policy, Claim, TriggerReading, Zone, City
from app.schemas.schemas import AdminStats, ClaimOut

router = APIRouter()


@router.get("/stats", response_model=AdminStats)
async def admin_stats(db: AsyncSession = Depends(get_db)):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_riders = (await db.execute(select(func.count(Rider.id)))).scalar() or 0
    active_policies = (await db.execute(
        select(func.count(Policy.id)).where(Policy.status == "active")
    )).scalar() or 0
    claims_today = (await db.execute(
        select(func.count(Claim.id)).where(Claim.event_time >= today)
    )).scalar() or 0
    payouts_today = (await db.execute(
        select(func.coalesce(func.sum(Claim.payout_amount), 0))
        .where(Claim.event_time >= today, Claim.status.in_(["auto_approved", "approved", "paid"]))
    )).scalar() or 0

    active_result = await db.execute(
        select(TriggerReading)
        .where(TriggerReading.is_breached == True)
        .order_by(desc(TriggerReading.timestamp))
        .limit(10)
    )
    active_triggers = [
        {"type": r.trigger_type.value, "value": r.value, "city_id": r.city_id}
        for r in active_result.scalars().all()
    ]

    zones_result = await db.execute(
        select(Zone).order_by(Zone.flood_risk_score.desc()).limit(10)
    )
    zone_risk = [
        {"zone": z.name, "tier": z.tier.value, "flood": z.flood_risk_score, "heat": z.heat_risk_score}
        for z in zones_result.scalars().all()
    ]

    return AdminStats(
        total_riders=total_riders,
        active_policies=active_policies,
        total_claims_today=claims_today,
        total_payouts_today=payouts_today,
        active_triggers=active_triggers,
        zone_risk_summary=zone_risk,
    )


@router.get("/live-feed")
async def live_rider_feed(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Claim).order_by(desc(Claim.event_time)).limit(limit)
    )
    claims = result.scalars().all()

    feed = []
    for claim in claims:
        rider_result = await db.execute(select(Rider).where(Rider.id == claim.rider_id))
        rider = rider_result.scalar_one_or_none()
        zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id)) if rider else None
        zone = zone_result.scalar_one_or_none() if zone_result else None
        feed.append({
            "rider_id": claim.rider_id,
            "rider_name": rider.name if rider else "Unknown",
            "location": zone.name if zone else "Unknown",
            "trigger": claim.trigger_type.value,
            "status": claim.status.value,
            "payout": claim.payout_amount,
            "time": claim.event_time.isoformat(),
        })
    return feed


@router.put("/claims/{claim_id}/review", response_model=ClaimOut)
async def review_claim(
    claim_id: int,
    verdict: str = Query(..., description="'approved' or 'denied'"),
    db: AsyncSession = Depends(get_db),
):
    """Manual claim review — admin approves or denies a pending/flagged claim."""
    if verdict not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Invalid verdict. Use 'approved' or 'denied'")

    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.status.value not in ["pending_review", "flagged"]:
        raise HTTPException(status_code=400, detail="Claim already processed — cannot re-review")

    claim.status = verdict
    if verdict == "approved":
        claim.payout_amount = claim.hours_lost * claim.hourly_rate_used * 0.60
    else:
        claim.payout_amount = 0.0

    await db.flush()
    return claim


@router.get("/cities")
async def list_cities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(City).order_by(City.name))
    cities = result.scalars().all()
    return [{"id": c.id, "name": c.name, "state": c.state, "lat": c.lat, "lng": c.lng} for c in cities]
