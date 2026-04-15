"""
AQI Service — delegates to WeatherService.get_air_quality().

OpenWeatherMap's /air_pollution endpoint provides AQI + PM2.5 + PM10
using the same API key as weather — no separate WAQI token needed.
Falls back to WAQI if configured, then to mock.
"""

import httpx
from app.core.config import settings
from app.services.triggers.weather_service import WeatherService, CITY_COORDS
import logging

logger = logging.getLogger(__name__)

_weather = WeatherService()


class AQIService:
    """Fetches real-time AQI for Indian cities."""

    def __init__(self):
        self.waqi_key = settings.WAQI_API_KEY

    async def get_current(self, city: str) -> dict:
        # 1. Try OWM air pollution (same key as weather — always preferred)
        result = await _weather.get_city_air_quality(city)
        if result.get("source") != "mock":
            return result

        # 2. WAQI fallback if configured
        if self.waqi_key:
            result = await self._waqi(city)
            if result:
                return result

        # 3. Static mock
        return self._mock_aqi(city)

    async def _waqi(self, city: str) -> dict | None:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                r = await client.get(
                    f"https://api.waqi.info/feed/{city}/",
                    params={"token": self.waqi_key},
                )
                data = r.json()
            if data["status"] == "ok":
                d = data["data"]
                return {
                    "aqi":                d["aqi"],
                    "pm25":               d.get("iaqi", {}).get("pm25", {}).get("v", 0),
                    "pm10":               d.get("iaqi", {}).get("pm10", {}).get("v", 0),
                    "dominant_pollutant": d.get("dominentpol", "pm25"),
                    "source":             "waqi_live",
                }
        except Exception as e:
            logger.error("WAQI error: %s", e)
        return None

    def _mock_aqi(self, city: str) -> dict:
        defaults = {
            "mumbai": 145, "delhi": 380, "bangalore": 95,
            "chennai": 110, "kolkata": 175,
        }
        aqi = defaults.get(city.lower(), 120)
        return {
            "aqi": aqi, "pm25": round(aqi * 0.38, 1), "pm10": round(aqi * 0.53, 1),
            "dominant_pollutant": "pm25", "source": "mock",
        }
