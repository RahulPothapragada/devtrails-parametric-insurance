"""Admin dashboard routes — platform stats, live feed, cities, claim review, actuarial."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.models import Rider, Policy, Claim, TriggerReading, Zone, City, WeeklyLedger, ClaimStatus
from app.schemas.schemas import AdminStats, ClaimOut
import random

router = APIRouter()


def _parse_claim_status(status: str | None) -> ClaimStatus | None:
    if not status or status == "all":
        return None

    try:
        return ClaimStatus(status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid claim status '{status}'") from exc


def _claim_status_filter(status: str | None):
    parsed_status = _parse_claim_status(status)
    if parsed_status is None:
        return None

    if parsed_status == ClaimStatus.APPROVED:
        # "Approved" is a business bucket in the UI: approved claims plus those
        # that have already completed payout.
        return Claim.status.in_([ClaimStatus.APPROVED, ClaimStatus.PAID])

    if parsed_status == ClaimStatus.AUTO_APPROVED:
        # Auto-approved claims are often immediately disbursed and transition to
        # PAID, so keep them visible in this bucket using the fraud threshold
        # that the claim engine uses for automatic approval.
        return or_(
            Claim.status == ClaimStatus.AUTO_APPROVED,
            (Claim.status == ClaimStatus.PAID) & (func.coalesce(Claim.fraud_score, 0) <= 40),
        )

    return Claim.status == parsed_status


@router.get("/stats", response_model=AdminStats)
async def admin_stats(db: AsyncSession = Depends(get_db)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)

    total_riders = (await db.execute(select(func.count(Rider.id)))).scalar() or 0
    active_policies = (await db.execute(
        select(func.count(Policy.id)).where(Policy.status == "active")
    )).scalar() or 0
    claims_today = (await db.execute(
        select(func.count(Claim.id)).where(Claim.event_time >= today)
    )).scalar() or 0
    payouts_today = (await db.execute(
        select(func.coalesce(func.sum(Claim.payout_amount), 0))
        .where(Claim.event_time >= today, Claim.status.in_(["auto_approved", "approved", "paid"]))
    )).scalar() or 0

    active_result = await db.execute(
        select(TriggerReading)
        .where(TriggerReading.is_breached == True)
        .order_by(desc(TriggerReading.timestamp))
        .limit(10)
    )
    active_triggers = [
        {"type": r.trigger_type.value, "value": r.value, "city_id": r.city_id}
        for r in active_result.scalars().all()
    ]

    zones_result = await db.execute(
        select(Zone).order_by(Zone.flood_risk_score.desc()).limit(10)
    )
    zone_risk = [
        {"zone": z.name, "tier": z.tier.value, "flood": z.flood_risk_score, "heat": z.heat_risk_score}
        for z in zones_result.scalars().all()
    ]

    return AdminStats(
        total_riders=total_riders,
        active_policies=active_policies,
        total_claims_today=claims_today,
        total_payouts_today=payouts_today,
        active_triggers=active_triggers,
        zone_risk_summary=zone_risk,
    )


@router.get("/claims")
async def all_claims(
    status: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """All claims for admin — optionally filter by status."""
    status_filter = _claim_status_filter(status)
    q = select(Claim).order_by(desc(Claim.event_time))
    if status_filter is not None:
        q = q.where(status_filter)
    q = q.limit(limit).offset(offset)
    claims = (await db.execute(q)).scalars().all()

    result = []
    for claim in claims:
        rider = (await db.execute(select(Rider).where(Rider.id == claim.rider_id))).scalar_one_or_none()
        zone = (await db.execute(select(Zone).where(Zone.id == rider.zone_id))).scalar_one_or_none() if rider else None
        result.append({
            "id": claim.id,
            "rider_id": claim.rider_id,
            "rider_name": rider.name if rider else "Unknown",
            "rider_phone": rider.phone if rider else None,
            "city": zone.name.split("-")[0].strip() if zone else "Unknown",
            "zone": zone.name if zone else "Unknown",
            "trigger": claim.trigger_type.value if claim.trigger_type else "—",
            "status": claim.status.value,
            "payout_amount": claim.payout_amount,
            "fraud_score": claim.fraud_score,
            "event_time": claim.event_time.isoformat(),
        })
    return result


@router.get("/live-feed")
async def live_rider_feed(limit: int = 20, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Claim).order_by(desc(Claim.event_time)).limit(limit)
    )
    claims = result.scalars().all()

    feed = []
    for claim in claims:
        rider_result = await db.execute(select(Rider).where(Rider.id == claim.rider_id))
        rider = rider_result.scalar_one_or_none()
        zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id)) if rider else None
        zone = zone_result.scalar_one_or_none() if zone_result else None
        feed.append({
            "rider_id": claim.rider_id,
            "rider_name": rider.name if rider else "Unknown",
            "location": zone.name if zone else "Unknown",
            "trigger": claim.trigger_type.value,
            "status": claim.status.value,
            "payout": claim.payout_amount,
            "time": claim.event_time.isoformat(),
        })
    return feed


@router.put("/claims/{claim_id}/review", response_model=ClaimOut)
async def review_claim(
    claim_id: int,
    verdict: str = Query(..., description="'approved' or 'denied'"),
    db: AsyncSession = Depends(get_db),
):
    """Manual claim review — admin approves or denies a pending/flagged claim."""
    if verdict not in ["approved", "denied"]:
        raise HTTPException(status_code=400, detail="Invalid verdict. Use 'approved' or 'denied'")

    result = await db.execute(select(Claim).where(Claim.id == claim_id))
    claim = result.scalar_one_or_none()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if claim.status.value not in ["pending_review", "flagged"]:
        raise HTTPException(status_code=400, detail="Claim already processed — cannot re-review")

    new_status = ClaimStatus.APPROVED if verdict == "approved" else ClaimStatus.DENIED
    claim.status = new_status
    if new_status == ClaimStatus.APPROVED:
        policy_result = await db.execute(select(Policy).where(Policy.id == claim.policy_id))
        policy = policy_result.scalar_one_or_none()
        trigger = claim.trigger_type.value if claim.trigger_type else "rainfall"
        
        if policy and policy.coverage_triggers and trigger in policy.coverage_triggers:
            claim.payout_amount = policy.coverage_triggers[trigger]
        else:
            claim.payout_amount = 240.0 # Standard fallback payout
    else:
        claim.payout_amount = 0.0

    await db.flush()
    return claim


@router.get("/cities")
async def list_cities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(City).order_by(City.name))
    cities = result.scalars().all()
    return [
        {"id": c.id, "name": c.name, "state": c.state, "lat": c.lat, "lng": c.lng,
         "city_tier": c.city_tier.value if c.city_tier else "tier_1"}
        for c in cities
    ]


# ── Actuarial / Weekly Ledger Endpoints ──

# Monsoon stress multipliers — city-specific (from IMD historical worst-case data)
MONSOON_MULTIPLIERS = {
    "Mumbai": 2.2, "Delhi": 1.6, "Bangalore": 1.8, "Chennai": 2.0,
    "Kolkata": 2.4, "Pune": 1.8, "Hyderabad": 1.5, "Ahmedabad": 1.4,
    "Jaipur": 1.3, "Lucknow": 2.0, "Indore": 1.5, "Patna": 2.8, "Bhopal": 1.6,
}


def _sustainability_status(lr: float) -> str:
    if lr <= 0.55:   return "healthy"
    if lr <= 0.70:   return "optimal"
    if lr <= 0.85:   return "watch"
    return "critical"


@router.get("/actuarial/stress-test")
async def actuarial_stress_test(db: AsyncSession = Depends(get_db)):
    """Monsoon stress scenario — projects LR/BCR if a 14-day extreme monsoon hits today.
    No DB writes. Pure computation on current 8-week ledger data.
    Scenario: IMD historical worst-case (300mm/6hrs, Mumbai Jul 2024).
    """
    cities_result = await db.execute(select(City).order_by(City.name))
    cities = cities_result.scalars().all()

    projections = []
    cities_to_suspend: list[str] = []

    for city in cities:
        ledger_result = await db.execute(
            select(WeeklyLedger).where(WeeklyLedger.city_id == city.id)
        )
        ledgers = ledger_result.scalars().all()
        if not ledgers:
            continue

        total_premium = sum(l.premium_collected for l in ledgers)
        total_payout  = sum(l.total_payout     for l in ledgers)
        current_lr    = round(total_payout / total_premium, 4) if total_premium > 0 else 0.0

        mult       = MONSOON_MULTIPLIERS.get(city.name, 1.8)
        stress_lr  = round(min(current_lr * mult, 2.5), 4)

        current_status = _sustainability_status(current_lr)
        stress_status  = _sustainability_status(stress_lr)

        proj = {
            "city":              city.name,
            "city_tier":         city.city_tier.value if city.city_tier else "tier_1",
            "current_lr":        current_lr,
            "current_status":    current_status,
            "monsoon_multiplier": mult,
            "stress_lr":         stress_lr,
            "stress_status":     stress_status,
            "would_flip_to_suspended": stress_lr > 0.85 and current_lr <= 0.85,
            "already_suspended": current_lr > 0.85,
            "lr_increase_pct":   round((stress_lr - current_lr) / current_lr * 100, 1) if current_lr > 0 else 0,
        }
        projections.append(proj)
        if stress_lr > 0.85:
            cities_to_suspend.append(city.name)

    suspend_count    = len(cities_to_suspend)
    new_suspensions  = [p["city"] for p in projections if p["would_flip_to_suspended"]]
    avg_lr_increase  = (
        round(sum(p["lr_increase_pct"] for p in projections) / len(projections), 1)
        if projections else 0
    )

    return {
        "scenario":    "14-Day Extreme Monsoon (IMD worst-case: 300mm/6hrs, Mumbai Jul 2024)",
        "methodology": "Current 8-week LR × city-specific IMD monsoon intensity multiplier",
        "bcr_target":  "0.55–0.70",
        "suspend_threshold": 0.85,
        "cities":      projections,
        "summary": {
            "total_cities_assessed": len(projections),
            "cities_that_would_be_suspended": cities_to_suspend,
            "new_suspensions": new_suspensions,
            "already_suspended": [p["city"] for p in projections if p["already_suspended"]],
            "suspend_count":     suspend_count,
            "avg_lr_increase_pct": avg_lr_increase,
        },
    }


@router.get("/actuarial/{city_name}")
async def actuarial_summary(city_name: str, db: AsyncSession = Depends(get_db)):
    """Get actuarial summary for a city — BCR, Loss Ratio, weekly trend, sustainability status."""
    city_result = await db.execute(select(City).where(City.name == city_name))
    city = city_result.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail=f"City '{city_name}' not found")

    ledger_result = await db.execute(
        select(WeeklyLedger)
        .where(WeeklyLedger.city_id == city.id)
        .order_by(WeeklyLedger.week_start.desc())
        .limit(8)
    )
    ledgers = ledger_result.scalars().all()

    if not ledgers:
        raise HTTPException(status_code=404, detail="No historical data found for this city")

    total_premium = sum(l.premium_collected for l in ledgers)
    total_payout = sum(l.total_payout for l in ledgers)
    avg_lr = round(total_payout / total_premium, 4) if total_premium > 0 else 0
    avg_bcr = avg_lr  # BCR ≈ Loss Ratio for parametric

    # Sustainability check (from slides: >85% = suspend)
    if avg_lr <= 0.55:
        status = "healthy"
    elif avg_lr <= 0.70:
        status = "optimal"       # target BCR range 0.55-0.70
    elif avg_lr <= 0.85:
        status = "watch"
    else:
        status = "critical"      # suspend new enrolments

    urban_total = sum(l.urban_payout for l in ledgers)
    semi_total = sum(l.semi_urban_payout for l in ledgers)
    rural_total = sum(l.rural_payout for l in ledgers)

    weekly_trend = [
        {
            "week_start": l.week_start.isoformat(),
            "premium_collected": l.premium_collected,
            "total_payout": l.total_payout,
            "loss_ratio": l.loss_ratio,
            "claims": l.total_claims,
            "approved": l.claims_approved,
            "denied": l.claims_denied,
        }
        for l in ledgers
    ]

    return {
        "city": city_name,
        "city_tier": city.city_tier.value if city.city_tier else "tier_1",
        "total_weeks": len(ledgers),
        "total_premium_collected": round(total_premium, 2),
        "total_payout": round(total_payout, 2),
        "avg_loss_ratio": avg_lr,
        "avg_bcr": avg_bcr,
        "sustainability_status": status,
        "note": "BCR target: 0.55–0.70. Loss Ratio > 0.85 triggers enrolment suspension.",
        "urban_vs_rural": {
            "urban_payout": round(urban_total, 2),
            "semi_urban_payout": round(semi_total, 2),
            "rural_payout": round(rural_total, 2),
            "urban_pct": round(urban_total / total_payout * 100, 1) if total_payout > 0 else 0,
            "semi_urban_pct": round(semi_total / total_payout * 100, 1) if total_payout > 0 else 0,
            "rural_pct": round(rural_total / total_payout * 100, 1) if total_payout > 0 else 0,
        },
        "weekly_trend": weekly_trend,
    }


@router.get("/actuarial")
async def all_cities_actuarial(db: AsyncSession = Depends(get_db)):
    """Compare actuarial health across all cities — BCR, Loss Ratio, tier breakdown."""
    cities_result = await db.execute(select(City).order_by(City.name))
    cities = cities_result.scalars().all()

    summaries = []
    for city in cities:
        ledger_result = await db.execute(
            select(WeeklyLedger)
            .where(WeeklyLedger.city_id == city.id)
            .order_by(WeeklyLedger.week_start.desc())
            .limit(8)
        )
        ledgers = ledger_result.scalars().all()
        if not ledgers:
            continue

        total_premium = sum(l.premium_collected for l in ledgers)
        total_payout = sum(l.total_payout for l in ledgers)
        avg_lr = round(total_payout / total_premium, 4) if total_premium > 0 else 0

        if avg_lr <= 0.55:
            status = "healthy"
        elif avg_lr <= 0.70:
            status = "optimal"
        elif avg_lr <= 0.85:
            status = "watch"
        else:
            status = "critical"

        summaries.append({
            "city": city.name,
            "city_tier": city.city_tier.value if city.city_tier else "tier_1",
            "weeks": len(ledgers),
            "premium_collected": round(total_premium, 2),
            "total_payout": round(total_payout, 2),
            "avg_loss_ratio": avg_lr,
            "avg_bcr": avg_lr,
            "sustainability": status,
            "total_policies": sum(l.total_policies for l in ledgers) // len(ledgers),
            "total_claims": sum(l.total_claims for l in ledgers),
        })

    return {
        "total_cities": len(summaries),
        "tier_breakdown": {
            "tier_1": [s for s in summaries if s["city_tier"] == "tier_1"],
            "tier_2": [s for s in summaries if s["city_tier"] == "tier_2"],
            "tier_3": [s for s in summaries if s["city_tier"] == "tier_3"],
        },
        "all_cities": summaries,
    }


@router.get("/weekly-ledger/{city_name}")
async def weekly_ledger(city_name: str, weeks: int = 8, db: AsyncSession = Depends(get_db)):
    """Get raw weekly ledger entries for a city."""
    city_result = await db.execute(select(City).where(City.name == city_name))
    city = city_result.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail=f"City '{city_name}' not found")

    ledger_result = await db.execute(
        select(WeeklyLedger)
        .where(WeeklyLedger.city_id == city.id)
        .order_by(WeeklyLedger.week_start.desc())
        .limit(weeks)
    )
    ledgers = ledger_result.scalars().all()

    return {
        "city": city_name,
        "city_tier": city.city_tier.value if city.city_tier else "tier_1",
        "weeks": [
            {
                "week_start": l.week_start.isoformat(),
                "week_end": l.week_end.isoformat(),
                "total_policies": l.total_policies,
                "premium_collected": l.premium_collected,
                "total_claims": l.total_claims,
                "claims_approved": l.claims_approved,
                "claims_denied": l.claims_denied,
                "total_payout": l.total_payout,
                "loss_ratio": l.loss_ratio,
                "bcr": l.bcr,
                "avg_claim_amount": l.avg_claim_amount,
                "area_breakdown": {
                    "urban": {"claims": l.urban_claims, "payout": l.urban_payout},
                    "semi_urban": {"claims": l.semi_urban_claims, "payout": l.semi_urban_payout},
                    "rural": {"claims": l.rural_claims, "payout": l.rural_payout},
                },
            }
            for l in ledgers
        ],
    }

@router.get("/fraud-summary")
async def fraud_network_summary(db: AsyncSession = Depends(get_db)):
    """Platform-wide fraud summary — real rider anomaly stats for the 9-Wall dashboard."""
    total_riders = (await db.execute(select(func.count(Rider.id)))).scalar() or 0
    suspicious_riders = (await db.execute(
        select(func.count(Rider.id)).where(Rider.is_suspicious == True)
    )).scalar() or 0
    high_fraud = (await db.execute(
        select(func.count(Rider.id)).where(Rider.fraud_score > 70)
    )).scalar() or 0
    anomalous = suspicious_riders + high_fraud
    anomaly_rate = round(anomalous / total_riders * 100, 1) if total_riders > 0 else 0

    # Count syndicates: shared device fingerprints among suspicious riders
    from sqlalchemy import text as sa_text
    syndicate_result = await db.execute(sa_text("""
        SELECT COUNT(*) FROM (
            SELECT device_fingerprint FROM riders
            WHERE is_suspicious = 1 AND device_fingerprint IS NOT NULL
            GROUP BY device_fingerprint HAVING COUNT(*) > 1
        )
    """))
    syndicate_count = syndicate_result.scalar() or 0

    # Blocked premium = sum of premiums paid by suspicious riders
    blocked_result = await db.execute(sa_text("""
        SELECT COALESCE(SUM(p.premium_amount), 0)
        FROM policies p
        JOIN riders r ON p.rider_id = r.id
        WHERE r.is_suspicious = 1
    """))
    blocked_premium = float(blocked_result.scalar() or 0)

    # Top syndicate zones (zones with most suspicious riders)
    top_zones_result = await db.execute(sa_text("""
        SELECT z.name, COUNT(r.id) as cnt
        FROM riders r JOIN zones z ON r.zone_id = z.id
        WHERE r.is_suspicious = 1
        GROUP BY z.id, z.name ORDER BY cnt DESC LIMIT 3
    """))
    top_zones = [{"zone": row[0], "count": row[1]} for row in top_zones_result.fetchall()]

    return {
        "total_riders": total_riders,
        "anomalous_riders": anomalous,
        "anomaly_rate_pct": anomaly_rate,
        "syndicate_count": syndicate_count,
        "blocked_premium": round(blocked_premium, 2),
        "top_syndicate_zones": top_zones,
    }


@router.get("/maps/network")
async def get_map_network(city_name: str, limit: int = 60, db: AsyncSession = Depends(get_db)):
    """Fetch live riders from the database organically scattered around their Zone centers."""
    city_result = await db.execute(select(City).where(City.name == city_name))
    city = city_result.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail="City not found")
        
    # Get active riders deeply bounded into this city, randomized to simulate a live sweep
    rider_result = await db.execute(
        select(Rider, Zone)
        .join(Zone, Rider.zone_id == Zone.id)
        .where(Zone.city_id == city.id)
        .order_by(func.random())
        .limit(limit)
    )
    
    from collections import defaultdict
    riders_data = rider_result.all()
    riders = [r for r, z in riders_data]
    zones = {r.id: z for r, z in riders_data}
    
    # ── Algo Wall 5 (Graph Detection): Identify authentic rings ──
    device_groups = defaultdict(list)
    upi_groups = defaultdict(list)
    
    for r in riders:
        # We search specifically for malicious signatures planted by the simulation
        if r.device_fingerprint and r.is_suspicious:
            device_groups[r.device_fingerprint].append(r.id)
        if r.upi_id and "fraud" in r.upi_id:
            upi_groups[r.upi_id].append(r.id)
            
    links = []
    attack_riders = {}
    
    # Map Shared Device Signatures
    for fp, rids in device_groups.items():
        if len(rids) > 1:
            for i in range(len(rids)):
                attack_riders[rids[i]] = "CRITICAL: Shared Device Array (Emulation)"
                for j in range(i + 1, len(rids)):
                    links.append({"from": f"R-{rids[i]}", "to": f"R-{rids[j]}"})
                    
    # Map Shared Bank Pools
    for upi, rids in upi_groups.items():
        if len(rids) > 1:
            for i in range(len(rids)):
                # If they already tripped the device check, elevate to Syndicate
                if rids[i] in attack_riders:
                    attack_riders[rids[i]] = "CRITICAL: Multi-Proxy Syndicate (Devices + Bank Pool)"
                else:
                    attack_riders[rids[i]] = "CRITICAL: Unified Payout Funnel (Shared UPI)"
                for j in range(i + 1, len(rids)):
                    links.append({"from": f"R-{rids[i]}", "to": f"R-{rids[j]}"})

    nodes = []
    for r in riders:
        zone = zones[r.id]
        # Keep the scatter balanced (~1.5km spread) so they cluster around the hub but don't overlap as a solid dot
        lat_offset = random.uniform(-0.012, 0.012)
        lng_offset = random.uniform(-0.012, 0.012)

        status = 'normal'
        risk = 'low'
        verdict = 'Nominal Signal Pattern'
        
        if r.id in attack_riders:
            status = 'attack'
            risk = 'extreme'
            verdict = attack_riders[r.id]
        elif r.is_suspicious or r.fraud_score > 70:
            status = 'spoofing'
            risk = 'high'
            verdict = "High Risk Location Mismatch"
            
        nodes.append({
            "id": f"R-{r.id}",
            "name": r.name,
            "lat": zone.lat + lat_offset,
            "lng": zone.lng + lng_offset,
            "type": "rider",
            "risk": risk,
            "status": status,
            "verdict": verdict,
            "location": zone.name,
            # Rider profile fields for the detail modal
            "earnings_monthly": round(r.avg_weekly_earnings * 4.33),
            "policy_status": "Active" if not r.is_suspicious else "Flagged",
            "fraud_score": round(r.fraud_score, 1),
            "shield_level": r.shield_level,
            "aadhaar_verified": r.aadhaar_verified,
        })
        
    return {"city_center": [city.lat, city.lng], "nodes": nodes, "links": links}
