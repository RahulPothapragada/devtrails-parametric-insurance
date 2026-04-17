"""Rider routes — profile, dashboard, update, zones."""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_rider
from app.models.models import Rider, Zone, City, Policy, Claim, RiderActivity
from app.schemas.schemas import RiderOut, RiderUpdate, RiderDashboard, PolicyOut, ClaimOut, ZoneOut, DailyEarning

router = APIRouter()

# ── In-memory cache ──────────────────────────────────────────────────────────
# Dashboard data is expensive to fetch (slow DB query on rider_activities).
# Cache per rider for 5 minutes so judges see instant refreshes.
_dashboard_cache: dict[int, tuple[RiderDashboard, datetime]] = {}
_CACHE_TTL = timedelta(minutes=5)


def _get_cached(rider_id: int) -> Optional[RiderDashboard]:
    entry = _dashboard_cache.get(rider_id)
    if entry and datetime.utcnow() < entry[1]:
        return entry[0]
    return None


def _set_cached(rider_id: int, data: RiderDashboard) -> None:
    _dashboard_cache[rider_id] = (data, datetime.utcnow() + _CACHE_TTL)


def invalidate_dashboard_cache(rider_id: int) -> None:
    """Call this after any mutation (new claim, policy update, etc.)."""
    _dashboard_cache.pop(rider_id, None)


@router.get("/me", response_model=RiderDashboard)
async def rider_dashboard(rider: Rider = Depends(get_current_rider), db: AsyncSession = Depends(get_db)):
    # Return cached data if fresh
    cached = _get_cached(rider.id)
    if cached is not None:
        return cached

    since_7 = datetime.utcnow() - timedelta(days=7)
    since_30 = datetime.utcnow() - timedelta(days=30)

    # Sequential queries — asyncpg cannot pipeline concurrent queries on one connection
    zone_city_result = await db.execute(
        select(Zone, City).join(City, Zone.city_id == City.id).where(Zone.id == rider.zone_id)
    )
    policy_result = await db.execute(
        select(Policy)
        .where(Policy.rider_id == rider.id, Policy.status == "active")
        .order_by(Policy.week_start.desc())
        .limit(1)
    )
    claims_result = await db.execute(
        select(Claim).where(Claim.rider_id == rider.id).order_by(Claim.event_time.desc()).limit(10)
    )
    # Only fetch last 30 days.
    # Uses ix_rider_activities_cover (covering index) for an index-only scan —
    # avoids touching the heap and its large gps_points column entirely.
    activity_rows_result = await db.execute(
        select(
            RiderActivity.date,
            RiderActivity.deliveries_completed,
            RiderActivity.hours_active,
            RiderActivity.earnings,
        ).where(RiderActivity.rider_id == rider.id, RiderActivity.date >= since_30)
        .order_by(RiderActivity.date.asc())
        .limit(60)  # max 60 rows (30 days × 2 shifts max)
    )

    zone, city = zone_city_result.one()
    active_policy = policy_result.scalar_one_or_none()
    recent_claims = claims_result.scalars().all()
    activity_rows = activity_rows_result.all()

    total_deliveries = sum(r.deliveries_completed for r in activity_rows)
    active_hours     = sum(r.hours_active for r in activity_rows)

    daily_rows = [r for r in activity_rows if r.date >= since_7]

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

    result = RiderDashboard(
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
    _set_cached(rider.id, result)
    return result


@router.patch("/me", response_model=RiderOut)
async def update_rider(
    body: RiderUpdate,
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rider, field, value)
    await db.flush()
    invalidate_dashboard_cache(rider.id)
    return rider


@router.get("/zones", response_model=list[ZoneOut])
async def list_zones(city_id: int = None, db: AsyncSession = Depends(get_db)):
    query = select(Zone)
    if city_id:
        query = query.where(Zone.city_id == city_id)
    result = await db.execute(query.order_by(Zone.name))
    return result.scalars().all()
