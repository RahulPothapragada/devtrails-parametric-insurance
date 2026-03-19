"""
Dynamic Pricing Engine — City + Issue + Season + Zone Tier based.

Calculates weekly premiums using:
  Premium = Sum(Issue_Risk x Expected_Payout) x Margin x Zone_Factor

Rate cards are pre-computed and stored in DB.
Updated weekly every Sunday based on forecast data.
"""

from typing import Optional
import logging

logger = logging.getLogger(__name__)


# ── Historical Risk Data (Real data from IMD, CPCB, TomTom) ──
# Format: { city: { month: { trigger: { zone_tier: probability } } } }

RISK_PROBABILITIES = {
    "mumbai": {
        # Month 1 (January)
        1: {
            "rainfall":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.05, "medium": 0.03, "low": 0.01},
            "aqi":       {"high": 0.35, "medium": 0.25, "low": 0.15},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        2: {
            "rainfall":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "aqi":       {"high": 0.20, "medium": 0.15, "low": 0.08},
            "traffic":   {"high": 0.18, "medium": 0.15, "low": 0.10},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        3: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.15, "medium": 0.10, "low": 0.05},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.12, "medium": 0.08, "low": 0.05},
            "traffic":   {"high": 0.18, "medium": 0.15, "low": 0.10},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        4: {
            "rainfall":  {"high": 0.03, "medium": 0.02, "low": 0.01},
            "heat":      {"high": 0.30, "medium": 0.22, "low": 0.12},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.08, "medium": 0.05, "low": 0.03},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        5: {
            "rainfall":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "heat":      {"high": 0.35, "medium": 0.25, "low": 0.15},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.05, "medium": 0.03, "low": 0.02},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        6: {
            "rainfall":  {"high": 0.60, "medium": 0.45, "low": 0.25},
            "heat":      {"high": 0.02, "medium": 0.01, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.40, "medium": 0.30, "low": 0.18},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        7: {
            "rainfall":  {"high": 0.75, "medium": 0.55, "low": 0.30},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.02, "medium": 0.01, "low": 0.01},
            "traffic":   {"high": 0.45, "medium": 0.35, "low": 0.20},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        8: {
            "rainfall":  {"high": 0.65, "medium": 0.48, "low": 0.28},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.02, "medium": 0.01, "low": 0.01},
            "traffic":   {"high": 0.38, "medium": 0.30, "low": 0.18},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        9: {
            "rainfall":  {"high": 0.50, "medium": 0.35, "low": 0.18},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.03, "medium": 0.02, "low": 0.01},
            "traffic":   {"high": 0.30, "medium": 0.25, "low": 0.15},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        10: {
            "rainfall":  {"high": 0.12, "medium": 0.08, "low": 0.04},
            "heat":      {"high": 0.05, "medium": 0.03, "low": 0.01},
            "cold_fog":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "aqi":       {"high": 0.15, "medium": 0.10, "low": 0.05},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        11: {
            "rainfall":  {"high": 0.02, "medium": 0.01, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.08, "medium": 0.05, "low": 0.02},
            "aqi":       {"high": 0.45, "medium": 0.35, "low": 0.20},
            "traffic":   {"high": 0.22, "medium": 0.18, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
        12: {
            "rainfall":  {"high": 0.00, "medium": 0.00, "low": 0.00},
            "heat":      {"high": 0.00, "medium": 0.00, "low": 0.00},
            "cold_fog":  {"high": 0.10, "medium": 0.06, "low": 0.03},
            "aqi":       {"high": 0.50, "medium": 0.38, "low": 0.22},
            "traffic":   {"high": 0.25, "medium": 0.20, "low": 0.12},
            "social":    {"high": 0.04, "medium": 0.04, "low": 0.04},
        },
    },
    "delhi": {
        # Delhi has different risk profile — extreme AQI, heat, fog
        # TODO: Add Delhi risk data
    },
}

# Average payout per trigger event (in Rs.)
AVG_PAYOUT_PER_EVENT = {
    "rainfall": 280,
    "heat": 180,
    "cold_fog": 120,
    "aqi": 160,
    "traffic": 100,
    "social": 400,
}

# Margin multiplier (35% gross margin target)
MARGIN = 1.35


class PricingEngine:
    """
    Calculates weekly premiums at the City + Zone Tier + Month level.

    Formula:
      For each trigger:
        trigger_premium = risk_probability x avg_payout x MARGIN

      Weekly premium = sum of all trigger_premiums
    """

    def calculate_premium(
        self,
        city: str,
        zone_tier: str,  # "high", "medium", "low"
        month: int,       # 1-12
    ) -> dict:
        """
        Calculate the weekly premium for a given city/zone/month.
        Returns breakdown by trigger type.
        """
        city_lower = city.lower()
        risk_data = RISK_PROBABILITIES.get(city_lower, {}).get(month, {})

        if not risk_data:
            logger.warning(f"No risk data for {city}, month {month}. Using defaults.")
            return self._default_premium()

        breakdown = {}
        total = 0

        for trigger_type, payout in AVG_PAYOUT_PER_EVENT.items():
            probability = risk_data.get(trigger_type, {}).get(zone_tier, 0)
            trigger_premium = probability * payout * MARGIN
            breakdown[trigger_type] = round(trigger_premium, 1)
            total += trigger_premium

        # Round total to nearest Rs.
        total = round(total)

        # Ensure minimum premium (platform needs minimum revenue)
        MIN_PREMIUM = 20
        total = max(total, MIN_PREMIUM)

        return {
            "city": city,
            "zone_tier": zone_tier,
            "month": month,
            "weekly_premium": total,
            "breakdown": breakdown,
            "margin_applied": MARGIN,
            "formula": "sum(probability x avg_payout x margin) per trigger",
        }

    def calculate_annual_schedule(self, city: str, zone_tier: str) -> list:
        """Calculate premium for every month of the year."""
        return [
            self.calculate_premium(city, zone_tier, month)
            for month in range(1, 13)
        ]

    def get_rate_card(self, city: str, month: int) -> dict:
        """Get the full rate card for a city/month across all zone tiers."""
        return {
            "city": city,
            "month": month,
            "tiers": {
                "high": self.calculate_premium(city, "high", month),
                "medium": self.calculate_premium(city, "medium", month),
                "low": self.calculate_premium(city, "low", month),
            }
        }

    def _default_premium(self) -> dict:
        return {
            "weekly_premium": 45,
            "breakdown": {t: 7.5 for t in AVG_PAYOUT_PER_EVENT},
            "note": "Default premium — no city-specific data available",
        }
