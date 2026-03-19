"""
Weather Service — Handles rainfall, heat, cold/fog triggers.
Uses OpenWeatherMap API (free tier: 1000 calls/day).
"""

import httpx
from typing import Optional
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"


class WeatherService:
    """
    Fetches current weather + 7-day forecast for any zone.
    Returns structured data for trigger evaluation.
    """

    def __init__(self):
        self.api_key = settings.OPENWEATHER_API_KEY

    async def get_current(self, lat: float, lng: float) -> dict:
        """
        Get current weather for a location.
        Returns: rainfall_mm, temperature, humidity, visibility, wind_speed
        """
        if not self.api_key:
            logger.warning("No OpenWeather API key — returning mock data")
            return self._mock_current()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{OPENWEATHER_BASE}/weather",
                    params={
                        "lat": lat,
                        "lon": lng,
                        "appid": self.api_key,
                        "units": "metric",
                    },
                    timeout=10.0,
                )
                data = response.json()

            return {
                "temperature": data["main"]["temp"],
                "feels_like": data["main"]["feels_like"],
                "humidity": data["main"]["humidity"],
                "visibility": data.get("visibility", 10000),  # meters
                "wind_speed": data["wind"]["speed"],
                "rainfall_1h": data.get("rain", {}).get("1h", 0),
                "rainfall_3h": data.get("rain", {}).get("3h", 0),
                "weather_main": data["weather"][0]["main"],
                "weather_desc": data["weather"][0]["description"],
                "source": "openweathermap",
            }
        except Exception as e:
            logger.error(f"OpenWeather API error: {e}")
            return self._mock_current()

    async def get_forecast_7day(self, lat: float, lng: float) -> list:
        """
        Get 7-day forecast for the PREDICT layer.
        Returns daily: expected rainfall, temp range, conditions.
        """
        if not self.api_key:
            return self._mock_forecast()

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{OPENWEATHER_BASE}/forecast",
                    params={
                        "lat": lat,
                        "lon": lng,
                        "appid": self.api_key,
                        "units": "metric",
                        "cnt": 40,  # 5-day / 3-hour forecast (free tier limit)
                    },
                    timeout=10.0,
                )
                data = response.json()

            # Aggregate 3-hourly data into daily summaries
            daily = {}
            for entry in data["list"]:
                date = entry["dt_txt"][:10]
                if date not in daily:
                    daily[date] = {
                        "date": date,
                        "temp_min": entry["main"]["temp_min"],
                        "temp_max": entry["main"]["temp_max"],
                        "rainfall_mm": 0,
                        "conditions": [],
                    }
                daily[date]["temp_min"] = min(daily[date]["temp_min"], entry["main"]["temp_min"])
                daily[date]["temp_max"] = max(daily[date]["temp_max"], entry["main"]["temp_max"])
                daily[date]["rainfall_mm"] += entry.get("rain", {}).get("3h", 0)
                daily[date]["conditions"].append(entry["weather"][0]["main"])

            return list(daily.values())
        except Exception as e:
            logger.error(f"OpenWeather forecast error: {e}")
            return self._mock_forecast()

    def _mock_current(self) -> dict:
        """Mock weather data for development/demo."""
        return {
            "temperature": 32.5,
            "feels_like": 36.2,
            "humidity": 78,
            "visibility": 8000,
            "wind_speed": 12.5,
            "rainfall_1h": 0,
            "rainfall_3h": 0,
            "weather_main": "Clear",
            "weather_desc": "clear sky",
            "source": "mock",
        }

    def _mock_forecast(self) -> list:
        """Mock 7-day forecast for development/demo."""
        from datetime import datetime, timedelta
        today = datetime.now()
        return [
            {
                "date": (today + timedelta(days=i)).strftime("%Y-%m-%d"),
                "temp_min": 26 + i % 3,
                "temp_max": 33 + i % 4,
                "rainfall_mm": [0, 0, 35, 48, 5, 0, 0][i] if i < 7 else 0,
                "conditions": ["Clear", "Clear", "Rain", "Thunderstorm", "Clouds", "Clear", "Clear"][i] if i < 7 else "Clear",
            }
            for i in range(7)
        ]
