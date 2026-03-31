"""Wall 1 — Proof of Work Loss (0-30 pts). Was the rider actually working?"""

from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import RiderActivity, TriggerReading

THRESHOLDS = {
    "min_hours_full_payout": 2.0,
    "min_hours_partial_payout": 0.5,
    "min_deliveries": 1,
    "suspicious_login_window_minutes": 30,
    "min_gps_points": 5,
}


async def check_proof_of_work(db: AsyncSession, rider_id: int, trigger_reading: TriggerReading) -> dict:
    trigger_time = trigger_reading.timestamp
    trigger_date = trigger_time.replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(RiderActivity).where(
            RiderActivity.rider_id == rider_id,
            RiderActivity.date >= trigger_date,
            RiderActivity.date < trigger_date + timedelta(days=1),
        )
    )
    activity = result.scalar_one_or_none()

    if not activity:
        return {"passed": False, "score": 30.0, "details": {"reason": "No activity record found", "issues": ["No activity record"]}}

    issues = []
    score = 0.0

    if activity.hours_active < THRESHOLDS["min_hours_partial_payout"]:
        score += 15.0
        issues.append(f"Only {activity.hours_active}h active (need >= {THRESHOLDS['min_hours_partial_payout']}h)")
    elif activity.hours_active < THRESHOLDS["min_hours_full_payout"]:
        score += 5.0
        issues.append(f"Only {activity.hours_active}h active (partial)")

    if activity.deliveries_completed == 0:
        score += 10.0
        issues.append("Zero deliveries completed")
    elif activity.deliveries_completed < THRESHOLDS["min_deliveries"]:
        score += 3.0
        issues.append(f"Only {activity.deliveries_completed} delivery")

    if activity.login_time and trigger_time:
        minutes_before = (trigger_time - activity.login_time).total_seconds() / 60
        if 0 < minutes_before < THRESHOLDS["suspicious_login_window_minutes"]:
            score += 8.0
            issues.append(f"Logged in {int(minutes_before)} min before trigger")
        elif minutes_before <= 0:
            score += 12.0
            issues.append("Logged in AFTER the trigger event")

    gps_points = activity.gps_points or []
    if len(gps_points) < THRESHOLDS["min_gps_points"]:
        score += 5.0
        issues.append(f"Only {len(gps_points)} GPS points")
    elif len(gps_points) >= 2:
        lats = [p.get("lat", 0) for p in gps_points]
        lngs = [p.get("lng", 0) for p in gps_points]
        spread = max(max(lats) - min(lats), max(lngs) - min(lngs))
        if spread < 0.001:
            score += 7.0
            issues.append(f"GPS shows no real movement (spread: {spread:.4f})")

    score = min(score, 30.0)
    return {"passed": score < 15.0, "score": round(score, 1), "details": {
        "hours_active": activity.hours_active,
        "deliveries": activity.deliveries_completed,
        "gps_points_count": len(gps_points),
        "issues": issues,
    }}
