"""Rider routes — profile, dashboard, update, zones."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_rider
from app.models.models import Rider, Zone, Policy, Claim
from app.schemas.schemas import RiderOut, RiderUpdate, RiderDashboard, PolicyOut, ClaimOut, ZoneOut

router = APIRouter()


@router.get("/me", response_model=RiderDashboard)
async def rider_dashboard(rider: Rider = Depends(get_current_rider), db: AsyncSession = Depends(get_db)):
    zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id))
    zone = zone_result.scalar_one()

    policy_result = await db.execute(
        select(Policy)
        .where(Policy.rider_id == rider.id, Policy.status == "active")
        .order_by(Policy.week_start.desc())
        .limit(1)
    )
    active_policy = policy_result.scalar_one_or_none()

    claims_result = await db.execute(
        select(Claim)
        .where(Claim.rider_id == rider.id)
        .order_by(Claim.event_time.desc())
        .limit(10)
    )
    recent_claims = claims_result.scalars().all()

    risk_summary = {
        "flood": zone.flood_risk_score,
        "heat": zone.heat_risk_score,
        "aqi": zone.aqi_risk_score,
        "traffic": zone.traffic_risk_score,
    }

    return RiderDashboard(
        rider=RiderOut.model_validate(rider),
        zone=ZoneOut.model_validate(zone),
        active_policy=PolicyOut.model_validate(active_policy) if active_policy else None,
        recent_claims=[ClaimOut.model_validate(c) for c in recent_claims],
        shield_level=rider.shield_level,
        weekly_earnings=rider.avg_weekly_earnings,
        risk_summary=risk_summary,
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
