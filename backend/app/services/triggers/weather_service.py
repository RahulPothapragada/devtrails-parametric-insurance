"""
Weather Service — Real data from OpenWeatherMap.

Covers:
  - Current weather (rainfall, temperature, visibility, wind)
  - 5-day / 3-hour forecast aggregated to daily
  - Air pollution (AQI, PM2.5, PM10) — no separate WAQI key needed
    Uses OWM /air_pollution endpoint with the same API key.

Free tier: 1,000 calls/day per endpoint — more than enough for 13 cities.
"""

import httpx
from datetime import datetime, timedelta
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

OWM_BASE = "https://api.openweathermap.org/data/2.5"

# City coordinates for named lookups
CITY_COORDS = {
    "mumbai":    (19.0760, 72.8777),
    "delhi":     (28.6139, 77.2090),
    "bangalore": (12.9716, 77.5946),
    "chennai":   (13.0827, 80.2707),
    "kolkata":   (22.5726, 88.3639),
    "pune":      (18.5204, 73.8567),
    "hyderabad": (17.3850, 78.4867),
    "ahmedabad": (23.0225, 72.5714),
    "jaipur":    (26.9124, 75.7873),
    "lucknow":   (26.8467, 80.9462),
    "indore":    (22.7196, 75.8577),
    "patna":     (25.5941, 85.1376),
    "bhopal":    (23.2599, 77.4126),
}

# OpenWeatherMap AQI index → numeric AQI approximation
# OWM uses 1-5 scale; we map to CPCB-style values for trigger comparison
OWM_AQI_TO_NUMERIC = {1: 50, 2: 100, 3: 200, 4: 300, 5: 450}


class WeatherService:
    """
    Fetches live weather and air quality from OpenWeatherMap.
    Falls back to realistic mock values if the key is missing or the call fails.
    """

    def __init__(self):
        self.api_key = settings.OPENWEATHER_API_KEY

    # ── Current weather ────────────────────────────────────────────

    async def get_current(self, lat: float, lng: float) -> dict:
        if not self.api_key:
            return self._mock_current()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{OWM_BASE}/weather",
                    params={"lat": lat, "lon": lng, "appid": self.api_key, "units": "metric"},
                )
                data = r.json()
            return {
                "temperature":   data["main"]["temp"],
                "feels_like":    data["main"]["feels_like"],
                "humidity":      data["main"]["humidity"],
                "visibility":    data.get("visibility", 10000),
                "wind_speed":    data["wind"]["speed"],
                "rainfall_1h":   data.get("rain", {}).get("1h", 0.0),
                "rainfall_3h":   data.get("rain", {}).get("3h", 0.0),
                "weather_main":  data["weather"][0]["main"],
                "weather_desc":  data["weather"][0]["description"],
                "source":        "openweathermap_live",
            }
        except Exception as e:
            logger.error("OWM current weather error: %s", e)
            return self._mock_current()

    # ── 5-day / 3-hour forecast → daily summaries ─────────────────

    async def get_forecast_7day(self, lat: float, lng: float) -> list[dict]:
        if not self.api_key:
            return self._mock_forecast()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"{OWM_BASE}/forecast",
                    params={"lat": lat, "lon": lng, "appid": self.api_key,
                            "units": "metric", "cnt": 40},
                )
                data = r.json()

            daily: dict[str, dict] = {}
            for entry in data["list"]:
                date = entry["dt_txt"][:10]
                if date not in daily:
                    daily[date] = {
                        "date": date,
                        "temp_min": entry["main"]["temp_min"],
                        "temp_max": entry["main"]["temp_max"],
                        "rainfall_mm": 0.0,
                        "visibility_m": entry.get("visibility", 10000),
                        "conditions": [],
                        "source": "openweathermap_live",
                    }
                daily[date]["temp_min"] = min(daily[date]["temp_min"], entry["main"]["temp_min"])
                daily[date]["temp_max"] = max(daily[date]["temp_max"], entry["main"]["temp_max"])
                daily[date]["rainfall_mm"] += entry.get("rain", {}).get("3h", 0.0)
                # Track worst (lowest) visibility across the day's 3-hour entries
                daily[date]["visibility_m"] = min(daily[date]["visibility_m"], entry.get("visibility", 10000))
                daily[date]["conditions"].append(entry["weather"][0]["main"])

            return list(daily.values())[:7]
        except Exception as e:
            logger.error("OWM forecast error: %s", e)
            return self._mock_forecast()

    # ── Air pollution (AQI + PM2.5 + PM10) ────────────────────────

    async def get_air_quality(self, lat: float, lng: float) -> dict:
        """
        Fetch real AQI via OWM Air Pollution API.
        Returns AQI in CPCB-style numeric scale and raw PM values.
        No separate WAQI key needed — uses the same OWM key.
        """
        if not self.api_key:
            return self._mock_aqi()
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    "http://api.openweathermap.org/data/2.5/air_pollution",
                    params={"lat": lat, "lon": lng, "appid": self.api_key},
                )
                data = r.json()

            item = data["list"][0]
            owm_aqi = item["main"]["aqi"]           # 1-5
            components = item["components"]
            pm25 = components.get("pm2_5", 0.0)
            pm10 = components.get("pm10", 0.0)
            no2  = components.get("no2",  0.0)
            o3   = components.get("o3",   0.0)

            # Convert OWM 1-5 index → approximate CPCB AQI
            # (calibrated to match CPCB breakpoints)
            numeric_aqi = OWM_AQI_TO_NUMERIC.get(owm_aqi, 100)
            # Refine with PM2.5 (dominant Indian pollutant)
            if pm25 > 0:
                numeric_aqi = max(numeric_aqi, _pm25_to_aqi(pm25))

            return {
                "aqi":                numeric_aqi,
                "owm_index":          owm_aqi,
                "pm25":               round(pm25, 1),
                "pm10":               round(pm10, 1),
                "no2":                round(no2, 1),
                "o3":                 round(o3, 1),
                "dominant_pollutant": "pm25" if pm25 > no2 else "no2",
                "source":             "openweathermap_air_pollution",
            }
        except Exception as e:
            logger.error("OWM air pollution error: %s", e)
            return self._mock_aqi()

    async def get_city_air_quality(self, city: str) -> dict:
        """Convenience wrapper — looks up coords by city name."""
        city_key = city.lower()
        coords = CITY_COORDS.get(city_key)
        if coords:
            return await self.get_air_quality(coords[0], coords[1])
        return self._mock_aqi()

    # ── Mock fallbacks ─────────────────────────────────────────────

    def _mock_current(self) -> dict:
        return {
            "temperature": 32.5, "feels_like": 36.2, "humidity": 78,
            "visibility": 8000, "wind_speed": 12.5,
            "rainfall_1h": 0.0, "rainfall_3h": 0.0,
            "weather_main": "Clear", "weather_desc": "clear sky",
            "source": "mock",
        }

    def _mock_forecast(self) -> list[dict]:
        today = datetime.now()
        rainfall = [0, 0, 35, 48, 5, 0, 0]
        conditions = ["Clear", "Clear", "Rain", "Thunderstorm", "Clouds", "Clear", "Clear"]
        return [
            {
                "date": (today + timedelta(days=i)).strftime("%Y-%m-%d"),
                "temp_min": 26 + i % 3,
                "temp_max": 33 + i % 4,
                "rainfall_mm": rainfall[i] if i < 7 else 0,
                "visibility_m": 8000,
                "conditions": conditions[i] if i < 7 else "Clear",
                "source": "mock",
            }
            for i in range(7)
        ]

    def _mock_aqi(self) -> dict:
        return {
            "aqi": 145, "owm_index": 3, "pm25": 55.0, "pm10": 77.0,
            "no2": 25.0, "o3": 60.0, "dominant_pollutant": "pm25",
            "source": "mock",
        }


def _pm25_to_aqi(pm25: float) -> int:
    """Convert PM2.5 µg/m³ to approximate CPCB AQI (Indian standard)."""
    breakpoints = [
        (0,   30,   0,   50),
        (30,  60,   51,  100),
        (60,  90,   101, 200),
        (90,  120,  201, 300),
        (120, 250,  301, 400),
        (250, 500,  401, 500),
    ]
    for c_lo, c_hi, i_lo, i_hi in breakpoints:
        if c_lo <= pm25 <= c_hi:
            return round(i_lo + (pm25 - c_lo) / (c_hi - c_lo) * (i_hi - i_lo))
    return 500
