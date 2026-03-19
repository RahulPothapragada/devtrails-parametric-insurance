"""
LAYER 1: PREDICT — "What Will Happen This Week?"

This is the FIRST differentiator. No other team will have this.

Takes weather forecasts, AQI predictions, traffic patterns, event calendars
and converts them into an EARNINGS IMPACT forecast for each zone.

The rider doesn't see weather. They see: "Wednesday 2-8 PM your zone
will earn 60% less than normal."
"""

from datetime import datetime, timedelta
from typing import Optional
from app.services.triggers.weather_service import WeatherService
from app.services.triggers.aqi_service import AQIService
from app.services.triggers.trigger_engine import TRIGGER_THRESHOLDS
import logging

logger = logging.getLogger(__name__)


# Average hourly earnings by shift block (Zepto Mumbai data)
HOURLY_EARNINGS_BY_BLOCK = {
    "early_morning": {"hours": "6AM-9AM", "avg_rate": 70},    # Low demand
    "morning":       {"hours": "9AM-12PM", "avg_rate": 95},   # Moderate
    "lunch":         {"hours": "12PM-2PM", "avg_rate": 115},  # High demand
    "afternoon":     {"hours": "2PM-5PM", "avg_rate": 85},    # Moderate
    "evening":       {"hours": "5PM-8PM", "avg_rate": 120},   # Peak demand
    "dinner":        {"hours": "8PM-11PM", "avg_rate": 110},  # High demand
    "late_night":    {"hours": "11PM-1AM", "avg_rate": 75},   # Low demand
}


class PredictEngine:
    """
    Generates a 7-day earnings forecast for a rider's zone.

    For each day:
      - Fetches weather/AQI/traffic forecast
      - Maps disruption probability to each time block
      - Calculates expected earnings per block
      - Flags high-risk blocks
      - Identifies which triggers are most likely to fire
    """

    def __init__(self):
        self.weather = WeatherService()
        self.aqi = AQIService()

    async def get_weekly_forecast(
        self,
        zone_lat: float,
        zone_lng: float,
        zone_tier: str,
        city: str,
    ) -> dict:
        """
        Generate a 7-day earnings impact forecast.

        Returns per-day, per-block:
          - Expected earnings (normal vs disrupted)
          - Disruption probability
          - Which triggers are active
          - Risk level (low / medium / high / severe)
        """
        # Fetch 7-day weather forecast
        weather_forecast = await self.weather.get_forecast_7day(zone_lat, zone_lng)

        # Fetch current AQI (forecast AQI is harder, use current as proxy)
        aqi_data = await self.aqi.get_current(city)

        daily_forecasts = []

        for day_data in weather_forecast[:7]:
            day_forecast = self._analyze_day(day_data, aqi_data, zone_tier)
            daily_forecasts.append(day_forecast)

        # Calculate week totals
        total_normal = sum(d["normal_earnings"] for d in daily_forecasts)
        total_predicted = sum(d["predicted_earnings"] for d in daily_forecasts)
        total_loss = total_normal - total_predicted
        insurance_coverage = round(total_loss * 0.65, 0)  # ~65% coverage estimate

        return {
            "zone": {"lat": zone_lat, "lng": zone_lng, "tier": zone_tier},
            "city": city,
            "generated_at": datetime.now().isoformat(),
            "daily": daily_forecasts,
            "weekly_summary": {
                "normal_week_earnings": round(total_normal),
                "predicted_earnings": round(total_predicted),
                "estimated_loss": round(total_loss),
                "insurance_coverage": round(insurance_coverage),
                "net_with_insurance": round(total_predicted + insurance_coverage),
                "recovery_pct": round((total_predicted + insurance_coverage) / max(total_normal, 1) * 100, 1),
                "high_risk_days": sum(1 for d in daily_forecasts if d["risk_level"] in ["high", "severe"]),
            },
        }

    def _analyze_day(self, weather: dict, aqi: dict, zone_tier: str) -> dict:
        """
        Analyze a single day's forecast and map to earnings impact.
        """
        date = weather.get("date", "unknown")
        rainfall = weather.get("rainfall_mm", 0)
        temp_max = weather.get("temp_max", 32)
        temp_min = weather.get("temp_min", 25)
        conditions = weather.get("conditions", "Clear")
        if isinstance(conditions, list):
            conditions = conditions[0] if conditions else "Clear"

        current_aqi = aqi.get("aqi", 100)

        # Determine active triggers and their impact
        active_triggers = []
        earnings_impact = 1.0  # 1.0 = no impact, 0.0 = total shutdown

        # Rainfall impact
        if rainfall > TRIGGER_THRESHOLDS["rainfall"]["level_3"]:
            active_triggers.append({"type": "rainfall", "severity": "severe", "value": rainfall})
            earnings_impact *= 0.1  # 90% earnings loss
        elif rainfall > TRIGGER_THRESHOLDS["rainfall"]["level_2"]:
            active_triggers.append({"type": "rainfall", "severity": "high", "value": rainfall})
            earnings_impact *= 0.35  # 65% loss
        elif rainfall > TRIGGER_THRESHOLDS["rainfall"]["level_1"]:
            active_triggers.append({"type": "rainfall", "severity": "moderate", "value": rainfall})
            earnings_impact *= 0.65  # 35% loss

        # Heat impact
        if temp_max > TRIGGER_THRESHOLDS["heat"]["level_3"]:
            active_triggers.append({"type": "heat", "severity": "severe", "value": temp_max})
            earnings_impact *= 0.2
        elif temp_max > TRIGGER_THRESHOLDS["heat"]["level_2"]:
            active_triggers.append({"type": "heat", "severity": "high", "value": temp_max})
            earnings_impact *= 0.5
        elif temp_max > TRIGGER_THRESHOLDS["heat"]["level_1"]:
            active_triggers.append({"type": "heat", "severity": "moderate", "value": temp_max})
            earnings_impact *= 0.75

        # AQI impact (using current as proxy for forecast)
        if current_aqi > TRIGGER_THRESHOLDS["aqi"]["level_3"]:
            active_triggers.append({"type": "aqi", "severity": "severe", "value": current_aqi})
            earnings_impact *= 0.3
        elif current_aqi > TRIGGER_THRESHOLDS["aqi"]["level_2"]:
            active_triggers.append({"type": "aqi", "severity": "high", "value": current_aqi})
            earnings_impact *= 0.55
        elif current_aqi > TRIGGER_THRESHOLDS["aqi"]["level_1"]:
            active_triggers.append({"type": "aqi", "severity": "moderate", "value": current_aqi})
            earnings_impact *= 0.8

        # Zone tier modifier (high-risk zones lose more per event)
        tier_modifier = {"high": 0.85, "medium": 0.92, "low": 1.0}
        earnings_impact *= tier_modifier.get(zone_tier, 0.92)

        # Calculate per-block earnings
        blocks = []
        day_normal = 0
        day_predicted = 0

        for block_name, block_data in HOURLY_EARNINGS_BY_BLOCK.items():
            normal = block_data["avg_rate"]
            # Rain typically impacts afternoon/evening more
            block_impact = earnings_impact
            if rainfall > 15 and block_name in ["afternoon", "evening", "dinner"]:
                block_impact *= 0.7  # Extra hit to peak rain hours
            elif rainfall > 15 and block_name in ["early_morning", "morning"]:
                block_impact = min(block_impact * 1.2, 1.0)  # Mornings slightly better

            predicted = round(normal * block_impact)
            blocks.append({
                "block": block_name,
                "hours": block_data["hours"],
                "normal_earnings": normal,
                "predicted_earnings": predicted,
                "impact_pct": round((1 - block_impact) * 100),
                "risk": "high" if block_impact < 0.5 else "moderate" if block_impact < 0.8 else "low",
            })
            day_normal += normal
            day_predicted += predicted

        # Overall risk level for the day
        if earnings_impact < 0.25:
            risk_level = "severe"
        elif earnings_impact < 0.5:
            risk_level = "high"
        elif earnings_impact < 0.8:
            risk_level = "moderate"
        else:
            risk_level = "low"

        return {
            "date": date,
            "conditions": conditions,
            "risk_level": risk_level,
            "earnings_impact_pct": round((1 - earnings_impact) * 100),
            "active_triggers": active_triggers,
            "normal_earnings": round(day_normal),
            "predicted_earnings": round(day_predicted),
            "loss": round(day_normal - day_predicted),
            "blocks": blocks,
        }
