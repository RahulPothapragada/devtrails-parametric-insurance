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
import logging

from app.models.models import TriggerReading, FraudCheck, Claim, Rider
from app.services.fraud.wall_1_proof_of_work import check_proof_of_work
from app.services.fraud.wall_2_device_fingerprint import check_device_fingerprint
from app.services.fraud.wall_3_location_intelligence import check_location_intelligence
from app.services.fraud.wall_4_crowd_oracle import check_crowd_oracle
from app.services.fraud.wall_5_graph_network import check_graph_network
from app.services.fraud.wall_6_temporal_patterns import check_temporal_patterns
from app.services.fraud.wall_7_multi_source import check_multi_source_verification

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

        for wall in WALLS:
            try:
                result = await self._run_wall(wall, db, rider.id, trigger_reading)
            except Exception as e:
                logger.warning(f"Wall {wall['number']} error: {e}")
                result = {"passed": True, "score": 0.0, "details": {"error": str(e)}}

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
