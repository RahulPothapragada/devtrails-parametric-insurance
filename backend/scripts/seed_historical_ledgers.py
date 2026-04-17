"""
Seed weekly_ledgers with 52 weeks of historical data per city (Feb 2025 → Feb 2026).
Uses city-specific seasonal BCR patterns (monsoon, heat, AQI, winter) so the
Data Timeline chart shows real seasonal variation per city.

Run: cd backend && venv/bin/python scripts/seed_historical_ledgers.py
"""

import os, sys, math, asyncio, random
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:3Ry6kUWgJ4f%2AT6f@db.pcapoafijrtlxlachxft.supabase.co:5432/postgres"
)

# ── City-specific monthly LR multipliers (same as data.py CITY_SEASONAL_LR) ──
# Normalised so the average across 12 months ≈ 1.0, meaning the base BCR
# for each city is multiplied by this to get the seasonal BCR.
CITY_SEASONAL_LR = {
    "Mumbai": {
        1:0.65, 2:0.62, 3:0.70, 4:0.85, 5:1.05,
        6:1.70, 7:2.30, 8:2.20, 9:1.60,
        10:0.90, 11:0.70, 12:0.65,
    },
    "Chennai": {
        1:0.85, 2:0.80, 3:0.82, 4:0.90, 5:1.00,
        6:1.10, 7:1.15, 8:1.10, 9:1.20,
        10:1.55, 11:1.90, 12:1.65,
    },
    "Kolkata": {
        1:0.80, 2:0.78, 3:0.88, 4:1.05, 5:1.15,
        6:1.50, 7:1.75, 8:1.70, 9:1.45,
        10:1.30, 11:0.95, 12:0.82,
    },
    "Bangalore": {
        1:0.82, 2:0.80, 3:0.88, 4:1.00, 5:1.10,
        6:1.25, 7:1.20, 8:1.15, 9:1.10,
        10:1.28, 11:1.05, 12:0.85,
    },
    "Delhi": {
        1:1.05, 2:0.88, 3:0.95, 4:1.20, 5:1.55,
        6:1.30, 7:1.40, 8:1.35, 9:1.15,
        10:1.05, 11:1.25, 12:1.15,
    },
    "Hyderabad": {
        1:0.80, 2:0.78, 3:0.88, 4:1.10, 5:1.25,
        6:1.35, 7:1.45, 8:1.40, 9:1.25,
        10:0.95, 11:0.82, 12:0.78,
    },
    "Pune": {
        1:0.72, 2:0.70, 3:0.78, 4:0.92, 5:1.05,
        6:1.55, 7:1.90, 8:1.85, 9:1.40,
        10:0.88, 11:0.74, 12:0.70,
    },
    "Ahmedabad": {
        1:0.80, 2:0.78, 3:0.95, 4:1.35, 5:1.70,
        6:1.55, 7:1.10, 8:1.05, 9:0.95,
        10:0.85, 11:0.80, 12:0.78,
    },
    "Jaipur": {
        1:0.78, 2:0.75, 3:0.92, 4:1.30, 5:1.65,
        6:1.45, 7:1.05, 8:1.00, 9:0.90,
        10:0.82, 11:0.78, 12:0.76,
    },
    "Lucknow": {
        1:1.00, 2:0.88, 3:0.95, 4:1.15, 5:1.40,
        6:1.30, 7:1.35, 8:1.30, 9:1.15,
        10:1.00, 11:1.20, 12:1.10,
    },
    "Indore": {
        1:0.82, 2:0.80, 3:0.90, 4:1.05, 5:1.20,
        6:1.40, 7:1.55, 8:1.50, 9:1.25,
        10:0.95, 11:0.84, 12:0.80,
    },
    "Patna": {
        1:0.92, 2:0.85, 3:0.95, 4:1.10, 5:1.35,
        6:1.40, 7:1.50, 8:1.45, 9:1.25,
        10:1.00, 11:1.15, 12:1.05,
    },
    "Bhopal": {
        1:0.82, 2:0.80, 3:0.90, 4:1.08, 5:1.22,
        6:1.42, 7:1.58, 8:1.52, 9:1.28,
        10:0.97, 11:0.85, 12:0.80,
    },
}
DEFAULT_SEASONAL = {
    1:0.88, 2:0.85, 3:0.95, 4:1.08, 5:1.15,
    6:1.35, 7:1.60, 8:1.55, 9:1.30,
    10:1.00, 11:0.92, 12:0.88,
}
SEASONAL_PREM = {
    1:0.95, 2:0.93, 3:1.00, 4:1.05, 5:1.08,
    6:1.15, 7:1.20, 8:1.18, 9:1.10,
    10:1.00, 11:0.96, 12:0.90,
}

# Deterministic noise per city+week (stable, no random state)
def _noise(city_name: str, week_offset: int, scale: float = 0.04) -> float:
    base = sum(ord(c) * (i+1) for i, c in enumerate(city_name))
    seed = ((base * 1664525 + week_offset * 1013904223) & 0xFFFFFFFF)
    return (seed / 0xFFFFFFFF - 0.5) * 2 * scale

async def main():
    engine = create_async_engine(DATABASE_URL, pool_pre_ping=True)

    async with AsyncSession(engine) as db:
        # Load cities
        r = await db.execute(text("SELECT id, name FROM cities ORDER BY name"))
        cities = {row[1]: row[0] for row in r.fetchall()}
        print(f"Found {len(cities)} cities: {sorted(cities)}")

        # Load existing ledger avg per city (use as winter baseline BCR + premium)
        r = await db.execute(text("""
            SELECT c.name,
                   AVG(wl.loss_ratio)          AS avg_lr,
                   AVG(wl.premium_collected)   AS avg_prem,
                   AVG(wl.total_policies)      AS avg_pol,
                   AVG(wl.total_claims)        AS avg_claims,
                   MIN(wl.week_start)          AS first_week
            FROM weekly_ledgers wl
            JOIN cities c ON c.id = wl.city_id
            GROUP BY c.name
        """))
        city_stats = {row[0]: {
            "avg_lr":    float(row[1]),
            "avg_prem":  float(row[2]),
            "avg_pol":   int(row[3]),
            "avg_claims": float(row[4]),
            "first_week": row[5],
        } for row in r.fetchall()}

        # Delete existing historical rows (keep only Feb 2026 onwards — we'll regenerate all)
        cutoff = datetime(2025, 2, 3)  # keep nothing before Feb 2025 (we're inserting fresh)
        deleted = await db.execute(
            text("DELETE FROM weekly_ledgers WHERE week_start < :cutoff"),
            {"cutoff": cutoff}
        )
        await db.commit()

        # Also delete any rows older than first existing week so we can insert fresh
        # Actually delete everything and re-insert including the original 8 weeks
        # First save existing data
        r = await db.execute(text("""
            SELECT city_id, week_start, week_end, total_policies, premium_collected,
                   total_claims, claims_approved, claims_denied, total_payout,
                   loss_ratio, bcr, avg_claim_amount,
                   urban_claims, semi_urban_claims, rural_claims,
                   urban_payout, semi_urban_payout, rural_payout
            FROM weekly_ledgers ORDER BY city_id, week_start
        """))
        existing = r.fetchall()
        print(f"Existing rows after delete: {len(existing)}")

        total_inserted = 0

        for city_name, city_id in sorted(cities.items()):
            if city_name not in city_stats:
                print(f"  Skipping {city_name} — no existing stats")
                continue

            stats = city_stats[city_name]
            base_lr   = stats["avg_lr"]    # winter baseline BCR (~10-13%)
            base_prem = stats["avg_prem"]  # avg weekly premium
            base_pol  = stats["avg_pol"]
            seasonal  = CITY_SEASONAL_LR.get(city_name, DEFAULT_SEASONAL)

            # Insert 52 weeks: Feb 2025 → Feb 2026 (just before existing data)
            # Existing data starts ~Feb 16 2026, so we insert up to Feb 9 2026
            insert_start = datetime(2025, 2, 3)  # Mon, 3 Feb 2025
            N = 52  # full year

            rows_to_insert = []
            for i in range(N):
                week_start = insert_start + timedelta(weeks=i)
                week_end   = week_start + timedelta(days=6, hours=23, minutes=59)
                month = week_start.month

                s_lr   = seasonal.get(month, 1.0)
                s_prem = SEASONAL_PREM.get(month, 1.0)

                # Deterministic noise
                noise_lr   = _noise(city_name, i, scale=0.03)
                noise_prem = _noise(city_name, i + 5000, scale=0.03)

                lr   = max(0.04, base_lr   * s_lr   + noise_lr)
                prem = max(0.0,  base_prem * s_prem * (1 + noise_prem))
                payout = prem * lr

                # Scale claims proportionally to payout
                claims_total    = max(1, int(stats["avg_claims"] * s_lr + _noise(city_name, i+1000, 0.15) * stats["avg_claims"]))
                approved        = int(claims_total * 0.72)
                denied          = claims_total - approved
                avg_claim_amt   = payout / claims_total if claims_total > 0 else 0

                # Urban split (all urban in our data)
                urban_payout    = payout
                semi_payout     = 0.0
                rural_payout    = 0.0

                rows_to_insert.append({
                    "city_id":           city_id,
                    "week_start":        week_start,
                    "week_end":          week_end,
                    "total_policies":    base_pol,
                    "premium_collected": round(prem, 2),
                    "total_claims":      claims_total,
                    "claims_approved":   approved,
                    "claims_denied":     denied,
                    "total_payout":      round(payout, 2),
                    "loss_ratio":        round(lr, 6),
                    "bcr":               round(lr, 6),
                    "avg_claim_amount":  round(avg_claim_amt, 2),
                    "urban_claims":      claims_total,
                    "semi_urban_claims": 0,
                    "rural_claims":      0,
                    "urban_payout":      round(urban_payout, 2),
                    "semi_urban_payout": 0.0,
                    "rural_payout":      0.0,
                })

            # Bulk insert
            await db.execute(text("""
                INSERT INTO weekly_ledgers
                  (city_id, week_start, week_end, total_policies, premium_collected,
                   total_claims, claims_approved, claims_denied, total_payout,
                   loss_ratio, bcr, avg_claim_amount,
                   urban_claims, semi_urban_claims, rural_claims,
                   urban_payout, semi_urban_payout, rural_payout)
                VALUES
                  (:city_id, :week_start, :week_end, :total_policies, :premium_collected,
                   :total_claims, :claims_approved, :claims_denied, :total_payout,
                   :loss_ratio, :bcr, :avg_claim_amount,
                   :urban_claims, :semi_urban_claims, :rural_claims,
                   :urban_payout, :semi_urban_payout, :rural_payout)
            """), rows_to_insert)

            total_inserted += len(rows_to_insert)
            print(f"  {city_name}: inserted {len(rows_to_insert)} weeks "
                  f"| BCR range: {min(r['bcr'] for r in rows_to_insert)*100:.1f}% "
                  f"– {max(r['bcr'] for r in rows_to_insert)*100:.1f}%")

        await db.commit()
        print(f"\n✓ Total inserted: {total_inserted} rows across {len(cities)} cities")

        # Verify
        r = await db.execute(text("SELECT COUNT(*), MIN(week_start), MAX(week_start) FROM weekly_ledgers"))
        row = r.fetchone()
        print(f"✓ weekly_ledgers now has {row[0]} rows, spanning {str(row[1])[:10]} → {str(row[2])[:10]}")

asyncio.run(main())
