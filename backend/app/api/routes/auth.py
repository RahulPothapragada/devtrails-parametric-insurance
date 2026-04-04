"""Authentication routes — register, login (OTP-based), me."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field
from typing import Optional
import random

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_access_token, get_current_rider
from app.models.models import Rider
from app.schemas.schemas import Token, RiderOut

router = APIRouter()

# In-memory OTP store for hackathon demo (production would use Redis + SMS gateway)
_otp_store: dict[str, str] = {}


# ── Schemas ──

class RegisterBody(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    phone: str = Field(..., pattern=r"^\d{10}$")
    email: str = Field(..., min_length=5)
    dob: str = Field(...)           # "YYYY-MM-DD"
    aadhaar: str = Field(..., min_length=12, max_length=12)
    bank_account: str = Field(...)
    bank_ifsc: str = Field(...)
    upi_id: str = Field(...)
    imei: str = Field(...)
    age: int = Field(...)
    password: str = Field(..., min_length=6)
    zone_id: int = 1
    shift_type: str = "morning"


class OTPRequest(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")


class OTPVerify(BaseModel):
    phone: str = Field(..., pattern=r"^\d{10}$")
    otp: str = Field(..., pattern=r"^\d{4}$")


# ── Register ──

@router.post("/register", response_model=Token, status_code=201)
async def register(body: RegisterBody, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Rider).where(Rider.phone == body.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")

    rider = Rider(
        name=body.name,
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
        zone_id=body.zone_id,
        shift_type=body.shift_type,
        aadhaar_verified=bool(body.aadhaar),
        device_fingerprint=body.imei,
        upi_id=body.upi_id,
    )
    db.add(rider)
    await db.flush()

    token = create_access_token(data={"sub": str(rider.id)})
    return Token(access_token=token, rider_id=rider.id, name=rider.name)


# ── OTP Login Flow ──

@router.post("/send-otp", summary="Send OTP to phone (simulated)")
async def send_otp(body: OTPRequest, db: AsyncSession = Depends(get_db)):
    """Send a 4-digit OTP. For hackathon demo, OTP is always returned in response."""
    result = await db.execute(select(Rider).where(Rider.phone == body.phone))
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Phone not registered. Please sign up first.")

    otp = f"{random.randint(1000, 9999)}"
    _otp_store[body.phone] = otp
    # In production: send via SMS gateway (Twilio / MSG91)
    return {"message": f"OTP sent to +91 {body.phone}", "demo_otp": otp}


@router.post("/verify-otp", response_model=Token, summary="Verify OTP and login")
async def verify_otp(body: OTPVerify, db: AsyncSession = Depends(get_db)):
    stored = _otp_store.get(body.phone)
    if not stored or stored != body.otp:
        raise HTTPException(status_code=401, detail="Invalid or expired OTP")

    # Clear used OTP
    del _otp_store[body.phone]

    result = await db.execute(select(Rider).where(Rider.phone == body.phone))
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="Phone not registered")

    token = create_access_token(data={"sub": str(rider.id)})
    return Token(access_token=token, rider_id=rider.id, name=rider.name)


# ── Legacy password login (kept for compatibility) ──

class LoginBody(BaseModel):
    phone: str
    password: str

@router.post("/login", response_model=Token)
async def login(body: LoginBody, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rider).where(Rider.phone == body.phone))
    rider = result.scalar_one_or_none()
    if not rider or not verify_password(body.password, rider.password_hash):
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    token = create_access_token(data={"sub": str(rider.id)})
    return Token(access_token=token, rider_id=rider.id, name=rider.name)


# ── Me ──

@router.get("/me", response_model=RiderOut)
async def get_me(rider: Rider = Depends(get_current_rider)):
    return rider


# ── Demo login shortcut ──

@router.post("/demo-login", response_model=Token, summary="One-click demo login (no password)")
async def demo_login(db: AsyncSession = Depends(get_db)):
    """Hackathon demo shortcut: logs in as the first seeded rider."""
    result = await db.execute(select(Rider).order_by(Rider.id).limit(1))
    rider = result.scalar_one_or_none()
    if not rider:
        raise HTTPException(status_code=404, detail="No riders in DB. Run: python -m app.mock_data.seed_db")

    token = create_access_token(data={"sub": str(rider.id)})
    return Token(access_token=token, rider_id=rider.id, name=rider.name)
