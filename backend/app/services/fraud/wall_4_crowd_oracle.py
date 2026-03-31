"""Wall 4 — Crowd Oracle (0-15 pts). Compare rider vs zone peers."""

from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Rider, RiderActivity, TriggerReading

MIN_STOP_PCT = 0.30
HIGH_CONFIDENCE_PCT = 0.80


async def check_crowd_oracle(db: AsyncSession, rider_id: int, trigger_reading: TriggerReading) -> dict:
    trigger_date = trigger_reading.timestamp.replace(hour=0, minute=0, second=0)
    zone_id = trigger_reading.zone_id

    riders_result = await db.execute(
        select(Rider).where(Rider.zone_id == zone_id, Rider.is_active == True)
    )
    zone_riders = riders_result.scalars().all()

    if len(zone_riders) < 2:
        return {"passed": True, "score": 0.0, "details": {"reason": "Not enough riders for comparison"}}

    total_riders = len(zone_riders)
    riders_stopped = 0
    riders_continued = 0
    continued_earnings = []
    this_rider_stopped = False

    for r in zone_riders:
        act_result = await db.execute(
            select(RiderActivity).where(
                RiderActivity.rider_id == r.id,
                RiderActivity.date >= trigger_date,
                RiderActivity.date < trigger_date + timedelta(days=1),
            )
        )
        activity = act_result.scalar_one_or_none()

        if not activity or not activity.is_working or activity.deliveries_completed == 0:
            riders_stopped += 1
            if r.id == rider_id:
                this_rider_stopped = True
        else:
            riders_continued += 1
            continued_earnings.append(activity.earnings)
            if r.id == rider_id:
                this_rider_stopped = False

    stop_pct = riders_stopped / total_riders if total_riders > 0 else 0
    issues = []
    score = 0.0

    if stop_pct >= HIGH_CONFIDENCE_PCT:
        score = 0.0
    elif stop_pct >= MIN_STOP_PCT:
        if this_rider_stopped:
            score = 3.0
            issues.append(f"Moderate disruption: {stop_pct:.0%} of riders stopped")
    else:
        if this_rider_stopped:
            score = 12.0
            issues.append(f"Only {stop_pct:.0%} of zone riders stopped — not confirmed by peers")

    if continued_earnings and this_rider_stopped:
        avg_continued = sum(continued_earnings) / len(continued_earnings)
        if avg_continued > 400:
            score += 3.0
            issues.append(f"Continuing riders earned avg Rs.{avg_continued:.0f}")

    score = min(score, 15.0)
    return {"passed": score < 8.0, "score": round(score, 1), "details": {
        "total_zone_riders": total_riders,
        "riders_stopped": riders_stopped,
        "riders_continued": riders_continued,
        "stop_percentage": round(stop_pct * 100, 1),
        "this_rider_stopped": this_rider_stopped,
        "issues": issues,
    }}
