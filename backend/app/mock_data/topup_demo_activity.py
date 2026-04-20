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

# Demo-calibrated weekly earnings baselines — what the original seeded data
# showed for each city before drift. If the rolling last-7-day sum (with
# shortened hours) exceeds this, we trim hours/earnings on the last inserted
# day so riders don't suddenly "earn more" as time passes.
WEEKLY_BASELINE_BY_CITY = {
    "Mumbai":  (5_200, 5_400),
    "Pune":    (3_800, 4_200),
    "Lucknow": (3_200, 3_600),
}
# Target zone per demo rider — the 3 cities we showcase (tier 1/2/3 spread).
# Zone IDs: 1=Andheri West (Mumbai), 57=Swargate (Pune), 87=Charbagh (Lucknow).
DEMO_RIDER_ZONES = {1: 1, 2: 57, 3: 87}
# Fraction of missing days to treat as working (rest of the days stay ₹0 =
# naturally-realistic rest days). ~5 of 7 ≈ 0.71 matches gig-work patterns.
WORK_FRACTION = 0.71


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
            # Self-heal: make sure demo riders are on their intended city/zone.
            # If a prior deploy left them all on Mumbai, relocate + wipe stale
            # activity so the new city's baseline applies.
            target_zone_id = DEMO_RIDER_ZONES.get(rider.id)
            if target_zone_id is not None and rider.zone_id != target_zone_id:
                z_new = (
                    await db.execute(select(Zone).where(Zone.id == target_zone_id))
                ).scalar_one_or_none()
                c_new = (
                    await db.execute(select(City).where(City.id == z_new.city_id))
                ).scalar_one_or_none() if z_new else None
                if z_new and c_new:
                    rider.zone_id = target_zone_id
                    rider.dark_store_id = None
                    rider.avg_hourly_rate = hourly_rate(
                        z_new.tier.value,
                        c_new.city_tier.value if c_new.city_tier else "tier_1",
                        z_new.area_type.value if z_new.area_type else "urban",
                    )
                    # Clear stale activity tied to the old city.
                    from sqlalchemy import delete as _delete
                    await db.execute(
                        _delete(RiderActivity).where(RiderActivity.rider_id == rider.id)
                    )
                    print(
                        f"  ↪ rider {rider.id}: moved to {c_new.name} "
                        f"(hourly ₹{rider.avg_hourly_rate})"
                    )

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

            # Walk the last 30 days; only ~71% of missing days become working
            # days so rest-day realism is preserved and weekly earnings stay
            # at the demo baseline (~5.2-5.4k for Mumbai). Stops at yesterday.
            # Pure-function work/rest pattern: depends only on (rider_id, date),
            # so repeat runs select the exact same days → idempotent.
            # Last 7 days: 5 working + 2 rest (positions based on rider_id).
            # Rest-day offsets from "today" form a deterministic pattern:
            #   rider 1 rests days {2, 5} ago, rider 2 {3, 6}, rider 3 {1, 4} …
            rest_offsets = {(rider.id + k) % 7 + 1 for k in (1, 4)}
            work_recent = [
                today - timedelta(days=d)
                for d in range(1, 8)
                if d not in rest_offsets
                and (today - timedelta(days=d)).date() not in existing_day_set
            ]
            # Older days: work if hash(rider_id, ordinal) passes the fraction.
            def _is_work_day(rid: int, wd: datetime) -> bool:
                h = (rid * 2654435761 + wd.toordinal() * 40503) & 0xFFFF
                return (h / 0xFFFF) < WORK_FRACTION

            work_older = [
                today - timedelta(days=d)
                for d in range(8, 31)
                if _is_work_day(rider.id, today - timedelta(days=d))
                and (today - timedelta(days=d)).date() not in existing_day_set
            ]
            work_days = work_recent + work_older

            rate = hourly_rate(
                zone.tier.value,
                city.city_tier.value if city and city.city_tier else "tier_1",
                zone.area_type.value if zone.area_type else "urban",
            )

            # Scale each inserted day's earnings so the last-7-day sum
            # lands inside the city's demo baseline. Compute the scale from
            # the expected unscaled weekly sum for this rider's shift.
            baseline_lo, baseline_hi = WEEKLY_BASELINE_BY_CITY.get(
                city.name if city else "", (4_800, 5_400)
            )
            target_weekly = (baseline_lo + baseline_hi) / 2

            filled = 0
            for wd in work_days:
                rec = _activity(
                    rider_id=rider.id,
                    work_date=wd,
                    zone_lat=zone.lat,
                    zone_lng=zone.lng,
                    rate=rate,
                    shift=rider.shift_type or "morning",
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
            weekly_raw = sum(a.earnings for a in last_7) if last_7 else 0.0

            # Clamp to city baseline — scale inserted last-7-day rows so the
            # rolling weekly sum lands inside [baseline_lo, baseline_hi].
            if weekly_raw > 0 and not (baseline_lo <= weekly_raw <= baseline_hi):
                scale = target_weekly / weekly_raw
                for r_row in (
                    await db.execute(
                        select(RiderActivity).where(
                            RiderActivity.rider_id == rider.id,
                            RiderActivity.date >= last_7_cutoff,
                        )
                    )
                ).scalars().all():
                    r_row.earnings = round(float(r_row.earnings) * scale, 2)
                    r_row.hours_active = max(0.5, round(float(r_row.hours_active) * scale, 1))
                await db.flush()
                all_activity = (
                    await db.execute(
                        select(RiderActivity.earnings, RiderActivity.date)
                        .where(RiderActivity.rider_id == rider.id)
                    )
                ).all()
                last_7 = [a for a in all_activity if a.date >= last_7_cutoff]
                weekly_raw = sum(a.earnings for a in last_7)

            rider.avg_weekly_earnings = round(float(weekly_raw), 2)
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
