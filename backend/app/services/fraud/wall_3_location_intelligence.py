"""Wall 3 — Location Intelligence (0-20 pts). Was rider in the affected zone?"""

import math
from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.models import Rider, RiderActivity, Zone, TriggerReading

MAX_DISTANCE_KM = 3.0


async def check_location_intelligence(db: AsyncSession, rider_id: int, trigger_reading: TriggerReading) -> dict:
    rider_result = await db.execute(select(Rider).where(Rider.id == rider_id))
    rider = rider_result.scalar_one_or_none()
    zone_result = await db.execute(select(Zone).where(Zone.id == trigger_reading.zone_id))
    zone = zone_result.scalar_one_or_none()

    if not rider or not zone:
        return {"passed": False, "score": 15.0, "details": {"reason": "Rider or zone not found", "issues": []}}

    trigger_date = trigger_reading.timestamp.replace(hour=0, minute=0, second=0)
    act_result = await db.execute(
        select(RiderActivity).where(
            RiderActivity.rider_id == rider_id,
            RiderActivity.date >= trigger_date,
            RiderActivity.date < trigger_date + timedelta(days=1),
        )
    )
    activity = act_result.scalar_one_or_none()

    if not activity or not activity.gps_points:
        return {"passed": False, "score": 15.0, "details": {"reason": "No GPS data", "issues": ["No GPS data"]}}

    gps_points = activity.gps_points
    issues = []
    score = 0.0

    points_in_zone = 0
    for point in gps_points:
        dist = _haversine(zone.lat, zone.lng, point["lat"], point["lng"])
        if dist <= MAX_DISTANCE_KM:
            points_in_zone += 1

    total_points = len(gps_points)
    match_pct = points_in_zone / total_points if total_points > 0 else 0

    if match_pct < 0.3:
        score += 15.0
        issues.append(f"Only {match_pct:.0%} of GPS points in claimed zone ({points_in_zone}/{total_points})")
    elif match_pct < 0.6:
        score += 8.0
        issues.append(f"Only {match_pct:.0%} of GPS points match zone")

    if rider.zone_id != trigger_reading.zone_id:
        score += 5.0
        issues.append(f"Rider assigned to zone {rider.zone_id}, claim is for zone {trigger_reading.zone_id}")

    if total_points >= 2:
        lats = [p["lat"] for p in gps_points]
        lngs = [p["lng"] for p in gps_points]
        spread = max(max(lats) - min(lats), max(lngs) - min(lngs))
        if spread < 0.001:
            score += 5.0
            issues.append("GPS points clustered — no real movement")

    score = min(score, 20.0)
    return {"passed": score < 10.0, "score": round(score, 1), "details": {
        "gps_points_total": total_points,
        "points_in_zone": points_in_zone,
        "zone_match_pct": round(match_pct * 100, 1),
        "issues": issues,
    }}


def _haversine(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
