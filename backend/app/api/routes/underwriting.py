"""
Underwriting & Onboarding Router.
Satisfies req: 'Keep underwriting and onboarding under 4-5 steps.'
1. Identity
2. Check minimal active days (7 days rule)
3. Zone mapping
4. Policy issue
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.database import get_db
from app.models.models import Rider, Policy, Zone
from datetime import datetime, timezone, timedelta

router = APIRouter()

class OnboardRequest(BaseModel):
    rider_id: int
    city_name: str
    shift_type: str = "morning"

@router.post("/onboard")
async def onboard_rider(req: OnboardRequest, db: AsyncSession = Depends(get_db)):
    """
    Onboard a rider in exactly 4 steps:
    1. Verify Platform Worker stats (Mock)
    2. Enforce 7-day minimum activity rule
    3. Generate Policy based on localized pool
    4. Activate
    """
    
    # 1. Platform Identity Check
    rider_result = await db.execute(select(Rider).where(Rider.id == req.rider_id))
    rider = rider_result.scalar_one_or_none()
    
    if not rider:
        raise HTTPException(status_code=404, detail="Rider not found on partner platform.")

    # 2. Activity / Eligibility Check (Minimum 7 active delivery days before cover starts)
    if rider.active_days_last_30 < 7:
        raise HTTPException(
            status_code=400, 
            detail=f"Ineligible: Only {rider.active_days_last_30} active days in last 30 days. Needs >= 7."
        )
        
    # 3. Zone / Pool Mapping (City-based pools)
    zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id))
    zone = zone_result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=400, detail="Zone mapping failed.")

    # 4. Policy Generation
    now = datetime.now(timezone.utc)
    from app.services.pricing.pricing_engine import PricingEngine
    pricing = PricingEngine()
    
    # We call pricing with the rider's activity tier
    city_tier = "tier_1"
    area = zone.area_type.value if zone.area_type else "urban"
    zone_tier = zone.tier.value if zone.tier else "medium"
    
    rate_res = pricing.calculate_premium(
        city=req.city_name,
        zone_tier=zone_tier,
        month=now.month,
        city_tier=city_tier,
        area_type=area,
        activity_tier=rider.activity_tier
    )
    
    week_start = now - timedelta(days=now.weekday())
    week_end = week_start + timedelta(days=7)
    
    new_policy = Policy(
        rider_id=rider.id,
        zone_id=zone.id,
        week_start=week_start,
        week_end=week_end,
        premium_amount=rate_res["weekly_premium"],
        status="active"
    )
    db.add(new_policy)
    await db.commit()
    await db.refresh(new_policy)
    
    return {
        "status": "success",
        "message": "Onboarded successfully in < 5 steps.",
        "policy_id": new_policy.id,
        "weekly_premium": new_policy.premium_amount,
        "underwriting_checks_passed": [
            "Platform user verified",
            f"Active history ({rider.active_days_last_30} days) >= 7 days",
            f"Mapped to localized risk pool ({req.city_name} / {zone_tier})"
        ]
    }
