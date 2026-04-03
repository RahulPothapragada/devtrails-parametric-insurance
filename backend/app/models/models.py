"""SQLAlchemy ORM Models for FlowSecure."""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, JSON, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


# ── Enums ──

class CityTier(str, enum.Enum):
    TIER_1 = "tier_1"   # Metros: Mumbai, Delhi, Bangalore, Chennai, Kolkata
    TIER_2 = "tier_2"   # Major cities: Pune, Hyderabad, Ahmedabad, Jaipur
    TIER_3 = "tier_3"   # Smaller cities: Lucknow, Indore, Patna, Bhopal


class AreaType(str, enum.Enum):
    URBAN = "urban"
    SEMI_URBAN = "semi_urban"
    RURAL = "rural"


class ZoneTier(str, enum.Enum):
    HIGH = "high"       # High risk: Flood-prone, poor drainage
    MEDIUM = "medium"   # Medium risk: Occasional disruption
    LOW = "low"         # Low risk: Elevated, good drainage


class TriggerType(str, enum.Enum):
    RAINFALL = "rainfall"
    HEAT = "heat"
    COLD_FOG = "cold_fog"
    AQI = "aqi"
    TRAFFIC = "traffic"
    SOCIAL = "social"


class ClaimStatus(str, enum.Enum):
    AUTO_APPROVED = "auto_approved"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    DENIED = "denied"
    PAID = "paid"
    FLAGGED = "flagged"


class PayoutStatus(str, enum.Enum):
    NOT_INITIATED = "not_initiated"
    INITIATED = "initiated"
    PROCESSING = "processing"
    CONFIRMED = "confirmed"
    FAILED = "failed"
    ROLLED_BACK = "rolled_back"


class PayoutChannel(str, enum.Enum):
    UPI = "upi"
    IMPS = "imps"
    RAZORPAY = "razorpay"


class PolicyStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    WAITING = "waiting"  # 4-week waiting period


# ── Models ──

class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    state = Column(String(100), nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    base_rate = Column(Float, default=20.0)  # Base weekly premium
    city_tier = Column(Enum(CityTier), default=CityTier.TIER_1)

    zones = relationship("Zone", back_populates="city")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    name = Column(String(200), nullable=False)
    tier = Column(Enum(ZoneTier), default=ZoneTier.MEDIUM)
    area_type = Column(Enum(AreaType), default=AreaType.URBAN)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)

    # Risk multipliers (updated by ML model)
    flood_risk_score = Column(Float, default=0.5)
    heat_risk_score = Column(Float, default=0.5)
    cold_risk_score = Column(Float, default=0.5)
    aqi_risk_score = Column(Float, default=0.5)
    traffic_risk_score = Column(Float, default=0.5)
    social_risk_score = Column(Float, default=0.3)

    city = relationship("City", back_populates="zones")
    dark_stores = relationship("DarkStore", back_populates="zone")
    riders = relationship("Rider", back_populates="zone")
    trigger_readings = relationship("TriggerReading", back_populates="zone")


class DarkStore(Base):
    __tablename__ = "dark_stores"

    id = Column(Integer, primary_key=True, index=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    name = Column(String(200), nullable=False)
    platform = Column(String(50), default="Zepto")  # Zepto, Blinkit, etc.
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    is_operational = Column(Boolean, default=True)

    zone = relationship("Zone", back_populates="dark_stores")
    riders = relationship("Rider", back_populates="dark_store")


class Rider(Base):
    __tablename__ = "riders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(15), unique=True, nullable=False)
    email = Column(String(200), unique=True, nullable=True)
    password_hash = Column(String(500), nullable=False)
    upi_id = Column(String(100), nullable=True)

    # Profile
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    dark_store_id = Column(Integer, ForeignKey("dark_stores.id"), nullable=True)
    shift_type = Column(String(20), default="morning")
    avg_weekly_earnings = Column(Float, default=5000.0)
    avg_hourly_rate = Column(Float, default=90.0)
    
    # Underwriting / Activity
    active_days_last_30 = Column(Integer, default=20)
    activity_tier = Column(String(20), default="high")  # 'high', 'medium', 'low'

    # Shield Level (1-5)
    shield_level = Column(Integer, default=1)
    shield_xp = Column(Float, default=0.0)

    # Fraud Score (hidden, 0-100)
    fraud_score = Column(Float, default=0.0)
    is_suspicious = Column(Boolean, default=False)

    # KYC
    aadhaar_verified = Column(Boolean, default=False)
    device_fingerprint = Column(String(500), nullable=True)

    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    zone = relationship("Zone", back_populates="riders")
    dark_store = relationship("DarkStore", back_populates="riders")
    policies = relationship("Policy", back_populates="rider")
    claims = relationship("Claim", back_populates="rider")
    activities = relationship("RiderActivity", back_populates="rider")


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)

    week_start = Column(DateTime, nullable=False)
    week_end = Column(DateTime, nullable=False)

    premium_amount = Column(Float, nullable=False)
    premium_breakdown = Column(JSON, nullable=True)

    coverage_triggers = Column(JSON, nullable=True)

    status = Column(Enum(PolicyStatus), default=PolicyStatus.ACTIVE)
    auto_renew = Column(Boolean, default=True)

    created_at = Column(DateTime, server_default=func.now())

    rider = relationship("Rider", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")


class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False)
    policy_id = Column(Integer, ForeignKey("policies.id"), nullable=False)
    trigger_reading_id = Column(Integer, ForeignKey("trigger_readings.id"), nullable=True)

    # Trigger details
    trigger_type = Column(Enum(TriggerType), nullable=False)
    trigger_value = Column(Float, nullable=False)
    trigger_threshold = Column(Float, nullable=False)
    trigger_sources = Column(JSON, nullable=True)

    # Payout
    payout_amount = Column(Float, default=0.0)
    hours_lost = Column(Float, default=0.0)
    hourly_rate_used = Column(Float, default=0.0)

    # Payout lifecycle
    payout_status = Column(Enum(PayoutStatus), default=PayoutStatus.NOT_INITIATED)
    payout_channel = Column(Enum(PayoutChannel), nullable=True)
    payout_ref = Column(String(100), nullable=True)   # txn ID / UPI ref
    payout_initiated_at = Column(DateTime, nullable=True)
    payout_confirmed_at = Column(DateTime, nullable=True)
    payout_failure_reason = Column(String(500), nullable=True)

    # Fraud detection results
    fraud_score = Column(Float, default=0.0)
    fraud_walls_passed = Column(JSON, nullable=True)

    # Status
    status = Column(Enum(ClaimStatus), default=ClaimStatus.AUTO_APPROVED)

    # Timestamps
    event_time = Column(DateTime, nullable=False)
    processed_at = Column(DateTime, server_default=func.now())
    paid_at = Column(DateTime, nullable=True)
    review_notes = Column(Text, nullable=True)

    rider = relationship("Rider", back_populates="claims")
    policy = relationship("Policy", back_populates="claims")
    trigger_reading = relationship("TriggerReading", back_populates="claims")
    fraud_checks = relationship("FraudCheck", back_populates="claim")


class TriggerReading(Base):
    __tablename__ = "trigger_readings"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)

    trigger_type = Column(Enum(TriggerType), nullable=False)
    value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    is_breached = Column(Boolean, default=False)
    duration_hours = Column(Float, default=1.0)

    source = Column(String(100), nullable=True)
    raw_data = Column(JSON, nullable=True)

    timestamp = Column(DateTime, server_default=func.now())

    zone = relationship("Zone", back_populates="trigger_readings")
    claims = relationship("Claim", back_populates="trigger_reading")


class FraudCheck(Base):
    """Individual fraud wall check result — one row per wall per claim."""
    __tablename__ = "fraud_checks"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(Integer, ForeignKey("claims.id"), nullable=False)
    wall_number = Column(Integer, nullable=False)
    wall_name = Column(String(100), nullable=False)
    passed = Column(Boolean, default=True)
    score = Column(Float, default=0.0)
    details = Column(JSON, nullable=True)
    checked_at = Column(DateTime, server_default=func.now())

    claim = relationship("Claim", back_populates="fraud_checks")


class RiderActivity(Base):
    """Mock platform data — simulates rider activity on the delivery platform."""
    __tablename__ = "rider_activities"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    hours_active = Column(Float, default=0.0)
    deliveries_completed = Column(Integer, default=0)
    gps_points = Column(JSON, nullable=True)
    login_time = Column(DateTime, nullable=True)
    logout_time = Column(DateTime, nullable=True)
    earnings = Column(Float, default=0.0)
    is_working = Column(Boolean, default=True)

    rider = relationship("Rider", back_populates="activities")


class WeeklyLedger(Base):
    """Weekly actuarial ledger — tracks premiums collected vs claims paid per city per week."""
    __tablename__ = "weekly_ledgers"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    week_start = Column(DateTime, nullable=False)
    week_end = Column(DateTime, nullable=False)

    # Premiums
    total_policies = Column(Integer, default=0)
    premium_collected = Column(Float, default=0.0)

    # Claims
    total_claims = Column(Integer, default=0)
    claims_approved = Column(Integer, default=0)
    claims_denied = Column(Integer, default=0)
    total_payout = Column(Float, default=0.0)

    # Actuarial metrics
    loss_ratio = Column(Float, default=0.0)       # total_payout / premium_collected
    bcr = Column(Float, default=0.0)               # burning cost rate
    avg_claim_amount = Column(Float, default=0.0)

    # Area breakdown
    urban_claims = Column(Integer, default=0)
    semi_urban_claims = Column(Integer, default=0)
    rural_claims = Column(Integer, default=0)
    urban_payout = Column(Float, default=0.0)
    semi_urban_payout = Column(Float, default=0.0)
    rural_payout = Column(Float, default=0.0)

    created_at = Column(DateTime, server_default=func.now())


class PremiumRateCard(Base):
    __tablename__ = "premium_rate_cards"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    zone_tier = Column(Enum(ZoneTier), nullable=False)
    month = Column(Integer, nullable=False)

    base_rate = Column(Float, nullable=False)
    rainfall_rate = Column(Float, default=0.0)
    heat_rate = Column(Float, default=0.0)
    cold_fog_rate = Column(Float, default=0.0)
    aqi_rate = Column(Float, default=0.0)
    traffic_rate = Column(Float, default=0.0)
    social_rate = Column(Float, default=0.0)

    total_premium = Column(Float, nullable=False)

    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
