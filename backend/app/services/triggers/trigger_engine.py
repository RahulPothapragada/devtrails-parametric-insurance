"""
Trigger Engine — The Core Brain of GigShield.

Monitors all 6 parametric triggers across all zones.
When thresholds are breached, auto-initiates claims for affected riders.
Runs on a scheduled interval (every 30 minutes).
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.services.triggers.weather_service import WeatherService
from app.services.triggers.aqi_service import AQIService
from app.services.triggers.traffic_service import TrafficService
from app.services.triggers.social_service import SocialDisruptionService
from app.services.fraud.fraud_engine import FraudEngine
import logging

logger = logging.getLogger(__name__)


# ── Trigger Thresholds (City + Issue based) ──

TRIGGER_THRESHOLDS = {
    "rainfall": {
        "level_1": 10,     # mm/hr — light disruption
        "level_2": 15,     # mm/hr — moderate, 10-min delivery unsafe
        "level_3": 30,     # mm/hr — severe, all deliveries halted
        "level_4": 50,     # mm/day — flooding
    },
    "heat": {
        "level_1": 38,     # Celsius — uncomfortable
        "level_2": 42,     # Celsius — dangerous for outdoor work
        "level_3": 45,     # Celsius — extreme, platform pauses
    },
    "cold_fog": {
        "level_1": 500,    # meters visibility
        "level_2": 200,    # meters — unsafe for riding
        "level_3": 50,     # meters — near zero visibility
        "temp_cold": 4,    # Celsius — extreme cold
    },
    "aqi": {
        "level_1": 200,    # Unhealthy
        "level_2": 300,    # Very unhealthy
        "level_3": 400,    # Hazardous
    },
    "traffic": {
        "level_1": 10,     # km/hr avg zone speed
        "level_2": 5,      # km/hr — gridlock
        "min_duration_hours": 2,  # Must persist 2+ hours
    },
    "social": {
        "level_1": "partial_bandh",
        "level_2": "full_bandh",
        "level_3": "curfew_section_144",
    },
}

# Payout multipliers by severity level
PAYOUT_MULTIPLIERS = {
    "level_1": 0.3,   # 30% of hourly rate x hours affected
    "level_2": 0.6,   # 60%
    "level_3": 0.85,  # 85%
    "level_4": 1.0,   # 100% — full income replacement
}


class TriggerEngine:
    """
    Core engine that:
    1. Polls external APIs every 30 mins
    2. Checks readings against thresholds per zone
    3. If breached: validates with multi-source consensus (Wall 7)
    4. Identifies affected riders
    5. Runs fraud checks (Walls 1-6)
    6. Calculates and processes payouts
    """

    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.weather = WeatherService()
        self.aqi = AQIService()
        self.traffic = TrafficService()
        self.social = SocialDisruptionService()
        self.fraud = FraudEngine()

    def start(self):
        """Start the trigger monitoring scheduler."""
        # Poll weather + AQI every 30 minutes
        self.scheduler.add_job(
            self.check_all_triggers,
            'interval',
            minutes=30,
            id='trigger_check',
            name='Check all 6 triggers'
        )
        # Update fraud scores daily
        self.scheduler.add_job(
            self.fraud.update_all_scores,
            'interval',
            hours=24,
            id='fraud_update',
            name='Update rider fraud scores'
        )
        # Recalculate premiums every Sunday midnight
        self.scheduler.add_job(
            self.recalculate_weekly_premiums,
            'cron',
            day_of_week='sun',
            hour=0,
            minute=0,
            id='premium_recalc',
            name='Weekly premium recalculation'
        )
        self.scheduler.start()
        logger.info("Trigger Engine started with 30-min polling interval")

    def stop(self):
        """Stop the scheduler."""
        self.scheduler.shutdown()
        logger.info("Trigger Engine stopped")

    async def check_all_triggers(self):
        """
        Master trigger check — runs every 30 minutes.
        Polls all APIs, checks thresholds, processes claims.
        """
        logger.info("Running trigger check across all zones...")

        # TODO: Load all active zones from DB
        # For each zone, check all 6 triggers
        # For now, this is the skeleton

        # Step 1: Fetch current readings
        # weather_data = await self.weather.get_current(city="Mumbai", zones=[...])
        # aqi_data = await self.aqi.get_current(city="Mumbai")
        # traffic_data = await self.traffic.get_current(zones=[...])
        # social_data = await self.social.check_disruptions(city="Mumbai")

        # Step 2: Check thresholds
        # breaches = self._evaluate_thresholds(weather_data, aqi_data, traffic_data, social_data)

        # Step 3: Multi-source consensus (Wall 7)
        # confirmed_events = self._validate_multi_source(breaches)

        # Step 4: For each confirmed event, process claims
        # for event in confirmed_events:
        #     await self._process_event(event)

        logger.info("Trigger check completed")

    async def _process_event(self, event: dict):
        """
        Process a confirmed trigger event:
        1. Get all active riders in affected zone
        2. Run fraud checks per rider
        3. Calculate payout
        4. Queue payment
        """
        pass  # Implement in Phase 2

    async def recalculate_weekly_premiums(self):
        """
        Run every Sunday midnight.
        Recalculates next week's premium for every city/zone/tier
        based on forecast data and historical patterns.
        """
        logger.info("Recalculating weekly premiums...")
        # TODO: Implement pricing recalculation
        pass
