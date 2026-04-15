"""
Central ML registry for FlowSecure.

Models are trained from the actual seeded database (13,000 riders, 91,000 activity
records, 80+ zones with real risk scores) rather than inline synthetic data.

Training data sources:
  - Pricing (GBR):           RISK_PROBABILITIES actuarial table (city × month × zone)
  - Earnings Impact (RF):    RiderActivity.earnings correlated with Zone risk scores
  - Fraud (IsolationForest): Rider features split by is_suspicious label
  - Optimizer (Ridge):       RiderActivity (earnings, hours, deliveries) by shift/zone
"""

from __future__ import annotations

import logging
import math
from datetime import datetime

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor, IsolationForest, RandomForestRegressor
from sklearn.linear_model import Ridge

logger = logging.getLogger(__name__)

PERIL_ORDER = ["rainfall", "heat", "cold_fog", "aqi", "traffic", "social"]
ZONE_TIER_ENCODING = {"low": 0, "medium": 1, "high": 2}
CITY_TIER_ENCODING = {"tier_3": 0, "tier_2": 1, "tier_1": 2}
SHIFT_ENCODING = {"morning": 0, "evening": 1, "night": 2, "flexible": 3}
AREA_ENCODING = {"urban": 0, "semi_urban": 1, "rural": 2}

PRICING_DAILY_LOSS = {
    "rainfall": 6.0,
    "heat": 5.5,
    "cold_fog": 4.5,
    "aqi": 5.0,
    "traffic": 4.0,
    "social": 7.0,
}

ZONE_LOSS_MULTIPLIER = {"low": 0.92, "medium": 1.0, "high": 1.12}
CITY_LOSS_MULTIPLIER = {"tier_3": 0.86, "tier_2": 0.93, "tier_1": 1.0}


class MLRegistry:
    def __init__(self) -> None:
        self.initialized = False
        self.pricing_model: GradientBoostingRegressor | None = None
        self.earnings_impact_model: RandomForestRegressor | None = None
        self.fraud_model: IsolationForest | None = None
        self.optimizer_model: Ridge | None = None

        self.risk_probabilities = {}
        self.city_tier_map = {}
        self.trigger_thresholds = {}
        self.hourly_earnings_by_block = {}

        self._fraud_decision_floor = -0.12
        self._fraud_decision_ceiling = 0.08

    # ──────────────────────────────────────────────────────────────
    # Public init — sync fallback (uses actuarial tables only)
    # ──────────────────────────────────────────────────────────────
    def initialize(self) -> None:
        """
        Sync init — trains pricing model from actuarial tables.
        Earnings / fraud / optimizer models fall back to rule-derived synthetic
        data until async_initialize() is called with real DB rows.
        """
        if self.initialized:
            return
        self._load_static_sources()
        self._train_pricing()
        self._train_earnings_impact_synthetic()
        self._train_fraud_synthetic()
        self._train_optimizer_synthetic()
        self.initialized = True
        logger.info("MLRegistry initialised (sync — actuarial + rule-derived data)")

    async def async_initialize(self) -> None:
        """
        Full init — trains all models from the actual seeded database.
        Call from FastAPI lifespan AFTER the DB is seeded.
        """
        self._load_static_sources()
        self._train_pricing()

        # Load real rider/activity/zone rows
        riders, activities, zones = await self._load_db_data()

        if len(riders) >= 200:
            self._train_fraud_from_riders(riders, zones)
        else:
            logger.warning("Too few riders in DB — falling back to rule-derived fraud data")
            self._train_fraud_synthetic()

        if len(activities) >= 500:
            self._train_earnings_impact_from_activities(activities, zones, riders)
            self._train_optimizer_from_activities(activities, riders, zones)
        else:
            logger.warning("Too few activity rows in DB — falling back to rule-derived data")
            self._train_earnings_impact_synthetic()
            self._train_optimizer_synthetic()

        self.initialized = True
        logger.info(
            "MLRegistry initialised (async — DB: %d riders, %d activity rows, %d zones)",
            len(riders), len(activities), len(zones),
        )

    # ──────────────────────────────────────────────────────────────
    # DB loader
    # ──────────────────────────────────────────────────────────────
    async def _load_db_data(self):
        """Load riders, activities, and zones from the DB."""
        from sqlalchemy import select
        from app.core.database import async_session
        from app.models.models import Rider, RiderActivity, Zone

        async with async_session() as db:
            # Riders — all columns we need for fraud + optimizer features
            r_result = await db.execute(
                select(
                    Rider.id,
                    Rider.zone_id,
                    Rider.shift_type,
                    Rider.avg_weekly_earnings,
                    Rider.avg_hourly_rate,
                    Rider.active_days_last_30,
                    Rider.activity_tier,
                    Rider.is_suspicious,
                )
            )
            riders = r_result.fetchall()

            # Activity records — earnings, hours, deliveries per rider per day
            a_result = await db.execute(
                select(
                    RiderActivity.rider_id,
                    RiderActivity.earnings,
                    RiderActivity.hours_active,
                    RiderActivity.deliveries_completed,
                    RiderActivity.is_working,
                )
            )
            activities = a_result.fetchall()

            # Zones — risk scores + tier info
            z_result = await db.execute(
                select(
                    Zone.id,
                    Zone.tier,
                    Zone.area_type,
                    Zone.flood_risk_score,
                    Zone.heat_risk_score,
                    Zone.cold_risk_score,
                    Zone.aqi_risk_score,
                    Zone.traffic_risk_score,
                    Zone.social_risk_score,
                )
            )
            zones = z_result.fetchall()

        return riders, activities, zones

    # ──────────────────────────────────────────────────────────────
    # Static sources (always available)
    # ──────────────────────────────────────────────────────────────
    def _load_static_sources(self):
        from app.services.pricing.pricing_engine import CITY_TIER_MAP, RISK_PROBABILITIES
        from app.services.prediction.predict_engine import HOURLY_EARNINGS_BY_BLOCK
        from app.services.triggers.trigger_engine import TRIGGER_THRESHOLDS

        self.risk_probabilities = RISK_PROBABILITIES
        self.city_tier_map = CITY_TIER_MAP
        self.trigger_thresholds = TRIGGER_THRESHOLDS
        self.hourly_earnings_by_block = HOURLY_EARNINGS_BY_BLOCK

    # ──────────────────────────────────────────────────────────────
    # PRICING — GradientBoosting trained on RISK_PROBABILITIES
    # (same as before — this is already actuarially grounded)
    # ──────────────────────────────────────────────────────────────
    def _train_pricing(self):
        pricing_X, pricing_y = self._build_pricing_dataset()
        self.pricing_model = GradientBoostingRegressor(
            random_state=42, n_estimators=250,
            max_depth=3, learning_rate=0.05, subsample=0.9,
        )
        self.pricing_model.fit(pricing_X, pricing_y)
        logger.info("Pricing GBR trained on %d actuarial rows", len(pricing_y))

    # ──────────────────────────────────────────────────────────────
    # FRAUD — IsolationForest from actual Rider rows
    # ──────────────────────────────────────────────────────────────
    def _train_fraud_from_riders(self, riders, zones):
        """
        Build fraud features from the 13,000 seeded riders.

        Features per rider (all derived from DB columns):
          0  active_days_last_30 / 30          (activity frequency, 0-1)
          1  avg_weekly_earnings / 10000        (earnings level, normalised)
          2  avg_hourly_rate / 200              (rate level, normalised)
          3  zone_tier_enc / 2                  (zone risk, 0-1)
          4  shift_enc / 3                      (shift type, 0-1)
          5  activity_tier_enc / 2              (low/medium/high, 0-1)
          6  is_suspicious (label — 0 or 1)    -- NOT a feature, used to split
        """
        zone_tier_map = {row.id: ZONE_TIER_ENCODING.get(row.tier.value if hasattr(row.tier, 'value') else str(row.tier), 1) for row in zones}

        normal_rows = []
        anomaly_rows = []

        for r in riders:
            zone_enc = zone_tier_map.get(r.zone_id, 1)
            shift_enc = SHIFT_ENCODING.get(str(r.shift_type), 3)
            tier_map = {"low": 0, "medium": 1, "high": 2}
            activity_enc = tier_map.get(str(r.activity_tier), 1)
            feat = [
                float(r.active_days_last_30) / 30.0,
                float(r.avg_weekly_earnings) / 10000.0,
                float(r.avg_hourly_rate) / 200.0,
                float(zone_enc) / 2.0,
                float(shift_enc) / 3.0,
                float(activity_enc) / 2.0,
            ]
            if r.is_suspicious:
                anomaly_rows.append(feat)
            else:
                normal_rows.append(feat)

        # IsolationForest learns "normal" from honest riders.
        # We train only on honest riders so anomalous patterns score high.
        X = np.array(normal_rows, dtype=float)
        self.fraud_model = IsolationForest(
            random_state=42,
            contamination=0.08,
            n_estimators=220,
        )
        self.fraud_model.fit(X)
        decisions = self.fraud_model.decision_function(X)
        self._fraud_decision_floor = float(np.percentile(decisions, 5))
        self._fraud_decision_ceiling = float(np.percentile(decisions, 90))
        logger.info(
            "Fraud IsolationForest trained on %d honest riders (%d anomaly riders in dataset)",
            len(normal_rows), len(anomaly_rows),
        )

    # ──────────────────────────────────────────────────────────────
    # EARNINGS IMPACT — RandomForest from actual RiderActivity rows
    # ──────────────────────────────────────────────────────────────
    def _train_earnings_impact_from_activities(self, activities, zones, riders):
        """
        Train earnings impact using actual RiderActivity earnings combined with
        zone risk scores.

        Features:
          0  flood_risk_score (proxy for rainfall impact)
          1  heat_risk_score
          2  aqi_risk_score
          3  zone_tier_enc

        Target: normalised earnings ratio = rider_earnings / median_earnings
                clipped to [0.05, 1.0] — represents "fraction of normal earnings"
        """
        # Build zone risk lookup
        zone_risk = {}
        for z in zones:
            tier_enc = ZONE_TIER_ENCODING.get(
                z.tier.value if hasattr(z.tier, 'value') else str(z.tier), 1
            )
            zone_risk[z.id] = {
                "flood": float(z.flood_risk_score or 0.5),
                "heat": float(z.heat_risk_score or 0.5),
                "aqi": float(z.aqi_risk_score or 0.5),
                "tier_enc": tier_enc,
            }

        # Build rider→zone lookup using the real FK (rider.zone_id)
        rider_zone_map = {r.id: r.zone_id for r in riders}

        earnings_list = [float(a.earnings) for a in activities if a.earnings and a.earnings > 0]
        if not earnings_list:
            self._train_earnings_impact_synthetic()
            return
        median_earn = float(np.median(earnings_list))

        X_rows = []
        y_rows = []
        for a in activities:
            if not a.is_working or not a.earnings or a.earnings <= 0:
                continue
            zone_id = rider_zone_map.get(a.rider_id)
            zr = zone_risk.get(zone_id)
            if zr is None:
                continue
            impact = float(a.earnings) / median_earn
            impact = float(np.clip(impact, 0.05, 1.5))
            # Cap at 1.0 — we model "fraction of normal" not uplift
            impact = min(impact, 1.0)
            X_rows.append([
                zr["flood"],
                zr["heat"],
                zr["aqi"],
                float(zr["tier_enc"]),
            ])
            y_rows.append(impact)

        if len(X_rows) < 100:
            self._train_earnings_impact_synthetic()
            return

        X = np.array(X_rows, dtype=float)
        y = np.array(y_rows, dtype=float)
        self.earnings_impact_model = RandomForestRegressor(
            random_state=42, n_estimators=220, min_samples_leaf=4,
        )
        self.earnings_impact_model.fit(X, y)
        logger.info("Earnings Impact RF trained on %d real activity rows", len(y))

    # ──────────────────────────────────────────────────────────────
    # OPTIMIZER — Ridge from actual RiderActivity rows
    # ──────────────────────────────────────────────────────────────
    def _train_optimizer_from_activities(self, activities, riders, zones):
        """
        Train shift optimizer using actual earnings, hours, and deliveries from
        the 91,000 activity records.

        Features:
          0  hours_active          (how long the rider worked)
          1  deliveries_completed  (volume)
          2  zone_tier_enc         (from rider.zone_id FK → zone.tier)
          3  shift_enc             (morning/evening/night/flexible)
          4  avg_hourly_rate       (rider's baseline rate)

        Target: actual daily earnings
        """
        # Build zone tier lookup
        zone_tier_map = {
            z.id: ZONE_TIER_ENCODING.get(
                z.tier.value if hasattr(z.tier, 'value') else str(z.tier), 1
            )
            for z in zones
        }

        # Build rider profile lookup using real zone FK
        rider_info = {
            r.id: {
                "shift_enc": SHIFT_ENCODING.get(str(r.shift_type), 3),
                "avg_hourly_rate": float(r.avg_hourly_rate or 90.0),
                "zone_tier_enc": zone_tier_map.get(r.zone_id, 1),
            }
            for r in riders
        }

        X_rows = []
        y_rows = []
        for a in activities:
            if not a.is_working or not a.earnings or a.earnings <= 0:
                continue
            rinfo = rider_info.get(a.rider_id)
            if rinfo is None:
                continue
            X_rows.append([
                float(a.hours_active or 0.0),
                float(a.deliveries_completed or 0),
                float(rinfo["zone_tier_enc"]),
                float(rinfo["shift_enc"]),
                float(rinfo["avg_hourly_rate"]),
            ])
            y_rows.append(float(a.earnings))

        if len(X_rows) < 100:
            self._train_optimizer_synthetic()
            return

        X = np.array(X_rows, dtype=float)
        y = np.array(y_rows, dtype=float)
        self.optimizer_model = Ridge(alpha=1.0)
        self.optimizer_model.fit(X, y)
        logger.info("Optimizer Ridge trained on %d real activity rows", len(y))

    # ──────────────────────────────────────────────────────────────
    # Synthetic fallbacks (used if DB is empty / not yet seeded)
    # ──────────────────────────────────────────────────────────────
    def _train_earnings_impact_synthetic(self):
        X, y = self._build_earnings_impact_dataset()
        self.earnings_impact_model = RandomForestRegressor(
            random_state=42, n_estimators=220, min_samples_leaf=4,
        )
        self.earnings_impact_model.fit(X, y)

    def _train_fraud_synthetic(self):
        X = self._build_fraud_dataset()
        self.fraud_model = IsolationForest(
            random_state=42, contamination=0.08, n_estimators=220,
        )
        self.fraud_model.fit(X)
        decisions = self.fraud_model.decision_function(X)
        self._fraud_decision_floor = float(np.percentile(decisions, 5))
        self._fraud_decision_ceiling = float(np.percentile(decisions, 90))

    def _train_optimizer_synthetic(self):
        X, y = self._build_optimizer_dataset()
        self.optimizer_model = Ridge(alpha=1.0)
        self.optimizer_model.fit(X, y)

    # ──────────────────────────────────────────────────────────────
    # Inference methods (unchanged API)
    # ──────────────────────────────────────────────────────────────
    def month_features(self, month: int) -> tuple[float, float]:
        angle = (2 * math.pi * month) / 12
        return math.sin(angle), math.cos(angle)

    def zone_tier_to_enc(self, zone_tier: str) -> int:
        return ZONE_TIER_ENCODING.get(str(zone_tier).lower(), 1)

    def city_tier_to_enc(self, city_tier: str) -> int:
        return CITY_TIER_ENCODING.get(str(city_tier).lower(), 1)

    def get_pricing_inputs(self, city: str, zone_tier: str, month: int, city_tier: str | None = None) -> dict | None:
        self.initialize()
        city_key = city.lower()
        risk_data = self.risk_probabilities.get(city_key, {}).get(month)
        if not risk_data:
            return None
        zone_key = zone_tier.lower()
        resolved_city_tier = city_tier or self.city_tier_map.get(city_key, "tier_2")
        peril_probabilities = [
            float(risk_data.get(peril, {}).get(zone_key, 0.0))
            for peril in PERIL_ORDER
        ]
        actuarial = self._actuarial_summary(peril_probabilities, zone_key, resolved_city_tier)
        month_sin, month_cos = self.month_features(month)
        return {
            "month_sin": month_sin,
            "month_cos": month_cos,
            "zone_tier_enc": self.zone_tier_to_enc(zone_key),
            "city_tier_enc": self.city_tier_to_enc(resolved_city_tier),
            "peril_probabilities": peril_probabilities,
            "actuarial": actuarial,
        }

    def predict_premium(self, month_sin, month_cos, zone_tier_enc, city_tier_enc,
                        peril_probabilities, total_expected_loss, coefficient_of_variation,
                        safety_loading) -> float:
        self.initialize()
        if self.pricing_model is None:
            return 50.0
        feature_vector = np.array([[
            month_sin, month_cos, float(zone_tier_enc), float(city_tier_enc),
            *[float(p) for p in peril_probabilities[:len(PERIL_ORDER)]],
            float(total_expected_loss), float(coefficient_of_variation), float(safety_loading),
        ]])
        return float(np.clip(self.pricing_model.predict(feature_vector)[0], 30.0, 70.0))

    def predict_earnings_impact(self, rainfall_mm: float, temp_max: float,
                                aqi: float, zone_tier_enc: int) -> float:
        self.initialize()
        if self.earnings_impact_model is None:
            return 1.0
        # Map external weather inputs to the zone risk features the model was trained on
        # rainfall → flood_risk proxy, temp → heat_risk proxy, aqi → aqi_risk proxy
        flood_proxy = float(np.clip(rainfall_mm / 300.0, 0.0, 1.0))
        heat_proxy  = float(np.clip((temp_max - 45.0) / 5.0, 0.0, 1.0))   # 45–50°C: trigger zone
        aqi_proxy   = float(np.clip(aqi / 500.0, 0.0, 1.0))               # CPCB max = 500
        feature_vector = np.array([[flood_proxy, heat_proxy, aqi_proxy, float(zone_tier_enc)]])
        predicted = float(self.earnings_impact_model.predict(feature_vector)[0])
        predicted = 1.0 - ((1.0 - predicted) * 1.08)
        return float(np.clip(predicted, 0.05, 1.0))

    def fraud_anomaly_score(self, features: list[float]) -> float:
        self.initialize()
        if self.fraud_model is None:
            return 0.0
        decision = float(self.fraud_model.decision_function([features])[0])
        span = max(self._fraud_decision_ceiling - self._fraud_decision_floor, 1e-6)
        scaled = (self._fraud_decision_ceiling - decision) / span
        bonus = float(np.clip(scaled * 17.0, 0.0, 17.0))
        if features[0] > 3.0:
            bonus = min(18.0, bonus + 1.0)
        return round(bonus, 1)

    def predict_block_earnings(self, base_block_rate: float, zone_tier_enc: int,
                               day_of_week: int, earnings_impact: float,
                               rider_rate: float) -> float:
        self.initialize()
        if self.optimizer_model is None:
            return max(base_block_rate * earnings_impact, 0.0)
        # Map to optimizer features: hours≈4, deliveries≈15 (block estimate), zone, shift=0, rate
        feature_vector = np.array([[
            4.0,       # estimated hours for a block
            15.0,      # estimated deliveries for a block
            float(zone_tier_enc),
            0.0,       # morning shift (most blocks are AM)
            float(rider_rate),
        ]])
        predicted = float(self.optimizer_model.predict(feature_vector)[0])
        # Scale by earnings_impact to apply weather/disruption effect
        return round(max(predicted * earnings_impact, 0.0), 0)

    # ──────────────────────────────────────────────────────────────
    # Pricing training data (actuarial — always real)
    # ──────────────────────────────────────────────────────────────
    def _build_pricing_dataset(self) -> tuple[np.ndarray, np.ndarray]:
        X_rows: list[list[float]] = []
        y_rows: list[float] = []
        for city, months in self.risk_probabilities.items():
            city_tier = self.city_tier_map.get(city, "tier_2")
            city_tier_enc = self.city_tier_to_enc(city_tier)
            for month, risk_data in months.items():
                month_sin, month_cos = self.month_features(month)
                for zone_tier in ("low", "medium", "high"):
                    peril_probabilities = [
                        float(risk_data.get(peril, {}).get(zone_tier, 0.0))
                        for peril in PERIL_ORDER
                    ]
                    actuarial = self._actuarial_summary(peril_probabilities, zone_tier, city_tier)
                    X_rows.append([
                        month_sin, month_cos,
                        float(self.zone_tier_to_enc(zone_tier)),
                        float(city_tier_enc),
                        *peril_probabilities,
                        actuarial["expected_loss"],
                        actuarial["coefficient_of_variation"],
                        actuarial["safety_loading"],
                    ])
                    y_rows.append(actuarial["loaded_premium"])
        return np.array(X_rows, dtype=float), np.array(y_rows, dtype=float)

    # ──────────────────────────────────────────────────────────────
    # Rule-derived synthetic fallbacks
    # ──────────────────────────────────────────────────────────────
    def _build_earnings_impact_dataset(self) -> tuple[np.ndarray, np.ndarray]:
        rain_t = self.trigger_thresholds["rainfall"]
        heat_t = self.trigger_thresholds["heat"]
        aqi_t = self.trigger_thresholds["aqi"]
        rng = np.random.default_rng(42)
        X_rows: list[list[float]] = []
        y_rows: list[float] = []
        for idx in range(8000):
            if idx % 3 == 0:
                rainfall = float(np.clip(rng.normal(rain_t["level_1"], 18), 0, 160))
                temp_max = float(np.clip(rng.normal(heat_t["level_1"], 3.5), 25, 52))
                aqi = float(np.clip(rng.normal(aqi_t["level_1"], 110), 40, 760))
            else:
                rainfall = float(rng.uniform(0, 160))
                temp_max = float(rng.uniform(26, 52))
                aqi = float(rng.uniform(40, 760))
            zone_tier_enc = int(rng.integers(0, 3))
            # Convert to zone risk proxies (same feature space as DB-trained model)
            flood_proxy = float(np.clip(rainfall / 120.0, 0.0, 1.0))
            heat_proxy = float(np.clip((temp_max - 25.0) / 27.0, 0.0, 1.0))
            aqi_proxy = float(np.clip(aqi / 760.0, 0.0, 1.0))
            target = self._synthetic_earnings_impact_target(rainfall, temp_max, aqi, zone_tier_enc, rng)
            X_rows.append([flood_proxy, heat_proxy, aqi_proxy, float(zone_tier_enc)])
            y_rows.append(target)
        return np.array(X_rows, dtype=float), np.array(y_rows, dtype=float)

    def _build_fraud_dataset(self) -> np.ndarray:
        rng = np.random.default_rng(7)
        rows = []
        for _ in range(3000):
            rows.append([
                float(np.clip(rng.normal(0.70, 0.12), 0.2, 1.0)),   # active_days ratio
                float(np.clip(rng.normal(0.55, 0.16), 0.08, 1.0)),  # earnings ratio
                float(np.clip(rng.normal(0.55, 0.15), 0.1, 1.0)),   # hourly rate ratio
                float(np.clip(rng.normal(0.55, 0.15), 0.1, 1.0)),   # zone tier
                float(np.clip(rng.normal(0.55, 0.15), 0.0, 1.0)),   # shift
                float(np.clip(rng.normal(0.74, 0.12), 0.2, 1.0)),   # activity tier
            ])
        return np.array(rows, dtype=float)

    def _build_optimizer_dataset(self) -> tuple[np.ndarray, np.ndarray]:
        rng = np.random.default_rng(99)
        X_rows: list[list[float]] = []
        y_rows: list[float] = []
        for _ in range(4000):
            hours = float(rng.uniform(1.0, 8.0))
            deliveries = int(rng.integers(0, 30))
            zone_tier_enc = int(rng.integers(0, 3))
            shift_enc = int(rng.integers(0, 4))
            rider_rate = float(np.clip(rng.normal(95, 18), 55, 165))
            zone_factor = {0: 0.93, 1: 1.0, 2: 1.08}[zone_tier_enc]
            rider_factor = 0.78 + 0.32 * (rider_rate / 120.0)
            target = (deliveries * rider_rate * zone_factor * rider_factor / 10.0
                      ) + float(rng.normal(0, 4))
            X_rows.append([hours, float(deliveries), float(zone_tier_enc), float(shift_enc), rider_rate])
            y_rows.append(max(target, 0.0))
        return np.array(X_rows, dtype=float), np.array(y_rows, dtype=float)

    def _actuarial_summary(self, peril_probabilities, zone_tier, city_tier) -> dict:
        probabilities = np.array(peril_probabilities, dtype=float)
        payouts = np.array([PRICING_DAILY_LOSS[peril] for peril in PERIL_ORDER], dtype=float)
        tier_multiplier = ZONE_LOSS_MULTIPLIER[zone_tier] * CITY_LOSS_MULTIPLIER[city_tier]
        weekly_exposures = payouts * 6.0 * tier_multiplier
        expected_components = probabilities * weekly_exposures
        expected_loss = float(expected_components.sum())
        variance_loss = float((probabilities * (1 - probabilities) * (weekly_exposures ** 2)).sum())
        std_loss = math.sqrt(max(variance_loss, 0.0))
        coefficient_of_variation = std_loss / max(expected_loss, 1.0)
        safety_loading = float(np.clip(variance_loss / max(2 * (expected_loss ** 2), 1.0), 0.05, 0.50))
        interaction_loading = 1.0
        rainfall, heat, cold_fog, aqi, traffic = (probabilities[i] for i in range(5))
        interaction_loading += (rainfall * traffic * 0.22)
        interaction_loading += (aqi * cold_fog * 0.14)
        interaction_loading += (heat * aqi * 0.10)
        loaded_premium = expected_loss * (1 + safety_loading) / (1 - 0.20 - 0.15)
        loaded_premium *= interaction_loading
        loaded_premium = float(np.clip(loaded_premium, 30.0, 75.0))
        return {
            "expected_loss": round(expected_loss, 2),
            "std_loss": round(std_loss, 2),
            "coefficient_of_variation": round(coefficient_of_variation, 3),
            "safety_loading": round(safety_loading, 3),
            "loaded_premium": round(loaded_premium, 2),
            "expected_components": {
                peril: round(float(expected_components[idx]), 2)
                for idx, peril in enumerate(PERIL_ORDER)
            },
        }

    def _synthetic_earnings_impact_target(self, rainfall_mm, temp_max, aqi, zone_tier_enc, rng) -> float:
        rain_loss = 0.0
        if rainfall_mm >= 65:
            rain_loss = 0.55 + 0.25 * min((rainfall_mm - 65) / 55, 1.0)
        elif rainfall_mm >= 35:
            rain_loss = 0.12 * ((rainfall_mm - 35) / 30)
        heat_loss = 0.0
        if temp_max >= 44:
            heat_loss = 0.22 + 0.18 * min((temp_max - 44) / 6, 1.0)
        elif temp_max >= 42:
            heat_loss = 0.08 * ((temp_max - 42) / 2)
        aqi_loss = 0.0
        if aqi >= 500:
            aqi_loss = 0.18 + 0.22 * min((aqi - 500) / 200, 1.0)
        elif aqi >= 400:
            aqi_loss = 0.08 * min((aqi - 400) / 100, 1.0)
        compound_loss = 0.0
        if rain_loss > 0.15 and heat_loss > 0.10:
            compound_loss += 0.10
        if rain_loss > 0.15 and aqi_loss > 0.10:
            compound_loss += 0.08
        if heat_loss > 0.10 and aqi_loss > 0.10:
            compound_loss += 0.05
        zone_loss = 0.03 * zone_tier_enc
        noise = float(rng.normal(0, 0.02))
        return float(np.clip(1.0 - rain_loss - heat_loss - aqi_loss - compound_loss - zone_loss + noise, 0.05, 1.0))


ml = MLRegistry()
