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
from app.services.ml_models import ml
from app.services.pricing.pricing_engine import zone_tier_to_weekly_cap, CITY_TIER_CODES
from app.services.triggers.trigger_engine import get_trigger_thresholds
import logging

logger = logging.getLogger(__name__)


# Average hourly earnings by shift block (Zepto Mumbai data)
HOURLY_EARNINGS_BY_BLOCK = {
    "early_morning": {"hours": "6AM-9AM",   "avg_rate": 100},  # Low demand
    "morning":       {"hours": "9AM-12PM",  "avg_rate": 130},  # Moderate
    "lunch":         {"hours": "12PM-2PM",  "avg_rate": 160},  # High demand
    "afternoon":     {"hours": "2PM-5PM",   "avg_rate": 120},  # Moderate
    "evening":       {"hours": "5PM-8PM",   "avg_rate": 180},  # Peak demand
    "dinner":        {"hours": "8PM-11PM",  "avg_rate": 170},  # High demand
    "late_night":    {"hours": "11PM-1AM",  "avg_rate": 90},   # Low demand
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
        city_tier = CITY_TIER_CODES.get(city.lower(), "tier_1")
        weekly_cap = zone_tier_to_weekly_cap(zone_tier, city_tier)
        insurance_coverage = 0.0
        if total_loss > 75:
            insurance_coverage = min(round(total_loss * 0.50, 0), weekly_cap)

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
        visibility_m = weather.get("visibility_m", 10000)
        conditions = weather.get("conditions", "Clear")
        if isinstance(conditions, list):
            conditions = conditions[0] if conditions else "Clear"

        current_aqi = aqi.get("aqi", 100)
        try:
            forecast_month = datetime.fromisoformat(str(date)).month
        except ValueError:
            forecast_month = datetime.now().month
        thresholds = get_trigger_thresholds(forecast_month)
        zone_tier_enc = ml.zone_tier_to_enc(zone_tier)

        # Determine active triggers and their impact
        active_triggers = []
        earnings_impact = ml.predict_earnings_impact(
            rainfall_mm=rainfall,
            temp_max=temp_max,
            aqi=current_aqi,
            zone_tier_enc=zone_tier_enc,
        )

        # Rainfall impact
        if rainfall >= thresholds["rainfall"]["level_4"]:
            active_triggers.append({"type": "rainfall", "severity": "severe", "value": rainfall})
        elif rainfall >= thresholds["rainfall"]["level_3"]:
            active_triggers.append({"type": "rainfall", "severity": "high", "value": rainfall})
        elif rainfall >= thresholds["rainfall"]["level_1"]:
            active_triggers.append({"type": "rainfall", "severity": "moderate", "value": rainfall})

        # Heat impact
        if temp_max >= thresholds["heat"]["level_3"]:
            active_triggers.append({"type": "heat", "severity": "severe", "value": temp_max})
        elif temp_max >= thresholds["heat"]["level_2"]:
            active_triggers.append({"type": "heat", "severity": "high", "value": temp_max})
        elif temp_max >= thresholds["heat"]["level_1"]:
            active_triggers.append({"type": "heat", "severity": "moderate", "value": temp_max})

        # AQI impact (using current as proxy for forecast)
        if current_aqi >= thresholds["aqi"]["level_3"]:
            active_triggers.append({"type": "aqi", "severity": "severe", "value": current_aqi})
        elif current_aqi >= thresholds["aqi"]["level_2"]:
            active_triggers.append({"type": "aqi", "severity": "high", "value": current_aqi})
        elif current_aqi >= thresholds["aqi"]["level_1"]:
            active_triggers.append({"type": "aqi", "severity": "moderate", "value": current_aqi})

        # Cold fog — lower visibility = worse condition, so use <= (opposite of rainfall/heat/AQI)
        if visibility_m <= thresholds["cold_fog"]["level_3"]:
            active_triggers.append({"type": "cold_fog", "severity": "severe", "value": visibility_m})
        elif visibility_m <= thresholds["cold_fog"]["level_2"]:
            active_triggers.append({"type": "cold_fog", "severity": "high", "value": visibility_m})
        elif visibility_m <= thresholds["cold_fog"]["level_1"]:
            active_triggers.append({"type": "cold_fog", "severity": "moderate", "value": visibility_m})

        # Calculate per-block earnings
        blocks = []
        day_normal = 0
        day_predicted = 0

        for block_name, block_data in HOURLY_EARNINGS_BY_BLOCK.items():
            normal = block_data["avg_rate"]
            # Rain typically impacts afternoon/evening more
            block_impact = earnings_impact
            if rainfall >= thresholds["rainfall"]["level_1"] and block_name in ["afternoon", "evening", "dinner"]:
                block_impact *= 0.78
            elif rainfall >= thresholds["rainfall"]["level_1"] and block_name in ["early_morning", "morning"]:
                block_impact = min(block_impact * 1.08, 1.0)

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
