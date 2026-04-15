"""Rider routes — profile, dashboard, update, zones."""

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.auth import get_current_rider
from app.models.models import Rider, Zone, City, Policy, Claim, RiderActivity
from app.schemas.schemas import RiderOut, RiderUpdate, RiderDashboard, PolicyOut, ClaimOut, ZoneOut, DailyEarning

router = APIRouter()


@router.get("/me", response_model=RiderDashboard)
async def rider_dashboard(rider: Rider = Depends(get_current_rider), db: AsyncSession = Depends(get_db)):
    since_30 = datetime.utcnow() - timedelta(days=30)

    # ── Query 1: Zone + City in one JOIN ──
    zone_city_result = await db.execute(
        select(Zone, City).join(City, Zone.city_id == City.id).where(Zone.id == rider.zone_id)
    )
    zone_city = zone_city_result.one()
    zone, city = zone_city

    # ── Query 2: Active policy ──
    policy_result = await db.execute(
        select(Policy)
        .where(Policy.rider_id == rider.id, Policy.status == "active")
        .order_by(Policy.week_start.desc())
        .limit(1)
    )
    active_policy = policy_result.scalar_one_or_none()

    # ── Query 3: Recent claims ──
    claims_result = await db.execute(
        select(Claim).where(Claim.rider_id == rider.id).order_by(Claim.event_time.desc()).limit(10)
    )
    recent_claims = claims_result.scalars().all()

    # ── Query 4: Activity rows for last 30 days — compute both aggregates in Python ──
    activity_rows_result = await db.execute(
        select(
            RiderActivity.date,
            RiderActivity.deliveries_completed,
            RiderActivity.hours_active,
            RiderActivity.earnings,
        ).where(RiderActivity.rider_id == rider.id, RiderActivity.date >= since_30)
        .order_by(RiderActivity.date.asc())
    )
    activity_rows = activity_rows_result.all()

    total_deliveries = sum(r.deliveries_completed for r in activity_rows)
    active_hours     = sum(r.hours_active for r in activity_rows)

    cutoff_7 = datetime.utcnow() - timedelta(days=7)
    daily_rows = [r for r in activity_rows if r.date >= cutoff_7]

    # Build a dict keyed by date string so we can fill in all 7 days
    day_abbr = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    daily_map: dict[str, DailyEarning] = {}
    for row in daily_rows:
        d = row.date.date() if hasattr(row.date, 'date') else row.date
        key = str(d)
        daily_map[key] = DailyEarning(
            date=key,
            day=day_abbr[d.weekday()],
            earnings=round(float(row.earnings), 2),
            deliveries=int(row.deliveries_completed),
            hours=round(float(row.hours_active), 1),
        )

    daily_earnings: list[DailyEarning] = []
    for i in range(6, -1, -1):
        d = (datetime.utcnow() - timedelta(days=i)).date()
        key = str(d)
        daily_earnings.append(daily_map.get(key, DailyEarning(
            date=key,
            day=day_abbr[d.weekday()],
            earnings=0.0,
            deliveries=0,
            hours=0.0,
        )))

    risk_summary = {
        "flood": zone.flood_risk_score,
        "heat": zone.heat_risk_score,
        "aqi": zone.aqi_risk_score,
        "traffic": zone.traffic_risk_score,
    }

    return RiderDashboard(
        rider=RiderOut.model_validate(rider),
        zone=ZoneOut.model_validate(zone),
        city_name=city.name if city else "",
        city_tier=city.city_tier.value if city and city.city_tier else "tier_1",
        active_policy=PolicyOut.model_validate(active_policy) if active_policy else None,
        recent_claims=[ClaimOut.model_validate(c) for c in recent_claims],
        shield_level=rider.shield_level,
        weekly_earnings=rider.avg_weekly_earnings,
        total_deliveries=int(total_deliveries),
        active_hours=float(active_hours),
        risk_summary=risk_summary,
        daily_earnings=daily_earnings,
    )


@router.patch("/me", response_model=RiderOut)
async def update_rider(
    body: RiderUpdate,
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rider, field, value)
    await db.flush()
    return rider


@router.get("/zones", response_model=list[ZoneOut])
async def list_zones(city_id: int = None, db: AsyncSession = Depends(get_db)):
    query = select(Zone)
    if city_id:
        query = query.where(Zone.city_id == city_id)
    result = await db.execute(query.order_by(Zone.name))
    return result.scalars().all()
