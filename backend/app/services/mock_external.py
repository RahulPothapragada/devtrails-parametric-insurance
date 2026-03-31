"""
Mock External Services — simulates Weather, AQI, Traffic, and Social disruption APIs.
In production these would call OpenWeatherMap, CPCB/WAQI, TomTom, NewsAPI.
Each service can be put into "disruption mode" for demo/testing.
"""

import random
from datetime import datetime, timezone

_active_disruptions: dict = {}


def set_disruption(zone_id: int, trigger_type: str, value: float):
    if zone_id not in _active_disruptions:
        _active_disruptions[zone_id] = {}
    _active_disruptions[zone_id][trigger_type] = value


def clear_disruptions(zone_id: int = None):
    if zone_id:
        _active_disruptions.pop(zone_id, None)
    else:
        _active_disruptions.clear()


def get_override(zone_id: int, trigger_type: str):
    return _active_disruptions.get(zone_id, {}).get(trigger_type)


def get_weather(zone_id: int, zone_name: str = "") -> dict:
    override_rain = get_override(zone_id, "rainfall")
    rainfall = override_rain if override_rain is not None else random.choices(
        [0, 5, 15, 30, 45], weights=[50, 25, 15, 7, 3], k=1
    )[0]

    override_heat = get_override(zone_id, "heat")
    temperature = override_heat if override_heat is not None else random.uniform(26, 36)

    override_fog = get_override(zone_id, "cold_fog")
    visibility = override_fog if override_fog is not None else random.uniform(2000, 10000)

    return {
        "zone_id": zone_id,
        "zone_name": zone_name,
        "rainfall_mm": round(rainfall, 1),
        "temperature_c": round(temperature, 1),
        "humidity_pct": random.randint(60, 95),
        "visibility_m": round(visibility, 0),
        "wind_speed_kmh": round(random.uniform(5, 40), 1),
        "source": "mock_openweathermap",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def get_aqi(zone_id: int, zone_name: str = "") -> dict:
    override = get_override(zone_id, "aqi")
    aqi_value = override if override is not None else random.choices(
        [50, 80, 120, 160, 220, 300], weights=[20, 30, 25, 15, 8, 2], k=1
    )[0]

    if aqi_value <= 50:
        category = "Good"
    elif aqi_value <= 100:
        category = "Satisfactory"
    elif aqi_value <= 200:
        category = "Moderate"
    elif aqi_value <= 300:
        category = "Poor"
    else:
        category = "Very Poor"

    return {
        "zone_id": zone_id,
        "zone_name": zone_name,
        "aqi_value": round(aqi_value),
        "category": category,
        "pm25": round(random.uniform(30, aqi_value * 0.8), 1),
        "pm10": round(random.uniform(40, aqi_value * 1.2), 1),
        "source": "mock_cpcb_waqi",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def get_traffic(zone_id: int, zone_name: str = "") -> dict:
    override = get_override(zone_id, "traffic")
    avg_speed = override if override is not None else random.choices(
        [8, 12, 16, 22, 30], weights=[5, 20, 35, 30, 10], k=1
    )[0]

    if avg_speed < 10:
        congestion = "Gridlock"
    elif avg_speed < 15:
        congestion = "Heavy"
    elif avg_speed < 25:
        congestion = "Moderate"
    else:
        congestion = "Light"

    return {
        "zone_id": zone_id,
        "zone_name": zone_name,
        "avg_speed_kmh": round(avg_speed, 1),
        "congestion_level": congestion,
        "travel_time_per_10km_min": round(600 / max(avg_speed, 1), 1),
        "source": "mock_tomtom",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def get_social_disruptions(zone_id: int, zone_name: str = "") -> dict:
    override = get_override(zone_id, "social")
    if override is not None:
        bandh_active = override > 0
        event_type = "Bandh" if bandh_active else "None"
    else:
        bandh_active = random.random() < 0.01
        event_type = "None"
        if bandh_active:
            event_type = random.choice(["Bandh", "Strike", "Protest March"])

    return {
        "zone_id": zone_id,
        "zone_name": zone_name,
        "bandh_active": bandh_active,
        "event_type": event_type,
        "severity": "High" if bandh_active else "None",
        "source": "mock_newsapi",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
