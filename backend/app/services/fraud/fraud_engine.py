"""
7-Wall Fraud Detection Engine.
Runs all walls and produces a composite fraud score (0-100) for each claim.

0-20:  trusted   → AUTO_APPROVED (instant)
21-40: normal    → AUTO_APPROVED (standard)
41-60: watch     → PENDING_REVIEW (delayed)
61-80: review    → FLAGGED (manual)
80+:   block     → DENIED (blocked)
"""

from dataclasses import dataclass
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging

from app.models.models import TriggerReading, FraudCheck, Claim, Rider, RiderActivity
from app.services.fraud.wall_1_proof_of_work import check_proof_of_work
from app.services.fraud.wall_2_device_fingerprint import check_device_fingerprint
from app.services.fraud.wall_3_location_intelligence import check_location_intelligence
from app.services.fraud.wall_4_crowd_oracle import check_crowd_oracle
from app.services.fraud.wall_5_graph_network import check_graph_network
from app.services.fraud.wall_6_temporal_patterns import check_temporal_patterns
from app.services.fraud.wall_7_multi_source import check_multi_source_verification
from app.services.ml_models import ml

logger = logging.getLogger(__name__)


@dataclass
class FraudCheckResult:
    wall_name: str
    passed: bool
    score: float
    reason: str
    details: dict


@dataclass
class FraudVerdict:
    total_score: float
    classification: str
    walls: list
    auto_approve: bool
    processing_time: str
    ml_anomaly_score: float = 0.0


WALLS = [
    {"number": 1, "name": "Proof of Work Loss", "max_score": 30,
     "check_fn": "proof_of_work", "needs_trigger": True},
    {"number": 2, "name": "Device Fingerprint", "max_score": 20,
     "check_fn": "device_fingerprint", "needs_trigger": False},
    {"number": 3, "name": "Location Intelligence", "max_score": 20,
     "check_fn": "location_intelligence", "needs_trigger": True},
    {"number": 4, "name": "Crowd Oracle", "max_score": 15,
     "check_fn": "crowd_oracle", "needs_trigger": True},
    {"number": 5, "name": "Graph Network", "max_score": 20,
     "check_fn": "graph_network", "needs_trigger": False},
    {"number": 6, "name": "Temporal Patterns", "max_score": 15,
     "check_fn": "temporal_patterns", "needs_trigger": False},
    {"number": 7, "name": "Multi-Source Verification", "max_score": 15,
     "check_fn": "multi_source", "needs_trigger": True},
]


class FraudEngine:
    """Orchestrates all 7 fraud walls."""

    async def evaluate_claim(
        self,
        claim: Claim,
        rider: Rider,
        db: AsyncSession = None,
        trigger_reading: TriggerReading = None,
    ) -> FraudVerdict:
        """Run all 7 walls against a claim. Returns combined verdict."""
        walls = []
        total_score = 0.0
        walls_passed = 0
        walls_failed = 0
        wall_results: dict[str, dict] = {}

        for wall in WALLS:
            try:
                result = await self._run_wall(wall, db, rider.id, trigger_reading)
            except Exception as e:
                logger.warning(f"Wall {wall['number']} error: {e}")
                result = {"passed": True, "score": 0.0, "details": {"error": str(e)}}
            wall_results[wall["check_fn"]] = result

            wall_score = min(result["score"], wall["max_score"])
            passed = result["passed"]

            if passed:
                walls_passed += 1
            else:
                walls_failed += 1

            total_score += wall_score

            issues = result.get("details", {}).get("issues", [])
            reason = issues[0] if issues else ("Clean" if passed else "Suspicious")

            walls.append(FraudCheckResult(
                wall_name=wall["name"],
                passed=passed,
                score=round(wall_score, 1),
                reason=reason,
                details=result.get("details", {}),
            ))

            # Save FraudCheck record
            if db and claim:
                fraud_check = FraudCheck(
                    claim_id=claim.id,
                    wall_number=wall["number"],
                    wall_name=wall["name"],
                    passed=passed,
                    score=round(wall_score, 1),
                    details=result.get("details", {}),
                )
                db.add(fraud_check)

        ml_anomaly_score = 0.0
        if db and claim and rider:
            anomaly_features = await self._build_anomaly_features(db, claim, rider, wall_results)
            ml_anomaly_score = ml.fraud_anomaly_score(anomaly_features)
            total_score += ml_anomaly_score

        total_score = min(total_score, 100.0)

        if total_score <= 20:
            classification, processing_time, auto_approve = "trusted", "instant", True
        elif total_score <= 40:
            classification, processing_time, auto_approve = "normal", "standard", True
        elif total_score <= 60:
            classification, processing_time, auto_approve = "watch", "delayed", False
        elif total_score <= 80:
            classification, processing_time, auto_approve = "review", "manual", False
        else:
            classification, processing_time, auto_approve = "block", "blocked", False

        return FraudVerdict(
            total_score=round(total_score, 1),
            classification=classification,
            walls=walls,
            auto_approve=auto_approve,
            processing_time=processing_time,
            ml_anomaly_score=round(ml_anomaly_score, 1),
        )

    async def _run_wall(self, wall: dict, db: AsyncSession, rider_id: int, trigger_reading: TriggerReading) -> dict:
        """Dispatch to the correct wall implementation."""
        fn_name = wall["check_fn"]

        if fn_name == "proof_of_work":
            return await check_proof_of_work(db, rider_id, trigger_reading)
        elif fn_name == "device_fingerprint":
            return await check_device_fingerprint(db, rider_id)
        elif fn_name == "location_intelligence":
            return await check_location_intelligence(db, rider_id, trigger_reading)
        elif fn_name == "crowd_oracle":
            return await check_crowd_oracle(db, rider_id, trigger_reading)
        elif fn_name == "graph_network":
            return await check_graph_network(db, rider_id)
        elif fn_name == "temporal_patterns":
            return await check_temporal_patterns(db, rider_id)
        elif fn_name == "multi_source":
            return await check_multi_source_verification(db, rider_id, trigger_reading)
        else:
            return {"passed": True, "score": 0.0, "details": {}}

    async def _build_anomaly_features(
        self,
        db: AsyncSession,
        claim: Claim,
        rider: Rider,
        wall_results: dict[str, dict],
    ) -> list[float]:
        claims_result = await db.execute(
            select(Claim).where(Claim.rider_id == rider.id).order_by(Claim.event_time.desc())
        )
        rider_claims = claims_result.scalars().all()

        temporal_details = wall_results.get("temporal_patterns", {}).get("details", {})
        zone_avg_claims = float(temporal_details.get("zone_avg_claims", 1.0) or 1.0)
        rider_total_claims = float(temporal_details.get("rider_total_claims", len(rider_claims)) or len(rider_claims))
        claim_ratio = rider_total_claims / max(zone_avg_claims, 1.0)

        historical_payouts = [c.payout_amount for c in rider_claims if c.id != claim.id and c.payout_amount > 0]
        if historical_payouts:
            avg_historical_payout = sum(historical_payouts) / len(historical_payouts)
            amount_deviation = abs(claim.payout_amount - avg_historical_payout) / max(avg_historical_payout, 1.0)
        else:
            amount_deviation = 0.18

        claim_gaps = []
        for idx in range(1, len(rider_claims)):
            newer = rider_claims[idx - 1].event_time
            older = rider_claims[idx].event_time
            if not newer or not older:
                continue
            if newer.tzinfo is not None:
                newer = newer.replace(tzinfo=None)
            if older.tzinfo is not None:
                older = older.replace(tzinfo=None)
            claim_gaps.append(abs((newer - older).days))
        avg_gap_days = sum(claim_gaps) / len(claim_gaps) if claim_gaps else 7.0
        avg_gap_days_norm = min(avg_gap_days / 14.0, 1.0)

        proof_details = wall_results.get("proof_of_work", {}).get("details", {})
        hours_active_ratio = min(float(proof_details.get("hours_active", 0.0)) / 8.0, 1.0)
        delivery_ratio = min(float(proof_details.get("deliveries", 0.0)) / 12.0, 1.0)
        login_timing_score = min(float(wall_results.get("proof_of_work", {}).get("score", 0.0)) / 30.0, 1.0)

        location_details = wall_results.get("location_intelligence", {}).get("details", {})
        gps_spread_norm = min(float(location_details.get("zone_match_pct", 0.0)) / 100.0, 1.0)

        if proof_details.get("gps_points_count", 0) == 0:
            activity_result = await db.execute(
                select(RiderActivity).where(RiderActivity.rider_id == rider.id).order_by(RiderActivity.date.desc()).limit(1)
            )
            activity = activity_result.scalar_one_or_none()
            if activity:
                hours_active_ratio = min(float(activity.hours_active or 0.0) / 8.0, 1.0)
                delivery_ratio = min(float(activity.deliveries_completed or 0.0) / 12.0, 1.0)

        return [
            round(claim_ratio, 3),
            round(min(amount_deviation, 1.0), 3),
            round(avg_gap_days_norm, 3),
            round(hours_active_ratio, 3),
            round(delivery_ratio, 3),
            round(gps_spread_norm, 3),
            round(login_timing_score, 3),
        ]
