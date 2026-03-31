"""Trigger routes — live readings, active alerts, zone status, simulate, predict, optimize."""

from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.models.models import TriggerReading, City, Zone, Rider, TriggerType
from app.schemas.schemas import TriggerReadingOut
from app.services.mock_external import set_disruption, clear_disruptions, _active_disruptions
from app.services.claims.claim_generator import generate_claims_for_trigger

router = APIRouter()

# ── Trigger thresholds for simulation ──
TRIGGER_DEFAULTS = {
    "rainfall": (64.5, 120.0),
    "heat": (40.0, 44.0),
    "cold_fog": (500.0, 200.0),
    "aqi": (200.0, 350.0),
    "traffic": (10.0, 5.0),
    "social": (0.5, 1.0),
}


class TriggerSimulateRequest(BaseModel):
    zone_id: int
    trigger_type: str  # rainfall, aqi, traffic, social, heat, cold_fog
    value: Optional[float] = None
    duration_hours: Optional[float] = 3.0


@router.post("/simulate", summary="Simulate a disruption for demo")
async def simulate_trigger(request: TriggerSimulateRequest, db: AsyncSession = Depends(get_db)):
    """
    Force a disruption in a zone. Creates trigger reading + auto-generates claims
    for all riders with active policies. This is the key demo endpoint.
    """
    zone_result = await db.execute(select(Zone).where(Zone.id == request.zone_id))
    zone = zone_result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone {request.zone_id} not found")

    trigger_type = request.trigger_type
    if trigger_type not in TRIGGER_DEFAULTS:
        raise HTTPException(status_code=400, detail=f"Unknown trigger type: {trigger_type}. Use: {list(TRIGGER_DEFAULTS.keys())}")

    threshold, default_value = TRIGGER_DEFAULTS[trigger_type]
    value = request.value if request.value is not None else default_value

    # Set mock override so fraud walls see disruption data
    set_disruption(request.zone_id, trigger_type, value)

    # Map string to enum
    trigger_enum = TriggerType(trigger_type)

    trigger_reading = TriggerReading(
        city_id=zone.city_id,
        zone_id=request.zone_id,
        trigger_type=trigger_enum,
        value=value,
        threshold=threshold,
        is_breached=True,
        duration_hours=request.duration_hours or 3.0,
        source="simulation",
        raw_data={"simulated": True, "trigger_type": trigger_type, "value": value},
        timestamp=datetime.now(timezone.utc),
    )
    db.add(trigger_reading)
    await db.flush()

    # Auto-generate claims for all affected riders
    claim_result = await generate_claims_for_trigger(db, trigger_reading)

    return {
        "message": f"Simulated {trigger_type} disruption in {zone.name}",
        "trigger": {
            "id": trigger_reading.id,
            "zone_id": trigger_reading.zone_id,
            "zone_name": zone.name,
            "trigger_type": trigger_type,
            "value": trigger_reading.value,
            "threshold": trigger_reading.threshold,
            "duration_hours": trigger_reading.duration_hours,
        },
        "claims": claim_result,
    }


@router.post("/check", summary="Run trigger checks for all zones")
async def run_trigger_check(db: AsyncSession = Depends(get_db)):
    """Manually trigger checks across all zones using mock external APIs."""
    from app.services import mock_external

    zones_result = await db.execute(select(Zone))
    zones = zones_result.scalars().all()

    all_results = []
    for zone in zones:
        # Check weather
        weather = mock_external.get_weather(zone.id, zone.name)
        if weather["rainfall_mm"] >= 64.5:
            tr = TriggerReading(
                city_id=zone.city_id, zone_id=zone.id,
                trigger_type=TriggerType.RAINFALL,
                value=weather["rainfall_mm"], threshold=64.5,
                is_breached=True, source="mock_openweathermap",
                raw_data=weather, timestamp=datetime.now(timezone.utc),
            )
            db.add(tr)
            await db.flush()
            claims = await generate_claims_for_trigger(db, tr)
            all_results.append({"zone": zone.name, "trigger": "rainfall", "value": weather["rainfall_mm"], "claims": claims["claims_generated"]})

        # Check AQI
        aqi = mock_external.get_aqi(zone.id, zone.name)
        if aqi["aqi_value"] >= 200:
            tr = TriggerReading(
                city_id=zone.city_id, zone_id=zone.id,
                trigger_type=TriggerType.AQI,
                value=aqi["aqi_value"], threshold=200,
                is_breached=True, source="mock_cpcb_waqi",
                raw_data=aqi, timestamp=datetime.now(timezone.utc),
            )
            db.add(tr)
            await db.flush()
            claims = await generate_claims_for_trigger(db, tr)
            all_results.append({"zone": zone.name, "trigger": "aqi", "value": aqi["aqi_value"], "claims": claims["claims_generated"]})

    return {"message": f"Checked {len(zones)} zones", "triggers_fired": len(all_results), "results": all_results}


@router.post("/reset-mocks", summary="Clear all disruption overrides")
async def reset_mocks():
    clear_disruptions()
    return {"message": "All mock disruption overrides cleared"}


@router.get("/readings", response_model=list[TriggerReadingOut])
async def recent_readings(city_id: int = None, limit: int = 50, db: AsyncSession = Depends(get_db)):
    query = select(TriggerReading).order_by(desc(TriggerReading.timestamp)).limit(limit)
    if city_id:
        query = query.where(TriggerReading.city_id == city_id)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/active", response_model=list[TriggerReadingOut])
async def active_triggers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TriggerReading)
        .where(TriggerReading.is_breached == True)
        .order_by(desc(TriggerReading.timestamp))
        .limit(20)
    )
    return result.scalars().all()


@router.get("/active-overrides")
async def get_active_overrides():
    return {"active_disruptions": _active_disruptions}


@router.get("/status/{city_name}")
async def trigger_status_by_city(city_name: str, db: AsyncSession = Depends(get_db)):
    city_result = await db.execute(select(City).where(City.name == city_name))
    city = city_result.scalar_one_or_none()
    if not city:
        return {"city": city_name, "error": "City not found"}

    zones_result = await db.execute(select(Zone).where(Zone.city_id == city.id))
    zones = zones_result.scalars().all()

    zone_statuses = []
    for zone in zones:
        readings_result = await db.execute(
            select(TriggerReading)
            .where(TriggerReading.zone_id == zone.id, TriggerReading.is_breached == True)
            .order_by(desc(TriggerReading.timestamp))
            .limit(6)
        )
        active = readings_result.scalars().all()
        zone_statuses.append({
            "zone": zone.name,
            "tier": zone.tier.value,
            "active_triggers": [
                {"type": r.trigger_type.value, "value": r.value, "threshold": r.threshold}
                for r in active
            ],
        })

    return {"city": city_name, "zones": zone_statuses}


@router.get("/predict/{zone_id}")
async def predict_zone_risk(zone_id: int, db: AsyncSession = Depends(get_db)):
    zone_result = await db.execute(select(Zone).where(Zone.id == zone_id))
    zone = zone_result.scalar_one_or_none()
    if not zone:
        return {"error": "Zone not found"}

    return {
        "zone_id": zone_id,
        "zone_name": zone.name,
        "tier": zone.tier.value,
        "predictions": [
            {"day": "Monday", "risk": "Low", "message": "Normal operations expected."},
            {"day": "Tuesday", "risk": "Low", "message": "Clear skies, moderate traffic."},
            {"day": "Wednesday", "risk": "High", "message": "Heavy rain expected 2-8 PM."},
            {"day": "Thursday", "risk": "Medium", "message": "Residual waterlogging."},
            {"day": "Friday", "risk": "Low", "message": "Conditions normalising."},
            {"day": "Saturday", "risk": "Low", "message": "Weekend — reduced traffic."},
            {"day": "Sunday", "risk": "Low", "message": "Weekend — normal operations."},
        ],
    }


@router.get("/optimize/{rider_id}")
async def optimize_rider_schedule(rider_id: int, db: AsyncSession = Depends(get_db)):
    rider_result = await db.execute(select(Rider).where(Rider.id == rider_id))
    rider = rider_result.scalar_one_or_none()
    if not rider:
        return {"error": "Rider not found"}

    return {
        "rider_id": rider_id,
        "rider_name": rider.name,
        "recommendation_active": True,
        "current_shift": "Wed 16:00 - 24:00",
        "recommended_shift": "Wed 07:00 - 13:00",
        "reasoning": "Rainfall 2-8 PM expected. Switching to morning shift recovers an estimated Rs.420.",
        "projected_earnings_saved": 420.0,
        "risk_avoided": "rainfall",
    }
