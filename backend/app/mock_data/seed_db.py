"""
Seed script — run with:  python -m app.mock_data.seed_db

PAN India: 13 cities × 1000 riders = 13,000 riders total
Each city: 800 honest + 200 suspicious riders
All fields fully populated — no missing values.

Seeds:
  - 13 cities (3 tiers)
  - 80+ zones (urban / semi-urban / rural)
  - Dark stores per city
  - 13,000 riders + active policies
  - 7 days × 13,000 = 91,000 activity records
  - Rate cards: 13 × 3 tiers × 12 months = 468
  - Weekly ledgers: 13 cities × 8 weeks = 104 rows
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.core.database import engine, async_session, Base
from app.core.auth import hash_password
from app.models.models import (
    City, Zone, DarkStore, Rider, Policy, PremiumRateCard,
    RiderActivity, WeeklyLedger, ZoneTier, CityTier, AreaType,
)
from app.mock_data.seed_data import CITIES, CITY_ZONES, CITY_DARK_STORES
from app.services.pricing.pricing_engine import PricingEngine
from app.services.mock_platform import (
    generate_name, generate_device_fingerprint, generate_email,
    generate_upi_id, generate_rider_activity,
)

# ── 1000 riders per city (800 honest, 200 suspicious) ──
RIDERS_PER_CITY = {city["name"]: {"honest": 800, "suspicious": 200} for city in CITIES}

# Weekly premium by (city_tier, zone_tier)
WEEKLY_PREMIUMS = {
    ("tier_1", "high"): 75.0,  ("tier_1", "medium"): 60.0,  ("tier_1", "low"): 45.0,
    ("tier_2", "high"): 55.0,  ("tier_2", "medium"): 45.0,  ("tier_2", "low"): 35.0,
    ("tier_3", "high"): 40.0,  ("tier_3", "medium"): 30.0,  ("tier_3", "low"): 22.0,
}

TIER_EARN_MULT = {"tier_1": 1.0, "tier_2": 0.80, "tier_3": 0.60}
AREA_EARN_MULT = {"urban": 1.0, "semi_urban": 0.75, "rural": 0.55}

BATCH_SIZE = 100   # DB flush every N riders
ACTIVITY_BATCH = 1000  # DB flush every N activity records


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = await db.execute(select(City))
        if existing.scalars().first():
            print("Database already seeded. Skipping.")
            return

        # ── Cities ──
        city_map = {}       # name → id
        city_tier_map = {}  # name → tier str
        for c in CITIES:
            tier = CityTier(c.get("city_tier", "tier_1"))
            city = City(
                name=c["name"], state=c["state"],
                lat=c["lat"], lng=c["lng"],
                base_rate=c["base_rate"], city_tier=tier,
            )
            db.add(city)
            await db.flush()
            city_map[c["name"]] = city.id
            city_tier_map[c["name"]] = tier.value
        print(f"  Seeded {len(CITIES)} cities")

        # ── Zones ──
        zone_map = {}     # {city_name: {zone_name: zone_id}}
        zone_objects = {} # {zone_id: zone}
        zone_meta = {}    # {zone_id: {tier, area_type, city_tier, city_id, lat, lng}}
        total_zones = 0
        area_counts = {"urban": 0, "semi_urban": 0, "rural": 0}

        for city_name, zones_data in CITY_ZONES.items():
            zone_map[city_name] = {}
            for z in zones_data:
                area = z.get("area_type", "urban")
                zone = Zone(
                    city_id=city_map[city_name],
                    name=z["name"],
                    tier=ZoneTier(z["tier"]),
                    area_type=AreaType(area),
                    lat=z["lat"], lng=z["lng"],
                    flood_risk_score=z.get("flood_risk", 0.5),
                    heat_risk_score=z.get("heat_risk", 0.5),
                    aqi_risk_score=z.get("aqi_risk", 0.5),
                    traffic_risk_score=z.get("traffic_risk", 0.5),
                    cold_risk_score=0.3,
                    social_risk_score=0.3,
                )
                db.add(zone)
                await db.flush()
                zid = zone.id
                zone_map[city_name][z["name"]] = zid
                zone_objects[zid] = zone
                zone_meta[zid] = {
                    "tier": z["tier"],
                    "area_type": area,
                    "city_tier": city_tier_map[city_name],
                    "city_id": city_map[city_name],
                    "lat": z["lat"],
                    "lng": z["lng"],
                }
                total_zones += 1
                area_counts[area] = area_counts.get(area, 0) + 1

        print(f"  Seeded {total_zones} zones "
              f"({area_counts['urban']} urban / "
              f"{area_counts['semi_urban']} semi-urban / "
              f"{area_counts['rural']} rural)")

        # ── Dark Stores ──
        store_map = {}   # {city_name: {zone_name: store_id}}
        total_stores = 0
        for city_name, stores_data in CITY_DARK_STORES.items():
            store_map[city_name] = {}
            for s in stores_data:
                zone_id = zone_map.get(city_name, {}).get(s["zone"])
                if not zone_id:
                    continue
                platform = random.choice(["Zepto", "Blinkit", "Swiggy Instamart"])
                store = DarkStore(
                    zone_id=zone_id, name=s["name"],
                    platform=platform, lat=s["lat"], lng=s["lng"],
                    is_operational=True,
                )
                db.add(store)
                await db.flush()
                if s["zone"] not in store_map[city_name]:
                    store_map[city_name][s["zone"]] = store.id
                total_stores += 1
        print(f"  Seeded {total_stores} dark stores")

        # ── Rate Cards (13 cities × 3 tiers × 12 months) ──
        pricing = PricingEngine()
        rate_count = 0
        for city_name, city_id in city_map.items():
            ct = city_tier_map[city_name]
            for tier in ["high", "medium", "low"]:
                for month in range(1, 13):
                    result = pricing.calculate_premium(
                        city_name, tier, month,
                        city_tier=ct, area_type="urban",
                    )
                    card = PremiumRateCard(
                        city_id=city_id,
                        zone_tier=ZoneTier(tier), month=month,
                        base_rate=float(result.get("base_rate", 20)),
                        rainfall_rate=float(result["breakdown"].get("rainfall", 0)),
                        heat_rate=float(result["breakdown"].get("heat", 0)),
                        cold_fog_rate=float(result["breakdown"].get("cold_fog", 0)),
                        aqi_rate=float(result["breakdown"].get("aqi", 0)),
                        traffic_rate=float(result["breakdown"].get("traffic", 0)),
                        social_rate=float(result["breakdown"].get("social", 0)),
                        total_premium=float(result.get("total_weekly_premium", 45)),
                    )
                    db.add(card)
                    rate_count += 1
            await db.flush()
        print(f"  Seeded {rate_count} rate cards")

        # ── 8 Weeks of Historical Ledgers ──
        await _seed_weekly_history(db, city_map, city_tier_map, zone_meta)
        await db.flush()
        print(f"  Seeded {len(city_map) * 8} weekly ledger records")

        # ── Commit base data before riders ──
        await db.commit()
        print("  Base data committed. Starting rider seeding...")

    # ── Seed riders per city in separate transactions to avoid timeout ──
    rider_index_start = 0
    total_riders = 0
    now = datetime.now(timezone.utc)
    week_start = now - timedelta(days=now.weekday())
    week_end = week_start + timedelta(days=7)

    for city_name in RIDERS_PER_CITY:
        counts = RIDERS_PER_CITY[city_name]
        n_honest = counts["honest"]
        n_suspicious = counts["suspicious"]
        n_total = n_honest + n_suspicious

        async with async_session() as db:
            # Re-fetch IDs for this session
            city_result = await db.execute(select(City).where(City.name == city_name))
            city_obj = city_result.scalar_one()
            city_id = city_obj.id
            ct = city_obj.city_tier.value

            zones_result = await db.execute(select(Zone).where(Zone.city_id == city_id))
            city_zone_objs = zones_result.scalars().all()
            city_zone_list = [(z.id, z.tier.value, z.area_type.value, z.lat, z.lng) for z in city_zone_objs]

            # Get store map for this city
            stores_result = await db.execute(
                select(DarkStore).join(Zone).where(Zone.city_id == city_id)
            )
            city_stores = stores_result.scalars().all()
            zone_store_map = {}
            for s in city_stores:
                if s.zone_id not in zone_store_map:
                    zone_store_map[s.zone_id] = s.id

            rider_batch = []
            activity_batch = []
            city_rider_count = 0

            for i in range(n_total):
                is_suspicious = i >= n_honest
                # Round-robin across zones
                z_id, zone_tier, area_type, zone_lat, zone_lng = city_zone_list[i % len(city_zone_list)]

                t_mult = TIER_EARN_MULT.get(ct, 1.0)
                a_mult = AREA_EARN_MULT.get(area_type, 1.0)

                rider_idx = rider_index_start + i
                name = generate_name(rider_idx)
                phone = str(9000000000 + rider_idx)
                email = generate_email(rider_idx + 1, name, is_suspicious)
                upi = generate_upi_id(rider_idx + 1, name, is_suspicious)
                fp = generate_device_fingerprint(rider_idx + 1, is_suspicious)
                dark_store_id = zone_store_map.get(z_id)

                active_days = random.randint(15, 28) if not is_suspicious else random.randint(1, 10)
                # RULE: Workers with < 5 active days in 30 go to lower tier
                activity_tier = "low" if active_days < 5 else "medium" if active_days < 20 else "high"

                rider = Rider(
                    name=name,
                    phone=phone,
                    email=email,
                    password_hash=hash_password("demo1234"),
                    upi_id=upi,
                    zone_id=z_id,
                    dark_store_id=dark_store_id,
                    shift_type=random.choice(["morning", "evening", "night", "flexible"]),
                    avg_weekly_earnings=float(round(random.uniform(4000, 7000) * t_mult * a_mult)),
                    avg_hourly_rate=float(round(random.uniform(80, 120) * t_mult * a_mult, 2)),
                    active_days_last_30=active_days,
                    activity_tier=activity_tier,
                    shield_level=random.randint(1, 5),
                    shield_xp=float(random.randint(0, 500)),
                    fraud_score=0.0,
                    device_fingerprint=fp,
                    is_suspicious=is_suspicious,
                    aadhaar_verified=not is_suspicious,
                    is_active=True,
                )
                db.add(rider)
                rider_batch.append((rider, z_id, zone_tier, ct, area_type, zone_lat, zone_lng, is_suspicious))
                city_rider_count += 1

                # Flush riders in batches
                if len(rider_batch) >= BATCH_SIZE:
                    await db.flush()
                    # Create policies + collect activity data
                    for r, zid, zt, city_t, at, zlat, zlng, susp in rider_batch:
                        pk = (city_t, zt)
                        premium = WEEKLY_PREMIUMS.get(pk, 45.0)
                        pol = Policy(
                            rider_id=r.id, zone_id=zid,
                            week_start=week_start, week_end=week_end,
                            premium_amount=premium,
                            premium_breakdown={
                                "rainfall": 18.0, "heat": 8.0, "aqi": 7.0,
                                "traffic": 5.0, "cold_fog": 4.0, "social": 3.0,
                            },
                            coverage_triggers={
                                "rainfall": 280, "heat": 180, "aqi": 160,
                                "traffic": 100, "cold_fog": 120, "social": 400,
                            },
                            status="active", auto_renew=True,
                        )
                        db.add(pol)
                        # Queue 7 days of activity
                        for day_offset in range(7):
                            date = now - timedelta(days=day_offset)
                            act = generate_rider_activity(
                                rider_id=r.id, date=date,
                                zone_lat=zlat, zone_lng=zlng,
                                is_suspicious=susp,
                            )
                            act.setdefault("hours_active", 0.0)
                            act.setdefault("deliveries_completed", 0)
                            act.setdefault("gps_points", [])
                            act.setdefault("login_time", date.replace(hour=9, minute=0, second=0, microsecond=0))
                            act.setdefault("logout_time", date.replace(hour=14, minute=0, second=0, microsecond=0))
                            act.setdefault("earnings", 0.0)
                            act.setdefault("is_working", False)
                            activity_batch.append(RiderActivity(**act))

                    rider_batch.clear()
                    await db.flush()

                # Flush activity in separate batches
                if len(activity_batch) >= ACTIVITY_BATCH:
                    db.add_all(activity_batch)
                    await db.flush()
                    activity_batch.clear()

            # Flush remainder
            if rider_batch:
                await db.flush()
                for r, zid, zt, city_t, at, zlat, zlng, susp in rider_batch:
                    pk = (city_t, zt)
                    premium = WEEKLY_PREMIUMS.get(pk, 45.0)
                    pol = Policy(
                        rider_id=r.id, zone_id=zid,
                        week_start=week_start, week_end=week_end,
                        premium_amount=premium,
                        premium_breakdown={
                            "rainfall": 18.0, "heat": 8.0, "aqi": 7.0,
                            "traffic": 5.0, "cold_fog": 4.0, "social": 3.0,
                        },
                        coverage_triggers={
                            "rainfall": 280, "heat": 180, "aqi": 160,
                            "traffic": 100, "cold_fog": 120, "social": 400,
                        },
                        status="active", auto_renew=True,
                    )
                    db.add(pol)
                    for day_offset in range(7):
                        date = now - timedelta(days=day_offset)
                        act = generate_rider_activity(
                            rider_id=r.id, date=date,
                            zone_lat=zlat, zone_lng=zlng,
                            is_suspicious=susp,
                        )
                        act.setdefault("hours_active", 0.0)
                        act.setdefault("deliveries_completed", 0)
                        act.setdefault("gps_points", [])
                        act.setdefault("login_time", date.replace(hour=9, minute=0, second=0, microsecond=0))
                        act.setdefault("logout_time", date.replace(hour=14, minute=0, second=0, microsecond=0))
                        act.setdefault("earnings", 0.0)
                        act.setdefault("is_working", False)
                        activity_batch.append(RiderActivity(**act))
                rider_batch.clear()
                await db.flush()

            if activity_batch:
                db.add_all(activity_batch)
                await db.flush()
                activity_batch.clear()

            await db.commit()
            total_riders += city_rider_count
            rider_index_start += n_total
            print(f"  {city_name}: {city_rider_count} riders seeded "
                  f"({n_honest} honest / {n_suspicious} suspicious)")

    print(f"\n{'='*60}")
    print(f"  Seed complete — PAN India")
    print(f"  Cities : {len(CITIES)} across 3 tiers")
    print(f"  Zones  : {total_zones} "
          f"({area_counts['urban']} urban / "
          f"{area_counts['semi_urban']} semi-urban / "
          f"{area_counts['rural']} rural)")
    print(f"  Stores : {total_stores}")
    print(f"  Riders : {total_riders} (1000 per city)")
    print(f"  Activities: {total_riders * 7:,} records")
    print(f"  Login  : phone 9000000000–{9000000000 + total_riders - 1}")
    print(f"  Password: demo1234")
    print(f"{'='*60}")


async def _seed_weekly_history(db, city_map, city_tier_map, zone_meta):
    """8 weeks of historical premium / claims / payout data per city."""
    now = datetime.now(timezone.utc)

    for city_name, city_id in city_map.items():
        ct = city_tier_map[city_name]
        city_riders = 1000   # fixed: 1000 per city

        city_zones_meta = [m for m in zone_meta.values() if m["city_id"] == city_id]
        total_z = len(city_zones_meta) or 1
        urban_z = sum(1 for m in city_zones_meta if m["area_type"] == "urban")
        semi_z = sum(1 for m in city_zones_meta if m["area_type"] == "semi_urban")
        rural_z = total_z - urban_z - semi_z
        urban_pct = urban_z / total_z
        semi_pct = semi_z / total_z

        avg_premium = {"tier_1": 62, "tier_2": 45, "tier_3": 30}.get(ct, 45)
        avg_payout = {"tier_1": 350, "tier_2": 240, "tier_3": 140}.get(ct, 240)

        for week_offset in range(1, 9):
            week_end_dt = now - timedelta(weeks=week_offset - 1, days=now.weekday())
            week_start_dt = week_end_dt - timedelta(days=7)
            month = week_start_dt.month

            # Seasonal factor
            seasonal = 1.0
            if ct == "tier_1" and month in [6, 7, 8, 9]:
                seasonal = 2.2
            elif city_name in ["Delhi", "Lucknow", "Patna"] and month in [10, 11, 12, 1]:
                seasonal = 1.9
            elif city_name in ["Delhi", "Jaipur", "Ahmedabad", "Lucknow"] and month in [4, 5]:
                seasonal = 1.6
            elif city_name in ["Chennai", "Kolkata", "Patna"] and month in [10, 11]:
                seasonal = 2.0

            premium_collected = round(
                city_riders * avg_premium * random.uniform(0.88, 1.00), 2
            )
            base_claims = max(2, int(city_riders * 0.12 * seasonal * random.uniform(0.6, 1.4)))
            claims_approved = max(1, int(base_claims * random.uniform(0.60, 0.85)))
            claims_denied = max(0, base_claims - claims_approved)

            urban_n = max(0, round(claims_approved * urban_pct))
            semi_n = max(0, round(claims_approved * semi_pct))
            rural_n = max(0, claims_approved - urban_n - semi_n)

            urban_pay = round(urban_n * avg_payout * random.uniform(0.85, 1.15), 2)
            semi_pay = round(semi_n * avg_payout * 0.75 * random.uniform(0.85, 1.15), 2)
            rural_pay = round(rural_n * avg_payout * 0.55 * random.uniform(0.85, 1.15), 2)
            total_payout = round(urban_pay + semi_pay + rural_pay, 2)

            lr = round(total_payout / premium_collected, 4) if premium_collected > 0 else 0.0
            avg_claim = round(total_payout / claims_approved, 2) if claims_approved > 0 else 0.0

            db.add(WeeklyLedger(
                city_id=city_id,
                week_start=week_start_dt, week_end=week_end_dt,
                total_policies=city_riders,
                premium_collected=premium_collected,
                total_claims=base_claims,
                claims_approved=claims_approved,
                claims_denied=claims_denied,
                total_payout=total_payout,
                loss_ratio=lr, bcr=lr,
                avg_claim_amount=avg_claim,
                urban_claims=urban_n, semi_urban_claims=semi_n, rural_claims=rural_n,
                urban_payout=urban_pay, semi_urban_payout=semi_pay, rural_payout=rural_pay,
            ))


if __name__ == "__main__":
    asyncio.run(seed())
