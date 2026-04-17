"""
FlowSecure — Complete Supabase Seed Script
Run: python -m app.mock_data.seed_db

Dataset design:
  - 13 cities × 1000 riders = 13,000 riders
  - ALL riders have verified KYC (aadhaar_verified=True, real formats)
  - Fraud is purely behavioural — no fake identity fields
  - Fraud split per city:
      750 clean riders          (75%)
       80 GPS spoofers          ( 8%) — static coordinates, hours claimed but no movement
       70 fraud ring members    ( 7%) — 10 rings of 7, all share one UPI per ring
       50 timing fraudsters     ( 5%) — log in minutes before trigger fires
       50 anomalous claimers    ( 5%) — high claim frequency vs zone peers
  - 30 days of activity per rider with realistic rest days
  - avg_hourly_rate = ZONE_HOURLY_RATES[zone_tier] × city_mult × area_mult  (matches claim_generator.py)
  - avg_weekly_earnings computed from actual generated activity
  - active_days_last_30 computed from actual generated activity
  - Policies priced via PricingEngine (no hardcoded premiums)
  - 8 weeks of city-level weekly ledger history
"""

import asyncio
import hashlib
import random
import math
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select, text

from app.core.database import engine, async_session, Base
from app.core.auth import hash_password
from app.models.models import (
    City, Zone, DarkStore, Rider, Policy, PremiumRateCard,
    RiderActivity, WeeklyLedger, ZoneTier, CityTier, AreaType,
)
from app.mock_data.seed_data import CITIES, CITY_ZONES, CITY_DARK_STORES
from app.services.pricing.pricing_engine import (
    PricingEngine, coverage_triggers_from_premium, premium_to_weekly_cap,
)

# ─────────────────────────────────────────────────────────────────────────────
# CONSTANTS
# ─────────────────────────────────────────────────────────────────────────────

RIDERS_PER_CITY = 1000

# Fraud split — must sum to RIDERS_PER_CITY
N_CLEAN        = 750
N_GPS_SPOOF    = 80
N_FRAUD_RING   = 70   # 10 rings of 7 riders each
N_TIMING       = 50
N_ANOMALOUS    = 50
RINGS_PER_CITY = 10
RING_SIZE      = 7    # N_FRAUD_RING // RINGS_PER_CITY

# avg_hourly_rate formula — MUST match claim_generator.py exactly
ZONE_HOURLY_RATES   = {"high": 170, "medium": 140, "low": 110}
CITY_TIER_RATE_MULT = {"tier_1": 1.0, "tier_2": 0.80, "tier_3": 0.60}
AREA_TYPE_RATE_MULT = {"urban": 1.0, "semi_urban": 0.75, "rural": 0.55}

# Shift windows: (login_start_h, login_end_h, min_hours, max_hours)
SHIFT_WINDOWS = {
    "morning":  (6,  9,  6, 10),
    "evening":  (14, 17, 5,  9),
    "night":    (20, 23, 5,  9),
    "flexible": (7,  13, 6, 10),
}

# Working days in 30-day period per category
WORKING_DAY_RANGE = {
    "clean_high":   (20, 26),
    "clean_medium": (12, 19),
    "gps_spoof":    (18, 24),   # Active enough to qualify (≥7 days)
    "fraud_ring":   (16, 22),
    "timing":       (14, 20),
    "anomalous":    (20, 26),   # Very active — lots of claims
}

# Deliveries per hour
DELIVERIES_PER_HOUR_RANGE = (3, 5)

# Batch sizes for DB inserts
RIDER_BATCH   = 50
ACTIVITY_BATCH = 500

# ─────────────────────────────────────────────────────────────────────────────
# IDENTITY HELPERS — real Indian formats, all unique
# ─────────────────────────────────────────────────────────────────────────────

FIRST_NAMES = [
    "Rahul","Priya","Amit","Sunita","Vijay","Kavya","Ravi","Meena",
    "Suresh","Anita","Deepak","Pooja","Rajesh","Neha","Arun","Divya",
    "Manoj","Shalini","Vikram","Rekha","Kiran","Geeta","Sanjay","Usha",
    "Mohan","Lata","Ashok","Nirmala","Dinesh","Savita","Ganesh","Radha",
    "Sunil","Kamla","Ramesh","Shanti","Naveen","Sudha","Prakash","Maya",
    "Harish","Gita","Vinod","Sarla","Bharat","Seema","Anil","Pushpa",
    "Mukesh","Asha","Yogesh","Sundar","Pankaj","Vandana","Rohit","Mamta",
    "Girish","Beena","Naresh","Jyoti","Hemant","Sharda","Vivek","Nalini",
    "Arjun","Lakshmi","Sandeep","Preeti","Vishal","Ananya","Nikhil","Swati",
    "Rakesh","Sonu","Ajay","Ritu","Vijayalakshmi","Santosh","Karthik","Padma",
]

LAST_NAMES = [
    "Sharma","Verma","Patel","Singh","Kumar","Gupta","Mishra","Joshi",
    "Yadav","Chauhan","Tiwari","Pandey","Chaudhary","Shah","Mehta",
    "Nair","Pillai","Reddy","Rao","Iyer","Menon","Krishnan","Naidu",
    "Desai","Jain","Agarwal","Bansal","Garg","Malhotra","Kapoor",
    "Bose","Chatterjee","Das","Mukherjee","Roy","Ghosh","Sen","Dey",
    "Khan","Ahmed","Siddiqui","Ansari","Qureshi","Sheikh","Ali",
    "Patil","Kulkarni","Deshpande","Bhosle","Shinde","More","Jadhav",
    "Rathore","Choudhary","Saxena","Srivastava","Tripathi","Dwivedi",
]

EMAIL_DOMAINS  = ["gmail.com","yahoo.com","hotmail.com","outlook.com","rediffmail.com"]
UPI_SUFFIXES   = ["oksbi","okaxis","okhdfcbank","ybl","paytm","gpay","apl"]
PLATFORMS      = ["Zepto","Blinkit","Swiggy Instamart"]


def _name(global_idx: int) -> str:
    pool_size = len(FIRST_NAMES) * len(LAST_NAMES)
    f = FIRST_NAMES[global_idx % len(FIRST_NAMES)]
    l = LAST_NAMES[(global_idx // len(FIRST_NAMES)) % len(LAST_NAMES)]
    cycle = global_idx // pool_size
    suffix = f" {cycle + 2}" if cycle > 0 else ""
    return f"{f} {l}{suffix}"


def _phone(global_idx: int) -> str:
    prefix = [6, 7, 8, 9][global_idx % 4]
    tail   = global_idx % 1_000_000_000
    return f"{prefix}{tail:09d}"


def _email(name: str, global_idx: int) -> str:
    slug   = name.lower().replace(" ", ".")
    domain = EMAIL_DOMAINS[global_idx % len(EMAIL_DOMAINS)]
    return f"{slug}{global_idx}@{domain}"


def _upi(name: str, global_idx: int) -> str:
    slug   = name.lower().replace(" ", "")[:8]
    suffix = UPI_SUFFIXES[global_idx % len(UPI_SUFFIXES)]
    return f"{slug}{global_idx}@{suffix}"


def _ring_upi(city_short: str, ring_idx: int) -> str:
    """One shared UPI per fraud ring."""
    return f"ring{city_short}{ring_idx:02d}@gpay"


def _fingerprint(global_idx: int) -> str:
    """Unique SHA256 device fingerprint for every rider."""
    raw = f"fs_device_{global_idx}_{random.randint(1_000_000, 9_999_999)}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _aadhaar() -> str:
    """Valid Aadhaar format: 12 digits, first digit 2-9."""
    return f"{random.randint(2,9)}{random.randint(10_000_000_000, 99_999_999_999):011d}"


def _pan(name: str, global_idx: int) -> str:
    """PAN format: AAAAA0000A — 5 letters, 4 digits, 1 letter."""
    initials = (name.replace(" ", "")[:3] + "PP").upper()[:5]
    digits   = f"{(global_idx % 10000):04d}"
    suffix   = chr(65 + (global_idx % 26))
    return f"{initials}{digits}{suffix}"


# ─────────────────────────────────────────────────────────────────────────────
# HOURLY RATE — matches claim_generator.py
# ─────────────────────────────────────────────────────────────────────────────

def hourly_rate(zone_tier: str, city_tier: str, area_type: str) -> float:
    base  = ZONE_HOURLY_RATES.get(zone_tier, 140)
    cm    = CITY_TIER_RATE_MULT.get(city_tier, 1.0)
    am    = AREA_TYPE_RATE_MULT.get(area_type, 1.0)
    return round(base * cm * am, 2)


# ─────────────────────────────────────────────────────────────────────────────
# GPS GENERATION
# ─────────────────────────────────────────────────────────────────────────────

def _moving_gps(zone_lat: float, zone_lng: float,
                login_dt: datetime, logout_dt: datetime) -> list[dict]:
    """Realistic moving GPS — rider travels within the zone during shift."""
    total_sec  = (logout_dt - login_dt).total_seconds()
    n_points   = max(6, int(total_sec / 600))   # 1 point per ~10 min
    lat = zone_lat + random.uniform(-0.004, 0.004)
    lng = zone_lng + random.uniform(-0.004, 0.004)
    interval   = total_sec / n_points
    points     = []
    for i in range(n_points):
        lat += random.uniform(-0.0025, 0.0025)
        lng += random.uniform(-0.0025, 0.0025)
        lat  = max(zone_lat - 0.013, min(zone_lat + 0.013, lat))
        lng  = max(zone_lng - 0.013, min(zone_lng + 0.013, lng))
        ts   = login_dt + timedelta(seconds=i * interval)
        points.append({"lat": round(lat, 6), "lng": round(lng, 6),
                        "timestamp": ts.isoformat()})
    return points


def _static_gps(zone_lat: float, zone_lng: float,
                login_dt: datetime, logout_dt: datetime) -> list[dict]:
    """GPS spoofer — all points within a ~5m radius (±0.00004°)."""
    n_points  = random.randint(5, 10)
    fixed_lat = zone_lat + random.uniform(-0.002, 0.002)
    fixed_lng = zone_lng + random.uniform(-0.002, 0.002)
    total_sec = (logout_dt - login_dt).total_seconds()
    interval  = total_sec / n_points
    points    = []
    for i in range(n_points):
        ts = login_dt + timedelta(seconds=i * interval)
        points.append({
            "lat": round(fixed_lat + random.uniform(-0.00004, 0.00004), 6),
            "lng": round(fixed_lng + random.uniform(-0.00004, 0.00004), 6),
            "timestamp": ts.isoformat(),
        })
    return points


# ─────────────────────────────────────────────────────────────────────────────
# ACTIVITY RECORD GENERATION
# ─────────────────────────────────────────────────────────────────────────────

def _activity(
    rider_id: int,
    work_date: datetime,
    zone_lat: float,
    zone_lng: float,
    rate: float,
    shift: str,
    fraud_type: str,
) -> dict:
    sw = SHIFT_WINDOWS.get(shift, SHIFT_WINDOWS["morning"])
    login_h_min, login_h_max, dur_min, dur_max = sw

    if fraud_type == "timing":
        # Looks like they rushed in just before they knew something would happen
        login_h   = random.randint(login_h_min, login_h_max)
        login_dt  = work_date.replace(hour=login_h, minute=random.randint(0, 59),
                                      second=0, microsecond=0)
        hours     = round(random.uniform(0.5, 2.0), 1)
        deliveries = random.randint(0, 2)
    else:
        login_h   = random.randint(login_h_min, login_h_max)
        login_dt  = work_date.replace(hour=login_h, minute=random.randint(0, 59),
                                      second=0, microsecond=0)
        hours     = round(random.uniform(dur_min, dur_max), 1)
        deliveries = int(hours * random.uniform(*DELIVERIES_PER_HOUR_RANGE))

    logout_dt = login_dt + timedelta(hours=hours)
    earnings  = round(hours * rate * random.uniform(0.90, 1.10), 2)

    gps = (_static_gps if fraud_type == "gps_spoof"
           else _moving_gps)(zone_lat, zone_lng, login_dt, logout_dt)

    return {
        "rider_id":            rider_id,
        "date":                work_date.replace(hour=0, minute=0, second=0, microsecond=0),
        "hours_active":        hours,
        "deliveries_completed": deliveries,
        "earnings":            earnings,
        "login_time":          login_dt,
        "logout_time":         logout_dt,
        "gps_points":          gps,
        "is_working":          True,
    }


# ─────────────────────────────────────────────────────────────────────────────
# SEED ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

async def seed():
    print("Creating tables…")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        existing = await db.execute(select(City))
        if existing.scalars().first():
            print("Database already seeded. Skipping.")
            return

    pwd_hash = hash_password("demo1234")
    pricing  = PricingEngine()
    now      = datetime.utcnow()   # naive UTC — PostgreSQL TIMESTAMP cols expect no tzinfo

    # ── 1. Cities ────────────────────────────────────────────────────────────
    async with async_session() as db:
        city_map      = {}   # name → id
        city_tier_map = {}   # name → tier str
        for c in CITIES:
            tier = CityTier(c.get("city_tier", "tier_1"))
            obj  = City(name=c["name"], state=c["state"],
                        lat=c["lat"], lng=c["lng"],
                        base_rate=c["base_rate"], city_tier=tier)
            db.add(obj)
            await db.flush()
            city_map[c["name"]]      = obj.id
            city_tier_map[c["name"]] = tier.value
        await db.commit()
    print(f"  ✓ {len(CITIES)} cities")

    # ── 2. Zones ─────────────────────────────────────────────────────────────
    async with async_session() as db:
        zone_meta = {}   # zone_id → {tier, area_type, city_tier, city_id, lat, lng}
        total_zones = 0
        for city_name, zones_data in CITY_ZONES.items():
            cid = city_map[city_name]
            ct  = city_tier_map[city_name]
            for z in zones_data:
                area = z.get("area_type", "urban")
                obj  = Zone(
                    city_id=cid,
                    name=z["name"],
                    tier=ZoneTier(z["tier"]),
                    area_type=AreaType(area),
                    lat=z["lat"], lng=z["lng"],
                    flood_risk_score=z.get("flood_risk",   0.5),
                    heat_risk_score =z.get("heat_risk",    0.5),
                    aqi_risk_score  =z.get("aqi_risk",     0.5),
                    traffic_risk_score=z.get("traffic_risk",0.5),
                    cold_risk_score =0.3,
                    social_risk_score=0.3,
                )
                db.add(obj)
                await db.flush()
                zone_meta[obj.id] = {
                    "tier": z["tier"], "area_type": area,
                    "city_tier": ct,   "city_id": cid,
                    "lat": z["lat"],   "lng": z["lng"],
                    "name": z["name"],
                }
                total_zones += 1
        await db.commit()
    print(f"  ✓ {total_zones} zones")

    # ── 3. Dark Stores ───────────────────────────────────────────────────────
    async with async_session() as db:
        zone_by_city_name: dict[str, dict[str, int]] = {}   # city → zone_name → zone_id
        all_zones_res = await db.execute(select(Zone))
        for z in all_zones_res.scalars().all():
            meta = zone_meta.get(z.id, {})
            cname = next((n for n, i in city_map.items() if i == meta.get("city_id")), None)
            if cname:
                zone_by_city_name.setdefault(cname, {})[meta["name"]] = z.id

        zone_store_map: dict[int, int] = {}   # zone_id → first store_id
        total_stores = 0
        for city_name, stores_data in CITY_DARK_STORES.items():
            for s in stores_data:
                zone_id = zone_by_city_name.get(city_name, {}).get(s["zone"])
                if not zone_id:
                    continue
                obj = DarkStore(
                    zone_id=zone_id, name=s["name"],
                    platform=random.choice(PLATFORMS),
                    lat=s["lat"], lng=s["lng"],
                    is_operational=True,
                )
                db.add(obj)
                await db.flush()
                zone_store_map.setdefault(zone_id, obj.id)
                total_stores += 1
        await db.commit()
    print(f"  ✓ {total_stores} dark stores")

    # ── 4. Rate Cards ────────────────────────────────────────────────────────
    async with async_session() as db:
        rate_count = 0
        for city_name, cid in city_map.items():
            ct = city_tier_map[city_name]
            for tier in ["high", "medium", "low"]:
                for month in range(1, 13):
                    r = pricing.calculate_premium(city_name, tier, month,
                                                  city_tier=ct, area_type="urban")
                    bd = r["breakdown"]
                    db.add(PremiumRateCard(
                        city_id=cid,
                        zone_tier=ZoneTier(tier),
                        month=month,
                        base_rate=float(r.get("base_rate", 20)),
                        rainfall_rate=float(bd.get("rainfall", 0)),
                        heat_rate    =float(bd.get("heat",     0)),
                        cold_fog_rate=float(bd.get("cold_fog", 0)),
                        aqi_rate     =float(bd.get("aqi",      0)),
                        traffic_rate =float(bd.get("traffic",  0)),
                        social_rate  =float(bd.get("social",   0)),
                        total_premium=float(r.get("total_weekly_premium", 45)),
                    ))
                    rate_count += 1
            await db.flush()
        await db.commit()
    print(f"  ✓ {rate_count} rate cards")

    # ── 5. Weekly Ledger (8 weeks history) ───────────────────────────────────
    async with async_session() as db:
        ledger_count = 0
        avg_prem_by_tier = {"tier_1": 62.0, "tier_2": 47.0, "tier_3": 32.0}

        for city_name, cid in city_map.items():
            ct = city_tier_map[city_name]
            city_zones = [m for m in zone_meta.values() if m["city_id"] == cid]
            n_zones    = max(len(city_zones), 1)
            urban_pct  = sum(1 for z in city_zones if z["area_type"] == "urban") / n_zones
            semi_pct   = sum(1 for z in city_zones if z["area_type"] == "semi_urban") / n_zones

            for week_offset in range(1, 9):
                w_end   = now - timedelta(weeks=week_offset - 1, days=now.weekday())
                w_start = w_end - timedelta(days=7)
                month   = w_start.month

                # Seasonal risk multiplier
                seasonal = 1.0
                if ct == "tier_1" and month in (6, 7, 8, 9):
                    seasonal = 2.2
                elif city_name in ("Delhi", "Lucknow", "Patna") and month in (10, 11, 12, 1):
                    seasonal = 1.9
                elif city_name in ("Delhi", "Jaipur", "Ahmedabad") and month in (4, 5):
                    seasonal = 1.6
                elif city_name in ("Chennai", "Kolkata", "Patna") and month in (10, 11):
                    seasonal = 2.0

                # Premium — use pricing engine avg per city tier
                avg_p = avg_prem_by_tier.get(ct, 45.0)
                total_premium    = round(RIDERS_PER_CITY * avg_p * random.uniform(0.93, 1.00), 2)
                base_claims      = max(2, int(RIDERS_PER_CITY * 0.10 * seasonal * random.uniform(0.7, 1.3)))
                claims_approved  = max(1, int(base_claims * random.uniform(0.65, 0.90)))
                claims_denied    = max(0, base_claims - claims_approved)

                urban_n = round(claims_approved * urban_pct)
                semi_n  = round(claims_approved * semi_pct)
                rural_n = claims_approved - urban_n - semi_n

                cap   = premium_to_weekly_cap(avg_p)
                scale = cap / 200.0
                avg_trigger_payout = round(207 * scale * 0.50)

                urban_pay = round(urban_n * avg_trigger_payout * 1.00 * random.uniform(0.9, 1.2), 2)
                semi_pay  = round(semi_n  * avg_trigger_payout * 0.75 * random.uniform(0.9, 1.2), 2)
                rural_pay = round(rural_n * avg_trigger_payout * 0.55 * random.uniform(0.9, 1.2), 2)
                total_payout = round(urban_pay + semi_pay + rural_pay, 2)

                lr       = round(total_payout / total_premium, 4) if total_premium else 0.0
                avg_clm  = round(total_payout / claims_approved, 2) if claims_approved else 0.0

                db.add(WeeklyLedger(
                    city_id=cid,
                    week_start=w_start, week_end=w_end,
                    total_policies=RIDERS_PER_CITY,
                    premium_collected=total_premium,
                    total_claims=base_claims,
                    claims_approved=claims_approved,
                    claims_denied=claims_denied,
                    total_payout=total_payout,
                    loss_ratio=lr, bcr=lr,
                    avg_claim_amount=avg_clm,
                    urban_claims=urban_n,
                    semi_urban_claims=semi_n,
                    rural_claims=rural_n,
                    urban_payout=urban_pay,
                    semi_urban_payout=semi_pay,
                    rural_payout=rural_pay,
                ))
                ledger_count += 1
            await db.flush()
        await db.commit()
    print(f"  ✓ {ledger_count} weekly ledger records")

    # ── 6. Riders + Activity + Policies ──────────────────────────────────────
    print("\nSeeding riders (this takes a few minutes)…")
    week_start_curr = now - timedelta(days=now.weekday())
    week_end_curr   = week_start_curr + timedelta(days=7)
    global_idx      = 0
    total_riders    = 0

    for city_name in city_map:
        cid   = city_map[city_name]
        ct    = city_tier_map[city_name]
        city_short = city_name[:3].lower()

        async with async_session() as db:
            zones_res = await db.execute(select(Zone).where(Zone.city_id == cid))
            city_zones_list = [
                (z.id, z.tier.value, z.area_type.value, z.lat, z.lng)
                for z in zones_res.scalars().all()
            ]

        # Build ordered list of (rider_local_idx, fraud_type, ring_upi_or_None)
        # Layout inside 1000 riders:
        #   0–749:   clean
        #   750–829: gps_spoof
        #   830–899: fraud_ring (10 rings × 7 riders)
        #   900–949: timing
        #   950–999: anomalous
        rider_specs = []
        for i in range(N_CLEAN):
            rider_specs.append(("clean", None))
        for i in range(N_GPS_SPOOF):
            rider_specs.append(("gps_spoof", None))
        for ring in range(RINGS_PER_CITY):
            shared_upi = _ring_upi(city_short, ring)
            for _ in range(RING_SIZE):
                rider_specs.append(("fraud_ring", shared_upi))
        for i in range(N_TIMING):
            rider_specs.append(("timing", None))
        for i in range(N_ANOMALOUS):
            rider_specs.append(("anomalous", None))

        rider_batch   = []   # (rider_obj, meta)
        activity_rows = []
        city_count    = 0

        for local_i, (fraud_type, ring_upi) in enumerate(rider_specs):
            gidx   = global_idx + local_i
            z_id, zt, at, zlat, zlng = city_zones_list[local_i % len(city_zones_list)]
            rate   = hourly_rate(zt, ct, at)
            name   = _name(gidx)
            phone  = _phone(gidx)
            email  = _email(name, gidx)
            upi    = ring_upi if ring_upi else _upi(name, gidx)
            fp     = _fingerprint(gidx)
            shift  = random.choice(["morning","evening","night","flexible"])
            ds_id  = zone_store_map.get(z_id)

            # Determine target active days
            if fraud_type == "clean":
                target_range = WORKING_DAY_RANGE["clean_high"] if random.random() > 0.35 \
                               else WORKING_DAY_RANGE["clean_medium"]
            else:
                target_range = WORKING_DAY_RANGE[fraud_type]

            target_days = random.randint(*target_range)

            # Determine which of the last 30 days are working days
            all_days = [now - timedelta(days=d) for d in range(30)]
            work_days = sorted(random.sample(all_days, min(target_days, 30)),
                               key=lambda d: d.toordinal(), reverse=True)

            # Generate activity records
            week_earnings  = [0.0, 0.0, 0.0, 0.0]  # 4 weekly buckets
            for wd in work_days:
                days_ago  = (now.date() - wd.date()).days
                week_buck = min(days_ago // 7, 3)
                rec = _activity(
                    rider_id=0,   # placeholder; filled after flush
                    work_date=wd,
                    zone_lat=zlat, zone_lng=zlng,
                    rate=rate,
                    shift=shift,
                    fraud_type=fraud_type,
                )
                week_earnings[week_buck] += rec["earnings"]
                activity_rows.append((rec, local_i))   # local_i links back to rider

            avg_weekly = round(sum(week_earnings) / max(len([w for w in week_earnings if w > 0]), 1), 2)
            active_days = len(work_days)
            act_tier = "high" if active_days >= 20 else "medium" if active_days >= 7 else "low"

            shield_lvl = min(5, max(1, active_days // 5))
            shield_xp  = float(active_days * random.randint(8, 15))

            rider = Rider(
                name=name,
                phone=phone,
                email=email,
                password_hash=pwd_hash,
                upi_id=upi,
                zone_id=z_id,
                dark_store_id=ds_id,
                shift_type=shift,
                avg_weekly_earnings=avg_weekly,
                avg_hourly_rate=rate,
                active_days_last_30=active_days,
                activity_tier=act_tier,
                shield_level=shield_lvl,
                shield_xp=shield_xp,
                fraud_score=0.0,
                device_fingerprint=fp,
                is_suspicious=(fraud_type != "clean"),
                aadhaar_verified=True,   # ALL riders verified KYC at signup
                is_active=True,
            )
            rider_batch.append((rider, local_i, z_id, zt, ct, at))
            city_count += 1

            # Flush riders + write their activities in batches
            if len(rider_batch) >= RIDER_BATCH or local_i == len(rider_specs) - 1:
                async with async_session() as db:
                    for r, ridx, zid, zone_tier_val, city_tier_val, area_val in rider_batch:
                        db.add(r)
                    await db.flush()

                    # Now IDs are available — create policies and fix activity rider_ids
                    for r, ridx, zid, zone_tier_val, city_tier_val, area_val in rider_batch:
                        # Policy priced via engine for current month
                        p_res = pricing.calculate_premium(
                            city_name, zone_tier_val, now.month,
                            city_tier=city_tier_val, area_type=area_val,
                            activity_tier=r.activity_tier,
                        )
                        pol = Policy(
                            rider_id=r.id, zone_id=zid,
                            week_start=week_start_curr,
                            week_end=week_end_curr,
                            premium_amount=p_res["total_weekly_premium"],
                            premium_breakdown=p_res["breakdown"],
                            coverage_triggers=coverage_triggers_from_premium(p_res["total_weekly_premium"]),
                            status="active",
                            auto_renew=True,
                        )
                        db.add(pol)

                    await db.flush()

                    # Match activity rows to rider IDs
                    rider_id_by_local = {ridx: r.id for r, ridx, *_ in rider_batch}
                    batch_acts = [rec for rec, ridx in activity_rows
                                  if ridx in rider_id_by_local]
                    for rec, ridx in [(r, i) for r, i in activity_rows if i in rider_id_by_local]:
                        rec["rider_id"] = rider_id_by_local[ridx]
                        act_obj = RiderActivity(**rec)
                        db.add(act_obj)
                        if len(db.new) >= ACTIVITY_BATCH:
                            await db.flush()

                    await db.commit()

                activity_rows = [row for row in activity_rows
                                 if row[1] not in rider_id_by_local]
                rider_batch.clear()

        global_idx   += len(rider_specs)
        total_riders += city_count
        n_susp = len(rider_specs) - N_CLEAN
        print(f"  ✓ {city_name}: {city_count} riders "
              f"({N_CLEAN} clean / {n_susp} behavioural fraud)")

    print(f"\n{'='*62}")
    print(f"  FlowSecure seed complete — Supabase PostgreSQL")
    print(f"  Cities  : {len(CITIES)} across 3 tiers")
    print(f"  Zones   : {total_zones}")
    print(f"  Riders  : {total_riders:,} (1,000 per city)")
    print(f"  Activity: ~{total_riders * 22:,} records (avg 22 working days)")
    print(f"  Fraud split per city:")
    print(f"    Clean            : {N_CLEAN}")
    print(f"    GPS Spoofers     : {N_GPS_SPOOF}")
    print(f"    Fraud Rings      : {N_FRAUD_RING} ({RINGS_PER_CITY} rings × {RING_SIZE} members, shared UPI)")
    print(f"    Timing Fraudsters: {N_TIMING}")
    print(f"    Anomalous Claimers: {N_ANOMALOUS}")
    print(f"  All riders: aadhaar_verified=True, unique fingerprints")
    print(f"  Login   : phone = 6/7/8/9 + 9-digit suffix (from index)")
    print(f"  Password: demo1234")
    print(f"{'='*62}")


if __name__ == "__main__":
    asyncio.run(seed())
