"""
Seed script — run with:  python -m app.mock_data.seed_db
Populates cities, zones, dark stores, 50 riders (40 honest + 10 suspicious),
active policies, rate cards, and 7 days of activity history.
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from sqlalchemy import select

from app.core.database import engine, async_session, Base
from app.core.auth import hash_password
from app.models.models import (
    City, Zone, DarkStore, Rider, Policy, PremiumRateCard,
    RiderActivity, ZoneTier,
)
from app.mock_data.seed_data import CITIES, MUMBAI_ZONES, MUMBAI_DARK_STORES
from app.services.pricing.pricing_engine import PricingEngine
from app.services.mock_platform import (
    INDIAN_NAMES, generate_device_fingerprint, generate_email,
    generate_upi_id, generate_rider_activity,
)

WEEKLY_PREMIUMS = {"high": 75.0, "medium": 60.0, "low": 45.0}


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = await db.execute(select(City))
        if existing.scalars().first():
            print("Database already seeded. Skipping.")
            return

        # ── Cities ──
        city_map = {}
        for c in CITIES:
            city = City(name=c["name"], state=c["state"], lat=c["lat"], lng=c["lng"], base_rate=c["base_rate"])
            db.add(city)
            await db.flush()
            city_map[c["name"]] = city.id
        print(f"  Seeded {len(CITIES)} cities")

        # ── Zones (Mumbai) ──
        zone_map = {}
        zone_objects = []
        for z in MUMBAI_ZONES:
            zone = Zone(
                city_id=city_map["Mumbai"],
                name=z["name"],
                tier=ZoneTier(z["tier"]),
                lat=z["lat"],
                lng=z["lng"],
                flood_risk_score=z["flood_risk"],
                heat_risk_score=z["heat_risk"],
                aqi_risk_score=z.get("aqi_risk", 0.5),
                traffic_risk_score=z.get("traffic_risk", 0.5),
                cold_risk_score=0.3,
                social_risk_score=0.3,
            )
            db.add(zone)
            await db.flush()
            zone_map[z["name"]] = zone.id
            zone_objects.append(zone)
        print(f"  Seeded {len(MUMBAI_ZONES)} Mumbai zones")

        # ── Dark Stores ──
        store_map = {}
        for s in MUMBAI_DARK_STORES:
            store = DarkStore(
                zone_id=zone_map[s["zone"]],
                name=s["name"],
                platform="Zepto",
                lat=s["lat"],
                lng=s["lng"],
            )
            db.add(store)
            await db.flush()
            store_map[s["name"]] = store.id
        print(f"  Seeded {len(MUMBAI_DARK_STORES)} dark stores")

        # ── 50 Riders (40 honest + 10 suspicious) ──
        num_honest = 40
        num_suspicious = 10
        riders = []
        zone_list = list(zone_map.keys())

        for i in range(num_honest + num_suspicious):
            name = INDIAN_NAMES[i] if i < len(INDIAN_NAMES) else f"Rider_{i}"
            is_suspicious = i >= num_honest
            zone_name = random.choice(zone_list)
            z_id = zone_map[zone_name]

            rider = Rider(
                name=name,
                phone=f"{9000000000 + i}",
                email=generate_email(i + 1, name, is_suspicious),
                password_hash=hash_password("demo1234"),
                upi_id=generate_upi_id(i + 1, name, is_suspicious),
                zone_id=z_id,
                shift_type=random.choice(["morning", "evening", "night", "flexible"]),
                avg_weekly_earnings=random.uniform(4000, 7000),
                avg_hourly_rate=random.uniform(80, 120),
                shield_level=random.randint(1, 5),
                device_fingerprint=generate_device_fingerprint(i + 1, is_suspicious),
                is_suspicious=is_suspicious,
            )
            db.add(rider)
            await db.flush()
            riders.append(rider)

            # Active policy
            now = datetime.now(timezone.utc)
            week_start = now - timedelta(days=now.weekday())
            tier_str = "high" if "high" in str(zone_name).lower() else "medium"
            # Get actual zone tier
            for z in MUMBAI_ZONES:
                if z["name"] == zone_name:
                    tier_str = z["tier"]
                    break

            policy = Policy(
                rider_id=rider.id,
                zone_id=z_id,
                week_start=week_start,
                week_end=week_start + timedelta(days=7),
                premium_amount=WEEKLY_PREMIUMS.get(tier_str, 60.0),
                premium_breakdown={"rainfall": 18, "heat": 8, "aqi": 7, "traffic": 5, "cold_fog": 4, "social": 3},
                coverage_triggers={"rainfall": 280, "heat": 180, "aqi": 160, "traffic": 100, "cold_fog": 120, "social": 400},
                status="active",
            )
            db.add(policy)

        print(f"  Seeded {num_honest + num_suspicious} riders ({num_honest} honest, {num_suspicious} suspicious)")

        # ── 7 days of activity history ──
        for rider in riders:
            zone_result = await db.execute(select(Zone).where(Zone.id == rider.zone_id))
            zone = zone_result.scalar_one()
            now = datetime.now(timezone.utc)

            for day_offset in range(7):
                date = now - timedelta(days=day_offset)
                activity_data = generate_rider_activity(
                    rider_id=rider.id,
                    date=date,
                    zone_lat=zone.lat,
                    zone_lng=zone.lng,
                    is_suspicious=rider.is_suspicious,
                )
                activity = RiderActivity(**activity_data)
                db.add(activity)

        print(f"  Generated 7 days of activity data for {len(riders)} riders")

        # ── Rate Cards (Mumbai) ──
        pricing = PricingEngine()
        count = 0
        for tier in ["high", "medium", "low"]:
            for month in range(1, 13):
                result = pricing.calculate_premium("Mumbai", tier, month)
                card = PremiumRateCard(
                    city_id=city_map["Mumbai"],
                    zone_tier=ZoneTier(tier),
                    month=month,
                    base_rate=result["base_rate"],
                    rainfall_rate=result["breakdown"].get("rainfall", 0),
                    heat_rate=result["breakdown"].get("heat", 0),
                    cold_fog_rate=result["breakdown"].get("cold_fog", 0),
                    aqi_rate=result["breakdown"].get("aqi", 0),
                    traffic_rate=result["breakdown"].get("traffic", 0),
                    social_rate=result["breakdown"].get("social", 0),
                    total_premium=result["total_weekly_premium"],
                )
                db.add(card)
                count += 1
        print(f"  Seeded {count} rate cards")

        await db.commit()
        print("\nSeed complete!")
        print(f"  Demo login: phone 9000000000 to 9000000049, password: demo1234")
        print(f"  Suspicious riders: phone 9000000040 to 9000000049")


if __name__ == "__main__":
    asyncio.run(seed())
