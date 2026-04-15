"""
Trigger Engine — Scheduled monitoring of all 6 parametric triggers.
Polls mock external APIs every 30 minutes and auto-creates claims.
Runs a weekly ledger update every Sunday to write actual BCR to WeeklyLedger.
"""

from copy import deepcopy
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging

logger = logging.getLogger(__name__)

# Trigger thresholds
TRIGGER_THRESHOLDS = {
    "rainfall": {"level_1": 65, "level_2": 80, "level_3": 100, "level_4": 120},
    "heat": {"level_1": 45, "level_2": 47, "level_3": 50},
    "cold_fog": {"level_1": 500, "level_2": 200, "level_3": 50},
    "aqi": {"level_1": 500, "level_2": 600, "level_3": 700},
    "traffic": {"level_1": 10, "level_2": 5, "min_duration_hours": 2},
    "social": {"level_1": "partial_bandh", "level_2": "full_bandh", "level_3": "curfew_section_144"},
}

MONSOON_MONTHS = {6, 7, 8, 9}
AQI_RELAXED_MONTHS = {11, 12, 1}

PAYOUT_MULTIPLIERS = {
    "level_1": 0.3,
    "level_2": 0.6,
    "level_3": 0.85,
    "level_4": 1.0,
}


def get_trigger_thresholds(month: int | None = None) -> dict:
    """
    Return threshold set for the given month.

    Base thresholds stay extreme-only, with small seasonal relaxations so the
    product still matters during Delhi winter smog and North Indian summer heat.
    """
    thresholds = deepcopy(TRIGGER_THRESHOLDS)

    if month is None:
        return thresholds

    if month not in MONSOON_MONTHS:
        thresholds["heat"]["level_1"] = 47
        thresholds["heat"]["level_2"] = 49

    if month in AQI_RELAXED_MONTHS:
        thresholds["aqi"]["level_1"] = 400

    return thresholds


def get_primary_threshold(trigger_type: str, month: int | None = None) -> float | str:
    thresholds = get_trigger_thresholds(month)
    return thresholds.get(trigger_type, {}).get("level_1")


async def _update_weekly_ledger():
    """
    Aggregate the past 7 days of actual claims per city and write a WeeklyLedger row.
    Runs every Sunday at 00:05 UTC so the ActuarialDashboard shows live BCR.
    """
    from sqlalchemy import select, func
    from app.core.database import async_session
    from app.models.models import (
        City, Zone, Policy, Claim, WeeklyLedger, PolicyStatus,
    )

    now = datetime.now(timezone.utc)
    week_end = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = week_end - timedelta(days=7)

    try:
        async with async_session() as db:
            cities_result = await db.execute(select(City))
            cities = cities_result.scalars().all()

            for city in cities:
                zones_result = await db.execute(select(Zone).where(Zone.city_id == city.id))
                city_zones = zones_result.scalars().all()
                zone_ids = [z.id for z in city_zones]
                if not zone_ids:
                    continue

                # Premium collected from policies active this week
                premium_result = await db.execute(
                    select(func.coalesce(func.sum(Policy.premium_amount), 0.0))
                    .where(
                        Policy.zone_id.in_(zone_ids),
                        Policy.week_start >= week_start,
                        Policy.week_start < week_end,
                    )
                )
                premium_collected = float(premium_result.scalar() or 0.0)

                # All city policy IDs (for claim filtering)
                policy_ids_result = await db.execute(
                    select(Policy.id).where(Policy.zone_id.in_(zone_ids))
                )
                city_policy_ids = list(policy_ids_result.scalars().all())
                if not city_policy_ids:
                    continue

                # Claims this week for this city
                claims_result = await db.execute(
                    select(Claim).where(
                        Claim.policy_id.in_(city_policy_ids),
                        Claim.event_time >= week_start,
                        Claim.event_time < week_end,
                    )
                )
                city_claims = claims_result.scalars().all()

                approved = [c for c in city_claims if c.status and c.status.value in ('auto_approved', 'approved', 'paid')]
                denied = [c for c in city_claims if c.status and c.status.value == 'denied']
                total_payout = sum(c.payout_amount or 0.0 for c in approved)
                claims_approved = len(approved)
                avg_claim = round(total_payout / claims_approved, 2) if claims_approved > 0 else 0.0
                lr = round(total_payout / premium_collected, 4) if premium_collected > 0 else 0.0

                active_count_result = await db.execute(
                    select(func.count(Policy.id)).where(
                        Policy.zone_id.in_(zone_ids),
                        Policy.status == PolicyStatus.ACTIVE,
                    )
                )
                total_policies = int(active_count_result.scalar() or 0)

                db.add(WeeklyLedger(
                    city_id=city.id,
                    week_start=week_start, week_end=week_end,
                    total_policies=total_policies,
                    premium_collected=round(premium_collected, 2),
                    total_claims=len(city_claims),
                    claims_approved=claims_approved,
                    claims_denied=len(denied),
                    total_payout=round(total_payout, 2),
                    loss_ratio=lr, bcr=lr,
                    avg_claim_amount=avg_claim,
                    urban_claims=0, semi_urban_claims=0, rural_claims=0,
                    urban_payout=0.0, semi_urban_payout=0.0, rural_payout=0.0,
                ))

            await db.commit()
            logger.info(f"Weekly ledger updated for {len(cities)} cities (week {week_start.date()} → {week_end.date()})")
    except Exception as exc:
        logger.error(f"Weekly ledger update failed: {exc}", exc_info=True)


class TriggerEngine:
    """Scheduled trigger monitoring engine."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def start(self):
        self.scheduler.add_job(
            self._check_triggers, 'interval', minutes=30,
            id='trigger_check', name='Check all 6 triggers'
        )
        # Weekly ledger: every Sunday at 00:05 UTC
        self.scheduler.add_job(
            _update_weekly_ledger, 'cron', day_of_week='sun', hour=0, minute=5,
            id='weekly_ledger', name='Update weekly BCR ledger',
        )
        self.scheduler.start()
        logger.info("Trigger Engine started — 30-min trigger polling + weekly BCR ledger job")

    def stop(self):
        self.scheduler.shutdown()
        logger.info("Trigger Engine stopped")

    async def _check_triggers(self):
        """Placeholder — in production polls real APIs. Use /api/triggers/simulate for demos."""
        logger.info("Scheduled trigger check running (use /api/triggers/simulate for manual demo)")
