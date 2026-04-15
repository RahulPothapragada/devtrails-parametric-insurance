"""
LAYER 2: OPTIMIZE — "How Should I Work This Week?"

This is the CORE novelty. No other team will have this.

Takes the PREDICT layer's forecast and generates actionable
shift recommendations that help riders AVOID income loss.

The AI's first job is NOT to pay insurance.
It's to help you keep earning.
Insurance is the last resort.
"""

from datetime import datetime
from typing import Optional
from app.services.ml_models import ml
from app.services.prediction.predict_engine import PredictEngine, HOURLY_EARNINGS_BY_BLOCK
from app.services.pricing.pricing_engine import zone_tier_to_weekly_cap, CITY_TIER_CODES
import logging

logger = logging.getLogger(__name__)


# Optimization strategies
STRATEGIES = {
    "shift_time": "Move working hours to avoid disruption windows",
    "extend_safe": "Work extra hours on safe days to offset disrupted days",
    "zone_switch": "Suggest nearby safer zones during localized events",
    "rest_covered": "Take the day off — insurance covers you",
}


class OptimizeEngine:
    """
    Generates personalized shift optimization recommendations.

    Input: Weekly forecast from PredictEngine + rider's usual schedule
    Output: Day-by-day recommendations that maximize earnings

    The AI tries to PREVENT income loss before insurance has to pay.
    This is what makes us different from every other team.
    """

    def __init__(self):
        self.predictor = PredictEngine()

    async def get_weekly_plan(
        self,
        zone_lat: float,
        zone_lng: float,
        zone_tier: str,
        city: str,
        rider_shift: str,          # morning, evening, night, flexible
        rider_hourly_rate: float,   # rider's actual hourly rate
        target_weekly: float,       # rider's target weekly earnings
    ) -> dict:
        """
        Generate an optimized weekly work plan.

        Returns:
          - Day-by-day recommended schedule
          - Expected earnings with vs without optimization
          - Which days insurance kicks in
          - Total projected week with AI guidance
        """
        # Step 1: Get raw forecast
        forecast = await self.predictor.get_weekly_forecast(
            zone_lat, zone_lng, zone_tier, city
        )

        # Step 2: Generate optimized schedule
        daily_plans = []
        total_without_ai = 0
        total_with_ai = 0
        claims_prevented = 0
        insurance_needed = 0

        for day in forecast["daily"]:
            plan = self._optimize_day(
                day_forecast=day,
                zone_tier=zone_tier,
                rider_shift=rider_shift,
                rider_hourly_rate=rider_hourly_rate,
            )
            daily_plans.append(plan)

            total_without_ai += plan["earnings_without_optimization"]
            total_with_ai += plan["earnings_with_optimization"]
            if plan["claim_prevented"]:
                claims_prevented += 1

        normal_week_target = sum(plan["normal_day_target"] for plan in daily_plans)
        residual_weekly_loss = max(normal_week_target - total_with_ai, 0)
        city_tier = CITY_TIER_CODES.get(city.lower(), "tier_1")
        weekly_cap = zone_tier_to_weekly_cap(zone_tier, city_tier)
        if residual_weekly_loss > 75:
            insurance_needed = min(round(residual_weekly_loss * 0.50), weekly_cap)

        if insurance_needed > 0:
            payout_idx = max(range(len(daily_plans)), key=lambda idx: daily_plans[idx]["eligible_loss"])
            daily_plans[payout_idx]["insurance_payout"] = insurance_needed
            daily_plans[payout_idx]["total_day_income"] = round(
                daily_plans[payout_idx]["earnings_with_optimization"] + insurance_needed
            )

        # Step 3: Build weekly summary
        total_with_insurance = total_with_ai + insurance_needed
        recovery_pct = round(total_with_insurance / max(target_weekly, 1) * 100, 1)

        return {
            "rider": {
                "shift": rider_shift,
                "hourly_rate": rider_hourly_rate,
                "target_weekly": target_weekly,
            },
            "daily_plans": daily_plans,
            "weekly_summary": {
                "without_platform": round(total_without_ai),
                "with_ai_optimization": round(total_with_ai),
                "ai_savings": round(total_with_ai - total_without_ai),
                "insurance_payouts": round(insurance_needed),
                "total_with_insurance": round(total_with_insurance),
                "target_weekly": target_weekly,
                "recovery_pct": recovery_pct,
                "claims_prevented": claims_prevented,
                "claims_needed": 1 if insurance_needed > 0 else 0,
            },
            "key_insight": self._generate_insight(
                daily_plans, total_without_ai, total_with_ai, insurance_needed, target_weekly
            ),
        }

    def _optimize_day(
        self,
        day_forecast: dict,
        zone_tier: str,
        rider_shift: str,
        rider_hourly_rate: float,
    ) -> dict:
        """
        Optimize a single day's schedule.

        Strategies:
        1. If disruption is in afternoon → recommend morning shift
        2. If disruption is all day → recommend rest, insurance covers
        3. If disruption is mild → extend hours in safe blocks
        4. If no disruption → normal schedule, maybe extra hours
        """
        date = day_forecast["date"]
        risk_level = day_forecast["risk_level"]
        blocks = day_forecast["blocks"]
        active_triggers = day_forecast["active_triggers"]
        zone_tier_enc = ml.zone_tier_to_enc(zone_tier)
        try:
            day_of_week = datetime.fromisoformat(str(date)).weekday()
        except ValueError:
            day_of_week = datetime.now().weekday()

        modeled_blocks = []
        for block in blocks:
            block_impact = block["predicted_earnings"] / max(block["normal_earnings"], 1)
            modeled_blocks.append({
                **block,
                "modeled_earnings": ml.predict_block_earnings(
                    base_block_rate=block["normal_earnings"],
                    zone_tier_enc=zone_tier_enc,
                    day_of_week=day_of_week,
                    earnings_impact=block_impact,
                    rider_rate=rider_hourly_rate,
                ),
                "baseline_earnings": ml.predict_block_earnings(
                    base_block_rate=block["normal_earnings"],
                    zone_tier_enc=zone_tier_enc,
                    day_of_week=day_of_week,
                    earnings_impact=1.0,
                    rider_rate=rider_hourly_rate,
                ),
            })

        # Find safe and risky blocks
        safe_blocks = [b for b in modeled_blocks if b["risk"] == "low"]
        risky_blocks = [b for b in modeled_blocks if b["risk"] in ["high", "moderate"]]

        # Calculate what the rider would earn WITHOUT optimization
        # (working their normal shift into the disruption)
        normal_shift_blocks = self._get_shift_blocks(rider_shift)
        earnings_without = sum(
            b["modeled_earnings"] for b in modeled_blocks
            if b["block"] in normal_shift_blocks
        )
        normal_day_target = sum(
            b["baseline_earnings"] for b in modeled_blocks
            if b["block"] in normal_shift_blocks
        )

        # Generate recommendation
        recommendation = {}
        earnings_with = 0
        strategy_used = None
        claim_prevented = False
        insurance_payout = 0
        eligible_loss = 0.0

        if risk_level == "low":
            # No disruption — normal schedule
            recommendation = {
                "action": "normal",
                "message": f"Clear day. Work your regular {rider_shift} shift.",
                "recommended_blocks": normal_shift_blocks,
            }
            earnings_with = earnings_without
            strategy_used = None

        elif risk_level == "moderate":
            # Mild disruption — shift time to avoid worst blocks
            best_blocks = sorted(modeled_blocks, key=lambda b: b["modeled_earnings"], reverse=True)
            recommended = [b["block"] for b in best_blocks[:4]]  # Top 4 earning blocks

            earnings_with = round(sum(b["modeled_earnings"] for b in best_blocks[:4]))

            recommendation = {
                "action": "shift_time",
                "message": self._build_shift_message(recommended, active_triggers),
                "recommended_blocks": recommended,
                "avoid_blocks": [b["block"] for b in modeled_blocks if b["block"] not in recommended and b["risk"] != "low"],
            }
            strategy_used = "shift_time"
            if earnings_with > earnings_without:
                claim_prevented = True

        elif risk_level == "high":
            # Significant disruption — shift + extend safe hours
            safe_earnings = sum(b["modeled_earnings"] for b in safe_blocks)
            earnings_with = round(safe_earnings)

            recommended = [b["block"] for b in safe_blocks]

            if safe_earnings > 0:
                recommendation = {
                    "action": "shift_and_extend",
                    "message": f"Disruption expected. Work {', '.join(b['hours'] for b in safe_blocks)} — push extra orders in safe windows.",
                    "recommended_blocks": recommended,
                    "avoid_blocks": [b["block"] for b in risky_blocks],
                }
                strategy_used = "extend_safe"
                if earnings_with > earnings_without:
                    claim_prevented = True
            else:
                recommendation = {
                    "action": "rest_covered",
                    "message": "Full-day disruption likely. Stay home — your insurance covers today.",
                    "recommended_blocks": [],
                }
                strategy_used = "rest_covered"
                earnings_with = 0

            eligible_loss = max(normal_day_target - earnings_with, 0)

        elif risk_level == "severe":
            # Total disruption — rest day, insurance covers fully
            recommendation = {
                "action": "rest_covered",
                "message": "Severe disruption across your zone. Stay safe at home. Insurance auto-pays your lost income.",
                "recommended_blocks": [],
            }
            strategy_used = "rest_covered"
            earnings_with = 0
            eligible_loss = max(normal_day_target, 0)

        eligible_loss = max(eligible_loss, normal_day_target - earnings_with, 0)

        return {
            "date": date,
            "risk_level": risk_level,
            "active_triggers": [t["type"] for t in active_triggers],
            "recommendation": recommendation,
            "strategy": strategy_used,
            "earnings_without_optimization": round(earnings_without),
            "earnings_with_optimization": round(earnings_with),
            "ai_savings": round(max(earnings_with - earnings_without, 0)),
            "insurance_payout": insurance_payout,
            "total_day_income": round(earnings_with + insurance_payout),
            "claim_prevented": claim_prevented,
            "normal_day_target": round(normal_day_target),
            "eligible_loss": round(eligible_loss),
        }

    def _get_shift_blocks(self, shift: str) -> list:
        """Map rider's shift preference to time blocks."""
        shift_map = {
            "morning":  ["early_morning", "morning", "lunch", "afternoon"],
            "evening":  ["afternoon", "evening", "dinner", "late_night"],
            "night":    ["dinner", "late_night", "early_morning"],
            "flexible": ["morning", "lunch", "afternoon", "evening"],  # Default spread
        }
        return shift_map.get(shift, shift_map["flexible"])

    def _build_shift_message(self, recommended: list, triggers: list) -> str:
        """Build a human-readable recommendation message."""
        trigger_names = [t["type"] for t in triggers]
        trigger_str = " and ".join(trigger_names) if trigger_names else "disruption"

        block_hours = []
        for block in recommended:
            if block in HOURLY_EARNINGS_BY_BLOCK:
                block_hours.append(HOURLY_EARNINGS_BY_BLOCK[block]["hours"])

        hours_str = ", ".join(block_hours[:3])
        return f"Due to {trigger_str} risk, shift to: {hours_str}. Higher demand expected in these windows."

    def _generate_insight(
        self, plans: list, without: float, with_ai: float, insurance: float, target: float
    ) -> str:
        """Generate the key weekly insight message for the rider."""
        total = with_ai + insurance
        savings = with_ai - without

        if savings > 0 and insurance > 0:
            return (
                f"AI optimization saves you Rs.{round(savings)} this week by shifting your hours. "
                f"Insurance covers an additional Rs.{round(insurance)} for unavoidable disruptions. "
                f"Your projected week: Rs.{round(total)} ({round(total/max(target,1)*100)}% of target)."
            )
        elif savings > 0:
            return (
                f"By following AI recommendations, you earn Rs.{round(savings)} more than your normal schedule. "
                f"No insurance claims needed this week — optimization handled it all."
            )
        elif insurance > 0:
            return (
                f"Severe disruptions expected. Insurance covers Rs.{round(insurance)} of your lost income. "
                f"Follow the AI schedule on safe days to maximize earnings."
            )
        else:
            return "Clear week ahead! Work your normal schedule for full earnings."
