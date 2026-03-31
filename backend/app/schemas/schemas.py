"""Pydantic schemas for request/response validation."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


# ── Enums (mirror SQLAlchemy enums) ──

class ZoneTierEnum(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"

class TriggerTypeEnum(str, Enum):
    rainfall = "rainfall"
    heat = "heat"
    cold_fog = "cold_fog"
    aqi = "aqi"
    traffic = "traffic"
    social = "social"

class ClaimStatusEnum(str, Enum):
    auto_approved = "auto_approved"
    pending_review = "pending_review"
    approved = "approved"
    denied = "denied"
    paid = "paid"
    flagged = "flagged"

class PolicyStatusEnum(str, Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"
    waiting = "waiting"


# ── Auth ──

class RiderRegister(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., pattern=r"^\d{10}$")
    email: Optional[str] = None
    password: str = Field(..., min_length=6)
    zone_id: int
    dark_store_id: Optional[int] = None
    shift_type: str = "morning"

class RiderLogin(BaseModel):
    phone: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rider_id: int
    name: str

class TokenData(BaseModel):
    rider_id: Optional[int] = None


# ── City / Zone ──

class CityOut(BaseModel):
    id: int
    name: str
    state: str
    lat: float
    lng: float
    base_rate: float
    model_config = {"from_attributes": True}

class ZoneOut(BaseModel):
    id: int
    city_id: int
    name: str
    tier: ZoneTierEnum
    lat: float
    lng: float
    flood_risk_score: float
    heat_risk_score: float
    cold_risk_score: float
    aqi_risk_score: float
    traffic_risk_score: float
    social_risk_score: float
    model_config = {"from_attributes": True}

class DarkStoreOut(BaseModel):
    id: int
    zone_id: int
    name: str
    platform: str
    lat: float
    lng: float
    is_operational: bool
    model_config = {"from_attributes": True}


# ── Rider ──

class RiderOut(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str]
    zone_id: int
    dark_store_id: Optional[int]
    shift_type: str
    avg_weekly_earnings: float
    avg_hourly_rate: float
    shield_level: int
    shield_xp: float
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}

class RiderUpdate(BaseModel):
    zone_id: Optional[int] = None
    dark_store_id: Optional[int] = None
    shift_type: Optional[str] = None
    avg_weekly_earnings: Optional[float] = None
    avg_hourly_rate: Optional[float] = None

class RiderDashboard(BaseModel):
    rider: RiderOut
    zone: ZoneOut
    active_policy: Optional["PolicyOut"] = None
    recent_claims: List["ClaimOut"] = []
    shield_level: int
    weekly_earnings: float
    risk_summary: Dict[str, float] = {}


# ── Policy ──

class PolicyCreate(BaseModel):
    zone_id: int
    auto_renew: bool = True

class PolicyOut(BaseModel):
    id: int
    rider_id: int
    zone_id: int
    week_start: datetime
    week_end: datetime
    premium_amount: float
    premium_breakdown: Optional[Dict[str, Any]]
    coverage_triggers: Optional[Dict[str, Any]]
    status: PolicyStatusEnum
    auto_renew: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Claim ──

class ClaimOut(BaseModel):
    id: int
    rider_id: int
    policy_id: int
    trigger_reading_id: Optional[int] = None
    trigger_type: TriggerTypeEnum
    trigger_value: float
    trigger_threshold: float
    trigger_sources: Optional[Dict[str, Any]] = None
    payout_amount: float
    hours_lost: float
    hourly_rate_used: float
    fraud_score: float
    fraud_walls_passed: Optional[Any] = None
    status: ClaimStatusEnum
    event_time: datetime
    processed_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    review_notes: Optional[str] = None
    model_config = {"from_attributes": True}


# ── Trigger ──

class TriggerReadingOut(BaseModel):
    id: int
    city_id: Optional[int]
    zone_id: Optional[int]
    trigger_type: TriggerTypeEnum
    value: float
    threshold: float
    is_breached: bool
    duration_hours: Optional[float] = 1.0
    source: Optional[str] = None
    raw_data: Optional[Dict[str, Any]]
    timestamp: datetime
    model_config = {"from_attributes": True}

class TriggerStatusOut(BaseModel):
    city: str
    zone: Optional[str]
    active_triggers: List[Dict[str, Any]]
    last_checked: Optional[datetime]


# ── Pricing ──

class PremiumQuote(BaseModel):
    city: str
    zone_tier: ZoneTierEnum
    month: int
    base_rate: float
    breakdown: Dict[str, float]
    total_weekly_premium: float

class RateCardOut(BaseModel):
    id: int
    city_id: int
    zone_tier: ZoneTierEnum
    month: int
    base_rate: float
    rainfall_rate: float
    heat_rate: float
    cold_fog_rate: float
    aqi_rate: float
    traffic_rate: float
    social_rate: float
    total_premium: float
    model_config = {"from_attributes": True}


# ── Fraud ──

class FraudCheckOut(BaseModel):
    claim_id: int
    fraud_score: float
    classification: str
    walls: List[Dict[str, Any]]
    auto_approved: bool
    processing_time: str


# ── Admin ──

class AdminStats(BaseModel):
    total_riders: int
    active_policies: int
    total_claims_today: int
    total_payouts_today: float
    active_triggers: List[Dict[str, Any]]
    zone_risk_summary: List[Dict[str, Any]]

class LiveFeedItem(BaseModel):
    rider_id: int
    rider_name: str
    location: str
    trigger: str
    status: str
    payout: float
    time: str


# ── Prediction ──

class PredictionOut(BaseModel):
    zone_id: int
    zone_name: str
    forecast_days: List[Dict[str, Any]]
    recommended_shifts: List[Dict[str, Any]]


# ── Optimization ──

class OptimizeRequest(BaseModel):
    rider_id: int
    days_ahead: int = 7

class OptimizeOut(BaseModel):
    rider_id: int
    current_weekly_earnings: float
    optimized_weekly_earnings: float
    improvement_pct: float
    recommendations: List[Dict[str, Any]]
