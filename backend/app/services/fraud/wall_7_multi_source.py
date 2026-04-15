"""Wall 7 — Multi-Source Event Verification (0-15 pts). Cross-reference trigger with multiple APIs."""

from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Rider, RiderActivity, TriggerReading
from app.services import mock_external

TRIGGER_THRESHOLDS = {
    "rainfall_mm": 65.0,
    "temperature_c": 44.0,
    "visibility_m": 500,
    "aqi": 500,
    "traffic_speed_kmh": 10.0,
}
MIN_SOURCES = 2


async def check_multi_source_verification(db: AsyncSession, rider_id: int, trigger_reading: TriggerReading) -> dict:
    zone_id = trigger_reading.zone_id
    trigger_type = trigger_reading.trigger_type
    trigger_str = trigger_type.value if hasattr(trigger_type, 'value') else str(trigger_type)

    sources_checked = 0
    sources_confirmed = 0
    source_details = []

    # Source 1: Primary API
    sources_checked += 1
    primary = _check_primary(zone_id, trigger_str)
    if primary["confirmed"]:
        sources_confirmed += 1
    source_details.append({"source": "primary_api", **primary})

    # Source 2: Secondary cross-reference
    sources_checked += 1
    secondary = _check_secondary(zone_id, trigger_str)
    if secondary["confirmed"]:
        sources_confirmed += 1
    source_details.append({"source": "secondary_api", **secondary})

    # Source 3: Peer behavior
    sources_checked += 1
    peer = await _check_peer_behavior(db, zone_id, trigger_reading)
    if peer["confirmed"]:
        sources_confirmed += 1
    source_details.append({"source": "peer_behavior", **peer})

    issues = []
    score = 0.0

    if sources_confirmed >= MIN_SOURCES:
        score = 0.0
    elif sources_confirmed == 1:
        score = 8.0
        issues.append(f"Only {sources_confirmed}/{sources_checked} sources confirm the event")
    else:
        score = 15.0
        issues.append("No independent sources confirm the disruption")

    score = min(score, 15.0)
    return {"passed": score < 8.0, "score": round(score, 1), "details": {
        "sources_checked": sources_checked,
        "sources_confirmed": sources_confirmed,
        "source_details": source_details,
        "issues": issues,
    }}


def _check_primary(zone_id, trigger_str):
    if trigger_str == "rainfall":
        w = mock_external.get_weather(zone_id)
        confirmed = w["rainfall_mm"] >= TRIGGER_THRESHOLDS["rainfall_mm"]
        return {"confirmed": confirmed, "data": {"type": "weather", "value": w["rainfall_mm"]}}
    elif trigger_str == "aqi":
        a = mock_external.get_aqi(zone_id)
        confirmed = a["aqi_value"] >= TRIGGER_THRESHOLDS["aqi"]
        return {"confirmed": confirmed, "data": {"type": "aqi", "value": a["aqi_value"]}}
    elif trigger_str == "traffic":
        t = mock_external.get_traffic(zone_id)
        confirmed = t["avg_speed_kmh"] <= TRIGGER_THRESHOLDS["traffic_speed_kmh"]
        return {"confirmed": confirmed, "data": {"type": "traffic", "value": t["avg_speed_kmh"]}}
    elif trigger_str == "social":
        s = mock_external.get_social_disruptions(zone_id)
        return {"confirmed": s["bandh_active"], "data": {"type": "social", "bandh_active": s["bandh_active"]}}
    return {"confirmed": True, "data": {"type": "unknown"}}


def _check_secondary(zone_id, trigger_str):
    if trigger_str in ("rainfall", "heat", "cold_fog"):
        t = mock_external.get_traffic(zone_id)
        confirmed = t["avg_speed_kmh"] < 20
        return {"confirmed": confirmed, "data": {"type": "traffic_crosscheck", "avg_speed": t["avg_speed_kmh"]}}
    elif trigger_str == "aqi":
        w = mock_external.get_weather(zone_id)
        confirmed = w["visibility_m"] < 2000
        return {"confirmed": confirmed, "data": {"type": "visibility_crosscheck", "visibility_m": w["visibility_m"]}}
    else:
        w = mock_external.get_weather(zone_id)
        confirmed = w["rainfall_mm"] > 20 or w["visibility_m"] < 1000
        return {"confirmed": confirmed, "data": {"type": "weather_crosscheck"}}


async def _check_peer_behavior(db: AsyncSession, zone_id: int, trigger_reading: TriggerReading):
    trigger_date = trigger_reading.timestamp.replace(hour=0, minute=0, second=0)
    riders_result = await db.execute(
        select(Rider).where(Rider.zone_id == zone_id, Rider.is_active == True)
    )
    zone_riders = riders_result.scalars().all()
    total = len(zone_riders)
    stopped = 0

    for r in zone_riders:
        act_result = await db.execute(
            select(RiderActivity).where(
                RiderActivity.rider_id == r.id,
                RiderActivity.date >= trigger_date,
                RiderActivity.date < trigger_date + timedelta(days=1),
            )
        )
        activity = act_result.scalar_one_or_none()
        if not activity or not activity.is_working or activity.deliveries_completed == 0:
            stopped += 1

    stop_pct = stopped / total if total > 0 else 0
    return {"confirmed": stop_pct >= 0.5, "data": {"total_riders": total, "stopped": stopped, "stop_pct": round(stop_pct * 100, 1)}}
