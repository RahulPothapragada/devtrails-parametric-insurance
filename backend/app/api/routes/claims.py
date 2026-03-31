"""Claims routes — list and view claim details."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_rider
from app.models.models import Rider, Claim
from app.schemas.schemas import ClaimOut

router = APIRouter()


@router.get("/", response_model=list[ClaimOut])
async def list_claims(
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Claim)
        .where(Claim.rider_id == rider.id)
        .order_by(Claim.event_time.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/{claim_id}", response_model=ClaimOut)
async def get_claim(
    claim_id: int,
    rider: Rider = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Claim).where(Claim.id == claim_id, Claim.rider_id == rider.id)
    )
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    return claim
