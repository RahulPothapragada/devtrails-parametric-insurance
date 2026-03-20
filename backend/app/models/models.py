"""SQLAlchemy ORM Models for FlowSecure."""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Enum, ForeignKey, JSON, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


# ── Enums ──

class ZoneTier(str, enum.Enum):
    HIGH = "high"       # Tier 1: Flood-prone, poor drainage
    MEDIUM = "medium"   # Tier 2: Occasional disruption
    LOW = "low"         # Tier 3: Elevated, good drainage


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

    zones = relationship("Zone", back_populates="city")


class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    name = Column(String(200), nullable=False)
    tier = Column(Enum(ZoneTier), default=ZoneTier.MEDIUM)
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

    # Profile
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)
    dark_store_id = Column(Integer, ForeignKey("dark_stores.id"), nullable=True)
    shift_type = Column(String(20), default="morning")  # morning, evening, night, flexible
    avg_weekly_earnings = Column(Float, default=5000.0)
    avg_hourly_rate = Column(Float, default=90.0)

    # Shield Level (1-5)
    shield_level = Column(Integer, default=1)
    shield_xp = Column(Float, default=0.0)

    # Fraud Score (hidden, 0-100)
    fraud_score = Column(Float, default=0.0)

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


class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(Integer, ForeignKey("riders.id"), nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=False)

    week_start = Column(DateTime, nullable=False)
    week_end = Column(DateTime, nullable=False)

    premium_amount = Column(Float, nullable=False)
    premium_breakdown = Column(JSON, nullable=True)  # Per-trigger breakdown

    # Coverage details
    coverage_triggers = Column(JSON, nullable=True)  # Which triggers + payout limits

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

    # Trigger details
    trigger_type = Column(Enum(TriggerType), nullable=False)
    trigger_value = Column(Float, nullable=False)  # e.g., 45mm rainfall
    trigger_threshold = Column(Float, nullable=False)  # e.g., 15mm threshold
    trigger_sources = Column(JSON, nullable=True)  # Multi-source data

    # Payout
    payout_amount = Column(Float, default=0.0)
    hours_lost = Column(Float, default=0.0)
    hourly_rate_used = Column(Float, default=0.0)

    # Fraud detection results
    fraud_score = Column(Float, default=0.0)
    fraud_walls_passed = Column(JSON, nullable=True)  # Wall 1-7 results

    # Status
    status = Column(Enum(ClaimStatus), default=ClaimStatus.AUTO_APPROVED)

    # Timestamps
    event_time = Column(DateTime, nullable=False)
    processed_at = Column(DateTime, server_default=func.now())
    paid_at = Column(DateTime, nullable=True)

    rider = relationship("Rider", back_populates="claims")
    policy = relationship("Policy", back_populates="claims")


class TriggerReading(Base):
    __tablename__ = "trigger_readings"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)

    trigger_type = Column(Enum(TriggerType), nullable=False)
    value = Column(Float, nullable=False)
    threshold = Column(Float, nullable=False)
    is_breached = Column(Boolean, default=False)

    source = Column(String(100), nullable=False)  # API source name
    raw_data = Column(JSON, nullable=True)

    timestamp = Column(DateTime, server_default=func.now())


class PremiumRateCard(Base):
    __tablename__ = "premium_rate_cards"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    zone_tier = Column(Enum(ZoneTier), nullable=False)
    month = Column(Integer, nullable=False)  # 1-12

    base_rate = Column(Float, nullable=False)
    rainfall_rate = Column(Float, default=0.0)
    heat_rate = Column(Float, default=0.0)
    cold_fog_rate = Column(Float, default=0.0)
    aqi_rate = Column(Float, default=0.0)
    traffic_rate = Column(Float, default=0.0)
    social_rate = Column(Float, default=0.0)

    total_premium = Column(Float, nullable=False)

    # Metadata
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
