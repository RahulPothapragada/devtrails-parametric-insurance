"""
Top-up script: fills in missing daily activity rows for the demo riders
so their 7-day earnings chart keeps displaying bars instead of "day off".

Problem:
  seed_db.py generates 30 days of activity for each rider ending on the
  day the seed ran. As real time marches on, those rows slide out of
  /riders/me's rolling 7-day window (since_7 = today-7d), and the chart
  renders ₹0 = "day off" for every day after the seed date.

Fix:
  For each demo rider (by default riders 1, 2, 3), find the most recent
  RiderActivity date. Generate a row for every day from (last+1) through
  yesterday, using the same _activity(...) helper as the seeder.

Usage:
  cd backend && ./venv/bin/python -m app.mock_data.topup_demo_activity
  cd backend && ./venv/bin/python -m app.mock_data.topup_demo_activity --rider-ids 1,2,3

Safe to re-run: skips any date that already has a row for that rider.
"""
from __future__ import annotations

import argparse
import asyncio
import random
from datetime import datetime, timedelta

from sqlalchemy import select

from app.core.database import async_session
from app.models.models import City, Rider, RiderActivity, Zone
from app.mock_data.seed_db import _activity, hourly_rate


async def topup(rider_ids: list[int]) -> None:
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    async with async_session() as db:
        riders = (
            await db.execute(select(Rider).where(Rider.id.in_(rider_ids)))
        ).scalars().all()

        if not riders:
            print(f"No riders found for ids={rider_ids}")
            return

        for rider in riders:
            zone = (
                await db.execute(select(Zone).where(Zone.id == rider.zone_id))
            ).scalar_one_or_none()
            if not zone:
                print(f"  ! rider {rider.id} ({rider.name}): zone missing, skip")
                continue

            city = (
                await db.execute(select(City).where(City.id == zone.city_id))
            ).scalar_one_or_none()

            existing_dates = set(
                (
                    await db.execute(
                        select(RiderActivity.date).where(
                            RiderActivity.rider_id == rider.id
                        )
                    )
                ).scalars().all()
            )
            existing_day_set = {
                (d.date() if hasattr(d, "date") else d) for d in existing_dates
            }

            # Walk the last 30 days; fill every day not already present.
            # We stop at yesterday — today's activity is typically incomplete
            # and will be filled by live events / claim_generator.
            filled = 0
            for days_ago in range(1, 31):
                wd = today - timedelta(days=days_ago)
                if wd.date() in existing_day_set:
                    continue

                rate = hourly_rate(
                    zone.tier.value,
                    city.city_tier.value if city and city.city_tier else "tier_1",
                    zone.area_type.value if zone.area_type else "urban",
                )
                rec = _activity(
                    rider_id=rider.id,
                    work_date=wd,
                    zone_lat=zone.lat,
                    zone_lng=zone.lng,
                    rate=rate,
                    shift=rider.shift_type or "morning",
                    # Demo riders are clean — use the clean distribution so
                    # hours/deliveries look like a normal working day.
                    fraud_type="clean",
                )
                db.add(RiderActivity(**rec))
                filled += 1

            # Recompute rolling metrics so the rider card stays accurate.
            all_activity = (
                await db.execute(
                    select(
                        RiderActivity.earnings,
                        RiderActivity.date,
                    ).where(RiderActivity.rider_id == rider.id)
                )
            ).all()
            # Pending (just-added) rows aren't visible yet — flush first:
            await db.flush()
            all_activity = (
                await db.execute(
                    select(
                        RiderActivity.earnings,
                        RiderActivity.date,
                    ).where(RiderActivity.rider_id == rider.id)
                )
            ).all()

            last_30_cutoff = today - timedelta(days=30)
            last_30 = [a for a in all_activity if a.date >= last_30_cutoff]
            last_7_cutoff = today - timedelta(days=7)
            last_7 = [a for a in all_activity if a.date >= last_7_cutoff]

            rider.active_days_last_30 = len({a.date.date() for a in last_30})
            weekly = sum(a.earnings for a in last_7) if last_7 else 0.0
            rider.avg_weekly_earnings = round(float(weekly), 2)
            rider.activity_tier = (
                "high" if rider.active_days_last_30 >= 20
                else "medium" if rider.active_days_last_30 >= 7
                else "low"
            )

            print(
                f"  ✓ rider {rider.id} ({rider.name}): "
                f"filled {filled} days · "
                f"active_days_30={rider.active_days_last_30} · "
                f"avg_weekly=₹{rider.avg_weekly_earnings:.0f}"
            )

        await db.commit()

    # Bust any cached dashboards so the new days show up immediately
    # (the dashboard is memoized per-rider with a 5-min TTL).
    try:
        from app.api.routes.riders import invalidate_dashboard_cache
        for rid in rider_ids:
            invalidate_dashboard_cache(rid)
    except Exception:
        pass

    print("Done.")


def _parse_ids(raw: str) -> list[int]:
    return [int(x) for x in raw.split(",") if x.strip()]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--rider-ids",
        default="1,2,3",
        help="Comma-separated rider IDs to top up (default: 1,2,3).",
    )
    args = parser.parse_args()
    random.seed()  # fresh randomness each run
    asyncio.run(topup(_parse_ids(args.rider_ids)))


if __name__ == "__main__":
    main()
