"""Pricing routes — premium quotes and rate cards."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.models import PremiumRateCard
from app.schemas.schemas import PremiumQuote, RateCardOut
from app.services.pricing.pricing_engine import PricingEngine

router = APIRouter()
pricing_engine = PricingEngine()


@router.get("/quote", response_model=PremiumQuote)
async def get_premium_quote(
    city: str = Query(default="Mumbai"),
    zone_tier: str = Query(default="medium"),
    month: int = Query(default=7, ge=1, le=12),
):
    result = pricing_engine.calculate_premium(city=city, zone_tier=zone_tier, month=month)
    return PremiumQuote(
        city=result["city"],
        zone_tier=result["zone_tier"],
        month=result["month"],
        base_rate=result.get("weekly_premium", result.get("total_weekly_premium", 0)),
        breakdown=result.get("breakdown", {}),
        total_weekly_premium=result.get("total_weekly_premium", 0),
    )


@router.get("/rate-card", response_model=list[RateCardOut])
async def get_rate_cards(
    city_id: int = Query(default=1),
    month: int = Query(default=None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    query = select(PremiumRateCard).where(PremiumRateCard.city_id == city_id)
    if month:
        query = query.where(PremiumRateCard.month == month)
    query = query.order_by(PremiumRateCard.zone_tier, PremiumRateCard.month)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/annual/{city}/{zone_tier}")
async def annual_schedule(city: str, zone_tier: str):
    return pricing_engine.calculate_annual_schedule(city=city, zone_tier=zone_tier)
