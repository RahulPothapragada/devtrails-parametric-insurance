"""
Data Timeline route — Historical (real DB) + Live Simulation + Monte Carlo Projection.
No DB writes. Pure computation on existing weekly_ledgers data.

Endpoints:
  GET /api/data/timeline/{city_name}?scenario=normal|monsoon|heat_wave|aqi_crisis
  GET /api/data/cities
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone
import math
import time

from app.core.database import get_db
from app.models.models import City, WeeklyLedger

router = APIRouter()

# ── Scenario shock multipliers ──────────────────────────────────────
SCENARIO_SHOCKS = {
    "normal":     {"lr_mult": 1.00, "premium_mult": 1.00, "label": "Normal Conditions",    "description": "Baseline — no weather events"},
    "monsoon":    {"lr_mult": 1.65, "premium_mult": 0.92, "label": "Monsoon Season",       "description": "Extreme rain · LR ×1.65 — expect suspension"},
    "heat_wave":  {"lr_mult": 1.18, "premium_mult": 0.96, "label": "Heat Wave",            "description": "Sustained heat >40°C · LR ×1.18"},
    "aqi_crisis": {"lr_mult": 1.30, "premium_mult": 0.94, "label": "AQI Crisis",           "description": "AQI >300 · reduced rider activity · LR ×1.30"},
}

# ── Seasonal LR multipliers by calendar month (IMD-based) ───────────
SEASONAL_LR = {
    1: 0.88,   # Jan — cold fog, low claims
    2: 0.85,   # Feb — stable
    3: 0.95,   # Mar — heat starting
    4: 1.08,   # Apr — pre-summer peak heat
    5: 1.15,   # May — peak heat / dust storms
    6: 1.35,   # Jun — monsoon onset
    7: 1.60,   # Jul — peak monsoon (IMD worst-case)
    8: 1.55,   # Aug — sustained monsoon
    9: 1.30,   # Sep — retreating monsoon
    10: 1.00,  # Oct — post-monsoon, stable
    11: 0.92,  # Nov — mild
    12: 0.88,  # Dec — cold, low claims
}

SEASONAL_PREM = {
    1: 0.95,  2: 0.93,  3: 1.00,  4: 1.05,  5: 1.08,
    6: 1.15,  7: 1.20,  8: 1.18,  9: 1.10,  10: 1.00,
    11: 0.96, 12: 0.90,
}


# ── Deterministic pseudo-random via LCG + Box-Muller ─────────────────
def _lcg(seed: int) -> tuple[float, int]:
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
    return seed / 0xFFFFFFFF, seed


def _gauss(seed: int) -> tuple[float, int]:
    """Box-Muller, returns (z ~ N(0,1), next_seed)."""
    u1, seed = _lcg(seed)
    u2, seed = _lcg(seed)
    u1 = max(u1, 1e-10)
    z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
    return z, seed


def _time_seed(city: str, extra: int = 0) -> int:
    """Seed changes every 15 seconds — values visibly tick on frontend poll."""
    bucket = int(time.time() // 15)
    base = sum(ord(c) for c in city) * 31 + extra
    return (base ^ (bucket * 2654435761)) & 0xFFFFFFFF


def _sustainability(lr: float) -> str:
    if lr > 0.85: return "critical"
    if lr > 0.70: return "watch"
    if lr > 0.55: return "optimal"
    return "healthy"


# ── Monte Carlo projection ────────────────────────────────────────────
def _monte_carlo(
    base_lr: float,
    base_premium: float,
    n_weeks: int,
    scenario: str,
    city: str,
    start_month: int,
) -> list[dict]:
    """500-path Monte Carlo, returns mean + P10 + P90 per week."""
    shock = SCENARIO_SHOCKS[scenario]
    N = 500
    lr_sig   = 0.06
    prem_sig = 0.04

    # Generate all paths
    all_lrs   = [[] for _ in range(n_weeks)]
    all_prems = [[] for _ in range(n_weeks)]

    for path_i in range(N):
        seed = (sum(ord(c) for c in city) * 17 + path_i * 7919) & 0xFFFFFFFF
        for w in range(n_weeks):
            month = ((start_month - 1 + w) % 12) + 1
            s_lr   = SEASONAL_LR.get(month, 1.0)
            s_prem = SEASONAL_PREM.get(month, 1.0)

            z_lr,   seed = _gauss(seed)
            z_prem, seed = _gauss(seed)

            lr_w   = base_lr   * shock["lr_mult"]   * s_lr   + z_lr   * lr_sig
            lr_w   = max(0.10, min(lr_w, 2.0))
            prem_w = base_premium * shock["premium_mult"] * s_prem * (1.0 + z_prem * prem_sig)
            prem_w = max(prem_w, 0.0)

            all_lrs[w].append(lr_w)
            all_prems[w].append(prem_w)

    results = []
    for w in range(n_weeks):
        lrs_sorted = sorted(all_lrs[w])
        mean_lr    = sum(lrs_sorted) / N
        p10_lr     = lrs_sorted[int(0.10 * N)]
        p90_lr     = lrs_sorted[int(0.90 * N)]
        mean_prem  = sum(all_prems[w]) / N
        month      = ((start_month - 1 + w) % 12) + 1

        results.append({
            "week_label":    f"W+{w + 1}",
            "week_offset":   w + 1,
            "month":         month,
            "bcr_mean":      round(mean_lr,  4),
            "bcr_p10":       round(p10_lr,   4),
            "bcr_p90":       round(p90_lr,   4),
            "premium_mean":  round(mean_prem, 2),
            "payout_mean":   round(mean_prem * mean_lr, 2),
            "status":        _sustainability(mean_lr),
            "suspension_risk": mean_lr > 0.85,
        })
    return results


# ── Endpoints ─────────────────────────────────────────────────────────

@router.get("/cities", summary="Cities available for timeline")
async def timeline_cities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(City).order_by(City.name))
    cities = result.scalars().all()
    return [
        {"name": c.name, "tier": c.city_tier.value if c.city_tier else "tier_1"}
        for c in cities
    ]


@router.get("/timeline/{city_name}", summary="Historical + live simulation + projection")
async def data_timeline(
    city_name: str,
    scenario: str = "normal",
    db: AsyncSession = Depends(get_db),
):
    """
    Returns three time-series zones for the Data Timeline page:
      - historical: 8 weeks of real weekly_ledger data (sorted oldest→newest)
      - current_week: simulated current-week progress, ticks every 15s
      - projection: 4-week Monte Carlo forecast (mean + P10/P90 confidence band)
    """
    if scenario not in SCENARIO_SHOCKS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario '{scenario}'. Valid: {list(SCENARIO_SHOCKS)}"
        )

    # Load city
    city_res = await db.execute(select(City).where(City.name == city_name))
    city = city_res.scalar_one_or_none()
    if not city:
        raise HTTPException(status_code=404, detail=f"City '{city_name}' not found")

    # Load historical ledger (oldest → newest)
    ledger_res = await db.execute(
        select(WeeklyLedger)
        .where(WeeklyLedger.city_id == city.id)
        .order_by(WeeklyLedger.week_start.asc())
    )
    ledgers = ledger_res.scalars().all()
    if not ledgers:
        raise HTTPException(status_code=404, detail=f"No ledger data for '{city_name}'")

    # ── Zone 1: Historical ────────────────────────────────────────────
    historical = []
    for i, l in enumerate(ledgers):
        d = l.week_start
        label = f"{d.day}/{d.month}" if hasattr(d, 'day') else f"W{i + 1}"
        historical.append({
            "week_label":        label,
            "week_start":        l.week_start.isoformat(),
            "bcr":               round(l.bcr,               4),
            "loss_ratio":        round(l.loss_ratio,         4),
            "premium_collected": round(l.premium_collected,  2),
            "total_payout":      round(l.total_payout,       2),
            "total_claims":      l.total_claims,
            "total_policies":    l.total_policies,
            "status":            _sustainability(l.loss_ratio),
        })

    # Baseline stats from real data
    avg_lr      = sum(l.loss_ratio         for l in ledgers) / len(ledgers)
    avg_premium = sum(l.premium_collected  for l in ledgers) / len(ledgers)
    trend_lr    = (ledgers[-1].loss_ratio - ledgers[0].loss_ratio) / max(len(ledgers) - 1, 1)

    # ── Zone 2: Current week (deterministic tick via time bucket) ─────
    now = datetime.now(timezone.utc)
    week_day = now.weekday()          # 0=Mon … 6=Sun
    progress = (
        week_day * 86400 + now.hour * 3600 + now.minute * 60 + now.second
    ) / (7 * 86400)
    progress = min(progress, 1.0)

    shock      = SCENARIO_SHOCKS[scenario]
    s_lr       = SEASONAL_LR.get(now.month, 1.0)
    s_prem     = SEASONAL_PREM.get(now.month, 1.0)

    seed = _time_seed(city_name, 0)
    z_lr,   seed = _gauss(seed)
    z_prem, _    = _gauss(seed)

    cur_lr   = avg_lr   * shock["lr_mult"]   * s_lr   + z_lr   * 0.06
    cur_lr   = max(0.10, min(cur_lr, 2.0))
    cur_prem = avg_premium * shock["premium_mult"] * s_prem * progress * (1.0 + z_prem * 0.04)

    current_week = {
        "week_label":       "NOW",
        "progress_pct":     round(progress * 100, 1),
        "bcr":              round(cur_lr,   4),
        "loss_ratio":       round(cur_lr,   4),
        "premium_so_far":   round(max(cur_prem, 0.0), 2),
        "payout_so_far":    round(max(cur_prem * cur_lr, 0.0), 2),
        "season_mult":      round(s_lr,     2),
        "shock_mult":       round(shock["lr_mult"], 2),
        "status":           _sustainability(cur_lr),
        "suspension_risk":  cur_lr > 0.85,
    }

    # ── Zone 3: Monte Carlo projection — 4 weeks ──────────────────────
    next_month = (now.month % 12) + 1
    projection = _monte_carlo(
        base_lr=avg_lr,
        base_premium=avg_premium,
        n_weeks=4,
        scenario=scenario,
        city=city_name,
        start_month=next_month,
    )

    return {
        "city":       city_name,
        "city_tier":  city.city_tier.value if city.city_tier else "tier_1",
        "scenario":   scenario,
        "historical": historical,
        "current_week": current_week,
        "projection": projection,
        "simulation_meta": {
            "suspend_threshold":       0.85,
            "bcr_target_low":          0.55,
            "bcr_target_high":         0.70,
            "historical_avg_lr":       round(avg_lr,      4),
            "historical_avg_premium":  round(avg_premium, 2),
            "historical_lr_trend_per_week": round(trend_lr, 5),
            "monte_carlo_paths":       500,
            "tick_interval_s":         15,
            "scenarios":               list(SCENARIO_SHOCKS.keys()),
            "scenario_label":          shock["label"],
            "scenario_description":    shock["description"],
        },
    }
