"""Policy routes — buy, view active, history."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_rider
from app.core.cache import async_cached, invalidate_namespace
from app.models.models import Rider, Zone, Policy, City
from app.schemas.schemas import PolicyCreate, PolicyOut
from app.services.pricing.pricing_engine import PricingEngine, coverage_triggers_from_premium
from app.api.routes.riders import invalidate_dashboard_cache

router = APIRouter()
pricing_engine = PricingEngine()


@router.post("/buy", response_model=PolicyOut, status_code=201)
async def buy_policy(
    body: PolicyCreate,
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(Policy).where(Policy.rider_id == rider.id, Policy.status == "active")
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have an active policy")

    zone_result = await db.execute(select(Zone).where(Zone.id == body.zone_id))
    zone = zone_result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    city_result = await db.execute(select(City).where(City.id == zone.city_id))
    city = city_result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    premium_data = pricing_engine.calculate_premium(
        city=city.name if city else "Mumbai",
        zone_tier=zone.tier.value,
        month=now.month,
        city_tier=city.city_tier.value if city and city.city_tier else "tier_1",
        area_type=zone.area_type.value if zone.area_type else "urban",
        activity_tier=rider.activity_tier,
    )

    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

    policy = Policy(
        rider_id=rider.id,
        zone_id=body.zone_id,
        week_start=week_start,
        week_end=week_start + timedelta(days=7),
        premium_amount=premium_data["total_weekly_premium"],
        premium_breakdown=premium_data["breakdown"],
        coverage_triggers=coverage_triggers_from_premium(premium_data["total_weekly_premium"]),
        status="active",
        auto_renew=body.auto_renew,
    )
    db.add(policy)
    await db.flush()
    # New policy → bust every rider-scoped cache + admin stats (active_policies count).
    invalidate_dashboard_cache(rider.id)
    invalidate_namespace("admin_stats")
    return policy


@router.get("/active", response_model=PolicyOut | None)
async def get_active_policy(
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    return await _cached_active(rider, db)


@async_cached(namespace="rider_active_policy", ttl=60, key=lambda rider, db: rider.id)
async def _cached_active(rider: Rider, db: AsyncSession):
    result = await db.execute(
        select(Policy)
        .where(Policy.rider_id == rider.id, Policy.status == "active")
        .order_by(Policy.week_start.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


@router.get("/history", response_model=list[PolicyOut])
async def policy_history(
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    return await _cached_history(rider, db)


@async_cached(namespace="rider_policy_history", ttl=60, key=lambda rider, db: rider.id)
async def _cached_history(rider: Rider, db: AsyncSession):
    result = await db.execute(
        select(Policy).where(Policy.rider_id == rider.id).order_by(Policy.week_start.desc()).limit(20)
    )
    return result.scalars().all()


@router.post("/cancel")
async def cancel_policy(
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    """Cancel the rider's active policy. Coverage ends immediately."""
    result = await db.execute(
        select(Policy).where(Policy.rider_id == rider.id, Policy.status == "active")
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found")
    policy.status = "cancelled"
    policy.auto_renew = False
    await db.flush()
    invalidate_dashboard_cache(rider.id)
    invalidate_namespace("admin_stats")
    return {"message": "Policy cancelled. Coverage has ended.", "policy_id": policy.id}


@router.patch("/toggle-auto-renew")
async def toggle_auto_renew(
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    """Toggle auto-renew on the rider's active policy."""
    result = await db.execute(
        select(Policy).where(Policy.rider_id == rider.id, Policy.status == "active")
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=404, detail="No active policy found")
    policy.auto_renew = not policy.auto_renew
    await db.flush()
    invalidate_dashboard_cache(rider.id)
    return {"auto_renew": policy.auto_renew, "policy_id": policy.id}
