"""
Trigger Engine — Scheduled monitoring of all 6 parametric triggers.
Polls mock external APIs every 30 minutes and auto-creates claims.
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging

logger = logging.getLogger(__name__)

# Trigger thresholds
TRIGGER_THRESHOLDS = {
    "rainfall": {"level_1": 10, "level_2": 15, "level_3": 30, "level_4": 50},
    "heat": {"level_1": 38, "level_2": 42, "level_3": 45},
    "cold_fog": {"level_1": 500, "level_2": 200, "level_3": 50},
    "aqi": {"level_1": 200, "level_2": 300, "level_3": 400},
    "traffic": {"level_1": 10, "level_2": 5, "min_duration_hours": 2},
    "social": {"level_1": "partial_bandh", "level_2": "full_bandh", "level_3": "curfew_section_144"},
}

PAYOUT_MULTIPLIERS = {
    "level_1": 0.3,
    "level_2": 0.6,
    "level_3": 0.85,
    "level_4": 1.0,
}


class TriggerEngine:
    """Scheduled trigger monitoring engine."""

    def __init__(self):
        self.scheduler = AsyncIOScheduler()

    def start(self):
        self.scheduler.add_job(
            self._check_triggers, 'interval', minutes=30,
            id='trigger_check', name='Check all 6 triggers'
        )
        self.scheduler.start()
        logger.info("Trigger Engine started with 30-min polling interval")

    def stop(self):
        self.scheduler.shutdown()
        logger.info("Trigger Engine stopped")

    async def _check_triggers(self):
        """Placeholder — in production polls real APIs. Use /api/triggers/simulate for demos."""
        logger.info("Scheduled trigger check running (use /api/triggers/simulate for manual demo)")
