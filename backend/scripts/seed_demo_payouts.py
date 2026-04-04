import asyncio
import random
from datetime import datetime, timezone
from sqlalchemy import select, text
from app.core.database import async_session
from app.models.models import Rider, Claim, ClaimStatus, PayoutStatus, TriggerType, Policy

async def seed_payouts():
    async with async_session() as db:
        # Increase timeout for SQLite locks
        await db.execute(text("PRAGMA busy_timeout = 5000"))
        
        # Get 20 riders
        rider_result = await db.execute(select(Rider).limit(20))
        riders = rider_result.scalars().all()
        
        if not riders:
            print("No riders found to seed claims for.")
            return

        for rider in riders:
            # Get an active policy for this rider
            policy_result = await db.execute(select(Policy).where(Policy.rider_id == rider.id).limit(1))
            policy = policy_result.scalar_one_or_none()
            if not policy:
                continue

            trigger_val = random.choice(list(TriggerType))
            
            payout = 240.0
            if policy.coverage_triggers and trigger_val.value in policy.coverage_triggers:
                payout = policy.coverage_triggers[trigger_val.value]

            # Create an approved claim that hasn't been paid
            claim = Claim(
                rider_id=rider.id,
                policy_id=policy.id,
                trigger_type=trigger_val,
                trigger_value=120.0,
                trigger_threshold=64.5,
                payout_amount=payout,
                status=ClaimStatus.APPROVED,
                payout_status=PayoutStatus.NOT_INITIATED,
                event_time=datetime.now(timezone.utc)
            )
            db.add(claim)
        
        await db.commit()
        print(f"Seeded approved claims for payout demo.")

from sqlalchemy import text
if __name__ == "__main__":
    asyncio.run(seed_payouts())
