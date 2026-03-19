"""
AQI Service — Air Quality Index monitoring.
Uses WAQI (aqicn.org) API — free tier with token.
"""

import httpx
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

WAQI_BASE = "https://api.waqi.info"


class AQIService:
    """Fetches real-time AQI data for Indian cities."""

    def __init__(self):
        self.api_key = settings.WAQI_API_KEY

    async def get_current(self, city: str) -> dict:
        """Get current AQI for a city."""
        if not self.api_key:
            return self._mock_aqi(city)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{WAQI_BASE}/feed/{city}/",
                    params={"token": self.api_key},
                    timeout=10.0,
                )
                data = response.json()

            if data["status"] == "ok":
                aqi_data = data["data"]
                return {
                    "aqi": aqi_data["aqi"],
                    "pm25": aqi_data.get("iaqi", {}).get("pm25", {}).get("v", 0),
                    "pm10": aqi_data.get("iaqi", {}).get("pm10", {}).get("v", 0),
                    "dominant_pollutant": aqi_data.get("dominentpol", "pm25"),
                    "station": aqi_data.get("city", {}).get("name", city),
                    "source": "waqi",
                }
            return self._mock_aqi(city)

        except Exception as e:
            logger.error(f"WAQI API error: {e}")
            return self._mock_aqi(city)

    def _mock_aqi(self, city: str) -> dict:
        """Mock AQI data for development."""
        # Realistic mock values by city
        mock_values = {
            "mumbai": {"aqi": 145, "pm25": 55},
            "delhi": {"aqi": 380, "pm25": 210},
            "bangalore": {"aqi": 95, "pm25": 35},
            "chennai": {"aqi": 110, "pm25": 42},
            "kolkata": {"aqi": 175, "pm25": 75},
        }
        city_lower = city.lower()
        values = mock_values.get(city_lower, {"aqi": 120, "pm25": 45})

        return {
            "aqi": values["aqi"],
            "pm25": values["pm25"],
            "pm10": values["pm25"] * 1.4,
            "dominant_pollutant": "pm25",
            "station": f"{city} Central",
            "source": "mock",
        }
