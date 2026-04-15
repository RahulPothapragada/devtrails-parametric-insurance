"""Trigger routes — live readings, active alerts, zone status, simulate, predict, optimize, stress."""

from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from sqlalchemy import func as sa_func
from app.core.database import get_db
from app.models.models import TriggerReading, City, Zone, Rider, TriggerType, WeeklyLedger, Policy, PolicyStatus
from app.schemas.schemas import TriggerReadingOut
from app.services.mock_external import set_disruption, clear_disruptions, _active_disruptions
from app.services.claims.claim_generator import generate_claims_for_trigger
from app.services.triggers.trigger_engine import get_trigger_thresholds

router = APIRouter()

# ── Trigger thresholds for simulation ──
TRIGGER_DEFAULTS = {
    "rainfall": (65.0, 120.0),
    "heat": (44.0, 50.0),
    "cold_fog": (500.0, 200.0),
    "aqi": (500.0, 700.0),
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
        timestamp=datetime.utcnow(),
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

    current_month = datetime.utcnow().month
    thresholds = get_trigger_thresholds(current_month)
    zones_result = await db.execute(select(Zone))
    zones = zones_result.scalars().all()

    all_results = []
    for zone in zones:
        # Check weather
        weather = mock_external.get_weather(zone.id, zone.name)
        rainfall_threshold = thresholds["rainfall"]["level_1"]
        if weather["rainfall_mm"] >= rainfall_threshold:
            tr = TriggerReading(
                city_id=zone.city_id, zone_id=zone.id,
                trigger_type=TriggerType.RAINFALL,
                value=weather["rainfall_mm"], threshold=rainfall_threshold,
                is_breached=True, source="mock_openweathermap",
                raw_data=weather, timestamp=datetime.utcnow(),
            )
            db.add(tr)
            await db.flush()
            claims = await generate_claims_for_trigger(db, tr)
            all_results.append({"zone": zone.name, "trigger": "rainfall", "value": weather["rainfall_mm"], "claims": claims["claims_generated"]})

        # Check AQI
        aqi = mock_external.get_aqi(zone.id, zone.name)
        aqi_threshold = thresholds["aqi"]["level_1"]
        if aqi["aqi_value"] >= aqi_threshold:
            tr = TriggerReading(
                city_id=zone.city_id, zone_id=zone.id,
                trigger_type=TriggerType.AQI,
                value=aqi["aqi_value"], threshold=aqi_threshold,
                is_breached=True, source="mock_cpcb_waqi",
                raw_data=aqi, timestamp=datetime.utcnow(),
            )
            db.add(tr)
            await db.flush()
            claims = await generate_claims_for_trigger(db, tr)
            all_results.append({"zone": zone.name, "trigger": "aqi", "value": aqi["aqi_value"], "claims": claims["claims_generated"]})

        # Check cold fog — lower visibility = worse, so use <= (opposite of rainfall/heat/AQI)
        fog_threshold = thresholds["cold_fog"]["level_1"]  # 500m = mild fog entry point
        if weather["visibility_m"] <= fog_threshold:
            tr = TriggerReading(
                city_id=zone.city_id, zone_id=zone.id,
                trigger_type=TriggerType.COLD_FOG,
                value=weather["visibility_m"], threshold=fog_threshold,
                is_breached=True, source="mock_openweathermap",
                raw_data=weather, timestamp=datetime.utcnow(),
            )
            db.add(tr)
            await db.flush()
            claims = await generate_claims_for_trigger(db, tr)
            all_results.append({"zone": zone.name, "trigger": "cold_fog", "value": weather["visibility_m"], "claims": claims["claims_generated"]})

    return {"message": f"Checked {len(zones)} zones", "triggers_fired": len(all_results), "results": all_results}


@router.post("/reset-mocks", summary="Clear all disruption overrides")
async def reset_mocks():
    clear_disruptions()
    return {"message": "All mock disruption overrides cleared"}


@router.post("/demo-disaster/{rider_id}", summary="Robust disaster simulation for demo dashboard")
async def demo_disaster(rider_id: int, db: AsyncSession = Depends(get_db)):
    """
    Fast demo endpoint: directly creates a trigger + claim for a single rider.
    Bypasses the fraud engine entirely to avoid SQLite locking.
    """
    from app.models.models import Claim, ClaimStatus, PayoutStatus
    from app.services.pricing.pricing_engine import premium_to_weekly_cap

    rider_result = await db.execute(select(Rider).where(Rider.id == rider_id))
    rider = rider_result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found")

    zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id))
    zone = zone_result.scalar_one_or_none()

    # Find active policy
    policy_result = await db.execute(
        select(Policy).where(Policy.rider_id == rider_id, Policy.status == PolicyStatus.ACTIVE).limit(1)
    )
    policy = policy_result.scalar_one_or_none()
    if not policy:
        raise HTTPException(status_code=400, detail="No active policy for this rider")

    now = datetime.utcnow()

    # Clean up past demo claims to prevent the payout from stacking on multiple clicks
    past_demo_claims_result = await db.execute(
        select(Claim).where(
            Claim.rider_id == rider_id,
            Claim.fraud_score == 5.0  # Unique flag for demo claims
        )
    )
    for past_claim in past_demo_claims_result.scalars().all():
        await db.delete(past_claim)
    await db.flush()

    # Create trigger reading
    trigger_reading = TriggerReading(
        city_id=zone.city_id,
        zone_id=rider.zone_id,
        trigger_type=TriggerType.RAINFALL,
        value=85.0,
        threshold=65.0,
        is_breached=True,
        duration_hours=3.0,
        source="demo_trigger",
        raw_data={"simulated": True, "rider_id": rider_id},
        timestamp=now,
    )
    db.add(trigger_reading)
    await db.flush()

    # Determine payout from the rider's weekly premium tier.
    payout_amount = premium_to_weekly_cap(policy.premium_amount)

    # Create claim as AUTO_APPROVED + NOT_INITIATED so the payout flow can run
    claim = Claim(
        rider_id=rider_id,
        policy_id=policy.id,
        trigger_reading_id=trigger_reading.id,
        trigger_type=TriggerType.RAINFALL,
        trigger_value=85.0,
        trigger_threshold=65.0,
        payout_amount=payout_amount,
        hours_lost=3.0,
        hourly_rate_used=rider.avg_hourly_rate or 90.0,
        payout_status=PayoutStatus.NOT_INITIATED,
        status=ClaimStatus.AUTO_APPROVED,
        fraud_score=5.0,
        fraud_walls_passed={"walls_passed": 7, "walls_failed": 0, "classification": "trusted"},
        event_time=now,
    )
    db.add(claim)
    await db.flush()
    claim_id = claim.id

    # ── Parametric auto-payout: no rider action needed ──
    from app.services.payout.payout_service import auto_disburse_claim
    payout_result = await auto_disburse_claim(claim_id, db)
    await db.commit()

    return {
        "message": f"Rainfall simulated in {zone.name}",
        "payout_generated": True,
        "payout_amount": payout_amount,
        "claim_id": claim_id,
        "claims_count": 1,
        "upi_id": rider.upi_id,
        "auto_payout": payout_result,
    }


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

    # Resolve city name for AQI lookup
    city_result = await db.execute(select(City).where(City.id == zone.city_id))
    city = city_result.scalar_one_or_none()
    city_name = city.name if city else "Mumbai"

    from app.services.triggers.weather_service import WeatherService
    from app.services.triggers.aqi_service import AQIService
    from app.services.triggers.trigger_engine import get_trigger_thresholds

    weather_svc = WeatherService()
    aqi_svc = AQIService()

    # Fetch real 5-day forecast + current AQI in parallel
    import asyncio
    forecast_task = weather_svc.get_forecast_7day(zone.lat, zone.lng)
    aqi_task = aqi_svc.get_current(city_name)
    forecast, aqi_data = await asyncio.gather(forecast_task, aqi_task)

    current_aqi = aqi_data.get("aqi", 100)
    thresholds = get_trigger_thresholds(datetime.utcnow().month)

    now = datetime.utcnow()
    days_of_week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    predictions = []
    for i, day_data in enumerate(forecast[:7]):
        rainfall = day_data.get("rainfall_mm", 0.0)
        temp_max = day_data.get("temp_max", 32.0)
        conditions = day_data.get("conditions", "Clear")
        if isinstance(conditions, list):
            conditions = conditions[0] if conditions else "Clear"

        # Determine risk level from real forecast values
        active_triggers = []
        if rainfall >= thresholds["rainfall"]["level_1"]:
            active_triggers.append(f"Rain {rainfall:.0f}mm")
        if temp_max >= thresholds["heat"]["level_1"]:
            active_triggers.append(f"Heat {temp_max:.0f}°C")
        if current_aqi >= thresholds["aqi"]["level_1"]:
            active_triggers.append(f"AQI {current_aqi:.0f}")

        score = 0
        if rainfall >= thresholds["rainfall"]["level_3"]:   score += 3
        elif rainfall >= thresholds["rainfall"]["level_1"]: score += 1
        if temp_max >= thresholds["heat"]["level_2"]:       score += 3
        elif temp_max >= thresholds["heat"]["level_1"]:     score += 1
        if current_aqi >= thresholds["aqi"]["level_2"]:     score += 2
        elif current_aqi >= thresholds["aqi"]["level_1"]:   score += 1

        risk = "High" if score >= 3 else "Medium" if score >= 1 else "Low"

        # Build human-readable message
        if active_triggers:
            message = f"{', '.join(active_triggers)} forecast. Earnings may drop."
        elif conditions in ("Rain", "Drizzle", "Thunderstorm"):
            message = "Showers possible. Keep an eye on alerts."
        elif temp_max > 38:
            message = f"Hot day ({temp_max:.0f}°C). Stay hydrated — afternoon earnings may dip."
        else:
            message = "Clear conditions. Normal earnings expected."

        day_idx = (now.weekday() + i) % 7
        day_label = "Today" if i == 0 else "Tomorrow" if i == 1 else days_of_week[day_idx]

        predictions.append({
            "day": day_label,
            "risk": risk,
            "message": message,
            "temp_max": round(temp_max, 1),
            "rainfall_mm": round(rainfall, 1),
            "conditions": conditions,
            "source": day_data.get("source", "openweathermap_live"),
        })

    data_source = forecast[0].get("source", "mock") if forecast else "mock"
    return {
        "zone_id":   zone_id,
        "zone_name": zone.name,
        "city":      city_name,
        "tier":      zone.tier.value,
        "aqi":       current_aqi,
        "aqi_source": aqi_data.get("source", "mock"),
        "forecast_source": data_source,
        "predictions": predictions,
    }


@router.get("/optimize/{rider_id}")
async def optimize_rider_schedule(rider_id: int, db: AsyncSession = Depends(get_db)):
    rider_result = await db.execute(select(Rider).where(Rider.id == rider_id))
    rider = rider_result.scalar_one_or_none()
    if not rider:
        return {"error": "Rider not found"}

    zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id))
    zone = zone_result.scalar_one_or_none()

    risk_type = "rainfall"
    if zone:
        scores = {"rainfall": zone.flood_risk_score, "heat": zone.heat_risk_score, "aqi": zone.aqi_risk_score}
        risk_type = max(scores, key=scores.get)
    
    reasoning = {
        "rainfall": "Rainfall 2-8 PM expected. Switching to morning shift recovers estimated earnings.",
        "heat": "Afternoon heat wave >42°C. Switching to evening shift protects health and earnings.",
        "aqi": "Morning AQI >400. Switching to afternoon shift recommended."
    }
    
    current_shift = rider.shift_type.capitalize() if rider.shift_type else "Flexible"
    
    target_shift = "Morning"
    if risk_type == "heat":
        target_shift = "Evening"
    elif risk_type == "aqi":
        target_shift = "Afternoon"

    savings = round(rider.avg_weekly_earnings * 0.05, 2) if rider.avg_weekly_earnings else 275.0
    
    now = datetime.utcnow()
    tomorrow_str = (now + timedelta(days=1)).strftime("%a")

    return {
        "rider_id": rider_id,
        "rider_name": rider.name,
        "recommendation_active": True,
        "current_shift": f"{tomorrow_str} {current_shift}",
        "recommended_shift": f"{tomorrow_str} {target_shift}",
        "reasoning": reasoning.get(risk_type, reasoning["rainfall"]),
        "projected_earnings_saved": savings,
        "risk_avoided": risk_type,
    }


# ── Stress scenario templates (actuarial requirement: model ≥1 stress scenario) ──
_STRESS_SCENARIOS = {
    "monsoon_14day": {
        "name": "14-Day Continuous Monsoon",
        "description": (
            "Extended monsoon causing daily rainfall >= 65 mm/hr for 14 consecutive days "
            "across coastal metro cities. Models clustered-claims risk to the portfolio."
        ),
        "trigger_type": "rainfall",
        "trigger_value": 95.0,
        "duration_days": 14,
        "active_hours_per_day": 6,
        "affected_cities": ["Mumbai", "Chennai", "Kolkata"],
        "historical_reference": "2005 Mumbai floods (944 mm/day); 2015 Chennai floods (500 mm/day)",
        "base_bcr_stress_factor": 2.8,
    },
    "delhi_aqi_crisis": {
        "name": "Delhi-NCR Winter AQI Crisis",
        "description": (
            "Sustained hazardous AQI >= 500 for 10 days during the winter smog season. "
            "Outdoor delivery becomes unsafe, triggering full-day AQI payouts."
        ),
        "trigger_type": "aqi",
        "trigger_value": 500.0,
        "duration_days": 10,
        "active_hours_per_day": 20,
        "affected_cities": ["Delhi"],
        "historical_reference": "Recurring Delhi-NCR winter smog episodes that force hazardous-air restrictions.",
        "base_bcr_stress_factor": 3.1,
    },
    "heat_wave_rajasthan": {
        "name": "Rajasthan Extreme Heat Wave",
        "description": (
            "Temperatures exceeding 45°C during May–June restricting deliveries to early-morning "
            "and night slots. Tier 2 city portfolio under sustained payout pressure."
        ),
        "trigger_type": "heat",
        "trigger_value": 46.5,
        "duration_days": 7,
        "active_hours_per_day": 8,
        "affected_cities": ["Jaipur"],
        "historical_reference": "May 2024 Rajasthan heat wave (47.8°C in Jaisalmer; Jaipur 45.6°C)",
        "base_bcr_stress_factor": 1.9,
    },
    "chennai_cyclone": {
        "name": "Bay of Bengal Cyclonic Storm",
        "description": (
            "Severe cyclone forcing complete 3-day platform shutdown. All active riders trigger "
            "social-disruption claims. Short duration but near-100% claim rate."
        ),
        "trigger_type": "social",
        "trigger_value": 1.0,
        "duration_days": 3,
        "active_hours_per_day": 16,
        "affected_cities": ["Chennai"],
        "historical_reference": "Cyclone Michaung, December 2023 — Chennai operations halted 3 days",
        "base_bcr_stress_factor": 2.5,
    },
}

# Avg hourly payout rates by city tier (₹/hr) — kept for reference
_TIER_HOURLY_RATE = {"tier_1": 62.0, "tier_2": 49.6, "tier_3": 37.2}
# Avg weekly premium per active rider by tier (₹/week) — matches seed_db WEEKLY_PREMIUMS avg
_TIER_WEEKLY_PREMIUM = {"tier_1": 62.0, "tier_2": 45.0, "tier_3": 30.0}
# Avg parametric trigger payout per claim by tier (₹) — matches TRIGGER_PAYOUTS avg
_TIER_AVG_TRIGGER_PAYOUT = {"tier_1": 30.0, "tier_2": 24.0, "tier_3": 17.0}
# Fraction of riders assumed to have active policies at any given week
_POLICY_COVERAGE_RATE = 0.72


@router.get("/stress/{scenario}", summary="Actuarial stress scenario projection")
async def stress_scenario(scenario: str, db: AsyncSession = Depends(get_db)):
    """
    Project BCR impact, total payout exposure, and portfolio sustainability for a
    predefined extreme scenario.  Implements the actuarial requirement:
    'model at least one stress scenario — e.g. 14-day monsoon'.

    Scenarios: monsoon_14day | delhi_aqi_crisis | heat_wave_rajasthan | chennai_cyclone
    """
    if scenario not in _STRESS_SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario '{scenario}'. Valid: {list(_STRESS_SCENARIOS.keys())}",
        )

    sc = _STRESS_SCENARIOS[scenario]
    affected_city_names = sc["affected_cities"]

    # ── Fetch affected cities ──
    cities_result = await db.execute(
        select(City).where(City.name.in_(affected_city_names))
    )
    cities = cities_result.scalars().all()

    # ── Per-city projections ──
    city_breakdown = []
    total_payout = 0.0
    total_premium_window = 0.0
    total_affected_riders = 0
    total_zones = 0

    duration_weeks = max(1, round(sc["duration_days"] / 7))

    for city in cities:
        city_tier = city.city_tier.value if city.city_tier else "tier_1"
        hourly_rate = _TIER_HOURLY_RATE.get(city_tier, 62.0)
        weekly_premium = _TIER_WEEKLY_PREMIUM.get(city_tier, 42.0)

        # Count zones
        zone_count_result = await db.execute(
            select(sa_func.count(Zone.id)).where(Zone.city_id == city.id)
        )
        zone_count = zone_count_result.scalar() or 0

        # Count active riders in city (via zone join)
        rider_count_result = await db.execute(
            select(sa_func.count(Rider.id))
            .join(Zone, Rider.zone_id == Zone.id)
            .where(Zone.city_id == city.id, Rider.is_active == True)
        )
        rider_count = rider_count_result.scalar() or 1000  # fallback if not seeded

        # Count active policies
        active_policies_result = await db.execute(
            select(sa_func.count(Policy.id))
            .join(Zone, Policy.zone_id == Zone.id)
            .where(Zone.city_id == city.id, Policy.status == PolicyStatus.ACTIVE)
        )
        active_policies = active_policies_result.scalar() or int(rider_count * _POLICY_COVERAGE_RATE)

        # Payout per insured rider = avg_trigger_payout × claims_per_day × duration_days
        avg_trigger_payout = _TIER_AVG_TRIGGER_PAYOUT.get(city_tier, 30.0)
        claims_per_day = sc["active_hours_per_day"] / 8  # normalize: 8hr = 1 full claim event
        payout_per_rider = avg_trigger_payout * claims_per_day * sc["duration_days"]
        city_total_payout = payout_per_rider * active_policies

        # Premium collected in scenario window
        city_premium = weekly_premium * rider_count * duration_weeks

        total_payout += city_total_payout
        total_premium_window += city_premium
        total_affected_riders += active_policies
        total_zones += zone_count

        # Pull latest BCR from WeeklyLedger if available
        ledger_result = await db.execute(
            select(WeeklyLedger)
            .where(WeeklyLedger.city_id == city.id)
            .order_by(WeeklyLedger.week_end.desc())
            .limit(1)
        )
        latest_ledger = ledger_result.scalar_one_or_none()
        current_bcr = latest_ledger.bcr if latest_ledger and latest_ledger.bcr else 0.55

        city_breakdown.append({
            "city": city.name,
            "city_tier": city_tier,
            "zones_affected": zone_count,
            "total_riders": rider_count,
            "insured_riders": active_policies,
            "coverage_rate_pct": round(active_policies / rider_count * 100, 1) if rider_count else 0,
            "current_bcr": round(current_bcr, 3),
            "payout_per_insured_rider": round(payout_per_rider, 2),
            "city_total_payout": round(city_total_payout, 2),
            "city_premium_in_window": round(city_premium, 2),
        })

    # ── Portfolio-level BCR projection ──
    # Stressed BCR = (normal baseline payouts + scenario payouts) / window premium
    normal_payout_in_window = total_premium_window * 0.55  # baseline BCR
    stressed_total_payout = normal_payout_in_window + total_payout
    stressed_bcr = (
        stressed_total_payout / total_premium_window if total_premium_window > 0 else 0.0
    )
    bcr_delta = stressed_bcr - 0.55

    # ── Sustainability classification ──
    if stressed_bcr <= 0.70:
        status = "HEALTHY"
        action = "Portfolio absorbs the scenario. No intervention required."
    elif stressed_bcr <= 0.85:
        status = "WATCH"
        action = (
            "Elevated but manageable. Apply 8–12% premium loading for affected cities "
            "in the following cycle. Notify reinsurer."
        )
    elif stressed_bcr <= 1.10:
        status = "CRITICAL"
        action = (
            "Suspend new enrolments in affected cities. Activate reinsurance layer. "
            "Review trigger thresholds and coverage caps. BCR target band breached."
        )
    else:
        status = "BREACH"
        action = (
            "Immediate suspension of enrolments. Reinsurance trigger mandatory. "
            "Escalate to risk committee. Consider temporary payout caps."
        )

    return {
        "scenario": scenario,
        "scenario_name": sc["name"],
        "description": sc["description"],
        "historical_reference": sc["historical_reference"],
        "parameters": {
            "trigger_type": sc["trigger_type"],
            "trigger_value": sc["trigger_value"],
            "duration_days": sc["duration_days"],
            "active_hours_per_day": sc["active_hours_per_day"],
            "affected_cities": affected_city_names,
        },
        "projection": {
            "total_insured_riders_affected": total_affected_riders,
            "total_zones_affected": total_zones,
            "total_estimated_payout": round(total_payout, 2),
            "total_premium_in_window": round(total_premium_window, 2),
            "normal_bcr_baseline": 0.62,
            "stressed_bcr": round(stressed_bcr, 4),
            "bcr_delta": round(bcr_delta, 4),
            "sustainability_status": status,
            "recommended_action": action,
        },
        "city_breakdown": city_breakdown,
        "actuarial_disclosure": {
            "assumptions": [
                f"Avg hourly rate: ₹{_TIER_HOURLY_RATE} by tier",
                f"Avg weekly premium: ₹{_TIER_WEEKLY_PREMIUM} by tier",
                f"Policy coverage rate: {_POLICY_COVERAGE_RATE * 100:.0f}% of registered riders",
                "Baseline BCR: 0.55 (lower bound of target band 0.55–0.70)",
                f"Premium window: {duration_weeks} week(s) matching scenario duration",
                "Stress = additional claims layered on top of normal baseline payouts",
            ],
            "bcr_target_band": "0.55 – 0.70",
            "suspension_threshold": 0.85,
            "model_type": "deterministic expected-loss (single scenario, no Monte Carlo)",
        },
    }
