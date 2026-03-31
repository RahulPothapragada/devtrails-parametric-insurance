"""Authentication routes — register, login, me."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import hash_password, verify_password, create_access_token, get_current_rider
from app.models.models import Rider
from app.schemas.schemas import RiderRegister, RiderLogin, Token, RiderOut

router = APIRouter()


@router.post("/register", response_model=Token, status_code=201)
async def register(body: RiderRegister, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Rider).where(Rider.phone == body.phone))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Phone already registered")

    rider = Rider(
        name=body.name,
        phone=body.phone,
        email=body.email,
        password_hash=hash_password(body.password),
        zone_id=body.zone_id,
        dark_store_id=body.dark_store_id,
        shift_type=body.shift_type,
    )
    db.add(rider)
    await db.flush()

    token = create_access_token(data={"sub": rider.id})
    return Token(access_token=token, rider_id=rider.id, name=rider.name)


@router.post("/login", response_model=Token)
async def login(body: RiderLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Rider).where(Rider.phone == body.phone))
    rider = result.scalar_one_or_none()
    if not rider or not verify_password(body.password, rider.password_hash):
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    token = create_access_token(data={"sub": rider.id})
    return Token(access_token=token, rider_id=rider.id, name=rider.name)


@router.get("/me", response_model=RiderOut)
async def get_me(rider: Rider = Depends(get_current_rider)):
    return rider
