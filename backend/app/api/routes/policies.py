"""Policy routes — buy, view active, history."""

from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_rider
from app.models.models import Rider, Zone, Policy, City
from app.schemas.schemas import PolicyCreate, PolicyOut
from app.services.pricing.pricing_engine import PricingEngine, coverage_triggers_from_premium

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
    return policy


@router.get("/active", response_model=PolicyOut | None)
async def get_active_policy(
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
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
    result = await db.execute(
        select(Policy).where(Policy.rider_id == rider.id).order_by(Policy.week_start.desc()).limit(20)
    )
    return result.scalars().all()
