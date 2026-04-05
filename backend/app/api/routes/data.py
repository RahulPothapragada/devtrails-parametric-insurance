"""
Data Timeline route — Simulated History + Real DB Data + Live Simulation + Monte Carlo Projection.

Zones returned:
  1. simulated_history  — 52 weeks before first DB record, generated deterministically
                          from city avg BCR + IMD seasonal model. NOT hardcoded — pure maths.
  2. real              — exact weekly_ledgers rows from DB (Feb–Mar 2026)
  3. current_week      — live tick, seed changes every 15 s
  4. projection        — 12-week Monte Carlo, 500 paths, P10/P50/P90

All labels are real calendar dates (e.g. "2 Feb 26", "11 Apr 26").
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta, date
import asyncio
import math
import time

from app.core.database import get_db
from app.models.models import City, WeeklyLedger

router = APIRouter()

# ── Scenario multipliers ──────────────────────────────────────────────────────
SCENARIOS = {
    "normal":     {"lr_mult": 1.00, "prem_mult": 1.00, "label": "Normal",     "desc": "Baseline — no adverse events"},
    "monsoon":    {"lr_mult": 1.65, "prem_mult": 0.92, "label": "Monsoon",    "desc": "Extreme rain · LR ×1.65 — suspension likely"},
    "heat_wave":  {"lr_mult": 1.18, "prem_mult": 0.96, "label": "Heat Wave",  "desc": "Sustained heat >40°C · LR ×1.18"},
    "aqi_crisis": {"lr_mult": 1.30, "prem_mult": 0.94, "label": "AQI Crisis", "desc": "AQI >300 · LR ×1.30"},
}

# IMD-calibrated seasonal LR multipliers per calendar month
# Feb (DB start) is index 2 — winter/pre-heat, low claims
SEASONAL_LR = {
    1: 0.88,  2: 0.85,  3: 0.95,  4: 1.08,  5: 1.15,
    6: 1.35,  7: 1.60,  8: 1.55,  9: 1.30,
    10: 1.00, 11: 0.92, 12: 0.88,
}
SEASONAL_PREM = {
    1: 0.95,  2: 0.93,  3: 1.00,  4: 1.05,  5: 1.08,
    6: 1.15,  7: 1.20,  8: 1.18,  9: 1.10,
    10: 1.00, 11: 0.96, 12: 0.90,
}


# ── Pure-python pseudo-random (deterministic, no stdlib random state) ─────────
def _lcg(seed: int) -> tuple[float, int]:
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
    return seed / 0xFFFFFFFF, seed

def _gauss(seed: int) -> tuple[float, int]:
    """Box-Muller → z ~ N(0,1)."""
    u1, seed = _lcg(seed)
    u2, seed = _lcg(seed)
    u1 = max(u1, 1e-10)
    z = math.sqrt(-2.0 * math.log(u1)) * math.cos(2.0 * math.pi * u2)
    return z, seed

def _city_seed(city: str, week_offset: int) -> int:
    """Stable seed per (city, week) — does NOT change over time."""
    base = sum(ord(c) * (i + 1) for i, c in enumerate(city))
    return ((base * 6364136223846793005 + week_offset * 2654435761) & 0xFFFFFFFF)

def _live_seed(city: str) -> int:
    """Seed changes every 15 s — creates the visible tick effect."""
    bucket = int(time.time() // 15)
    base = sum(ord(c) for c in city) * 31
    return ((base ^ (bucket * 2654435761)) & 0xFFFFFFFF)


# ── Date helpers ──────────────────────────────────────────────────────────────
def _fmt_date(d: date) -> str:
    """'2 Feb 26', '15 Jul 25', etc."""
    return f"{d.day} {d.strftime('%b')} {str(d.year)[2:]}"


# ── Sustainability ────────────────────────────────────────────────────────────
def _status(lr: float) -> str:
    if lr > 0.85: return "critical"
    if lr > 0.70: return "watch"
    if lr > 0.55: return "optimal"
    return "healthy"


# ── Monte Carlo ───────────────────────────────────────────────────────────────
def _mc_week(base_lr: float, base_prem: float, scenario: str,
             city: str, month: int, path_idx: int, week_num: int) -> tuple[float, float]:
    sc   = SCENARIOS[scenario]
    s_lr = SEASONAL_LR.get(month, 1.0)
    s_pm = SEASONAL_PREM.get(month, 1.0)
    seed = _city_seed(city, path_idx * 1000 + week_num)
    z_lr,   seed = _gauss(seed)
    z_prem, _    = _gauss(seed)
    lr   = base_lr   * sc["lr_mult"]   * s_lr  + z_lr   * 0.07
    prem = base_prem * sc["prem_mult"] * s_pm  * (1 + z_prem * 0.04)
    return max(0.10, min(lr, 2.0)), max(prem, 0.0)

def _monte_carlo(base_lr, base_prem, n_weeks, scenario, city, start_month):
    N = 500
    all_lr   = [[] for _ in range(n_weeks)]
    all_prem = [[] for _ in range(n_weeks)]
    for p in range(N):
        for w in range(n_weeks):
            month = ((start_month - 1 + w) % 12) + 1
            lr, prem = _mc_week(base_lr, base_prem, scenario, city, month, p, w)
            all_lr[w].append(lr)
            all_prem[w].append(prem)
    out = []
    for w in range(n_weeks):
        s = sorted(all_lr[w])
        mn = sum(s) / N
        out.append({
            "bcr_mean": round(mn, 4),
            "bcr_p10":  round(s[int(0.10 * N)], 4),
            "bcr_p90":  round(s[int(0.90 * N)], 4),
            "prem_mean": round(sum(all_prem[w]) / N, 2),
            "status":   _status(mn),
            "suspension_risk": mn > 0.85,
        })
    return out


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/cities")
async def timeline_cities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(City).order_by(City.name))
    return [
        {"name": c.name, "tier": c.city_tier.value if c.city_tier else "tier_1"}
        for c in result.scalars().all()
    ]


@router.get("/timeline/{city_name}")
async def data_timeline(
    city_name: str,
    scenario: str = "normal",
    db: AsyncSession = Depends(get_db),
):
    if scenario not in SCENARIOS:
        raise HTTPException(400, f"Unknown scenario. Valid: {list(SCENARIOS)}")

    # Load city
    city_res = await db.execute(select(City).where(City.name == city_name))
    city = city_res.scalar_one_or_none()
    if not city:
        raise HTTPException(404, f"City '{city_name}' not found")

    # Load real ledger rows oldest→newest
    ledger_res = await db.execute(
        select(WeeklyLedger)
        .where(WeeklyLedger.city_id == city.id)
        .order_by(WeeklyLedger.week_start.asc())
    )
    ledgers = ledger_res.scalars().all()
    if not ledgers:
        raise HTTPException(404, f"No ledger data for '{city_name}'")

    # ── Real DB weeks ─────────────────────────────────────────────────────────
    real_weeks = []
    for l in ledgers:
        ws = l.week_start
        if hasattr(ws, 'date'):
            d = ws.date()
        else:
            # Handle if it's a string or naive datetime
            d = datetime.fromisoformat(str(ws)).date()
        real_weeks.append({
            "week_start_date": d,
            "week_label":      _fmt_date(d),
            "data_type":       "real",
            "bcr":             round(l.bcr, 4),
            "loss_ratio":      round(l.loss_ratio, 4),
            "premium":         round(l.premium_collected, 2),
            "payout":          round(l.total_payout, 2),
            "claims":          l.total_claims,
            "policies":        l.total_policies,
            "status":          _status(l.loss_ratio),
        })

    # Baseline from real data (unaffected by scenario — historical is always real)
    avg_lr   = sum(l.loss_ratio        for l in ledgers) / len(ledgers)
    avg_prem = sum(l.premium_collected for l in ledgers) / len(ledgers)
    # LR trend per week (from oldest to newest)
    lr_trend = (ledgers[-1].loss_ratio - ledgers[0].loss_ratio) / max(len(ledgers) - 1, 1)

    # ── Simulated history (52 weeks before first DB date) ────────────────────
    first_real_date = real_weeks[0]["week_start_date"]
    sim_history = []
    N_SIM = 52   # 1 year back
    for i in range(N_SIM):
        # weeks run oldest→newest: offset = -(N_SIM - i)
        offset = -(N_SIM - i)
        week_date = first_real_date + timedelta(weeks=offset)
        month = week_date.month

        s_lr   = SEASONAL_LR.get(month, 1.0)
        s_prem = SEASONAL_PREM.get(month, 1.0)

        # Deterministic noise via stable seed (city + week position)
        seed = _city_seed(city_name, i + 10000)
        z_lr,   seed = _gauss(seed)
        z_prem, _    = _gauss(seed)

        # Use real avg as baseline + seasonal pattern + noise (no trend extrapolation
        # — trend over 8 weeks is too noisy to project a year backward reliably)
        lr  = avg_lr * s_lr  + z_lr  * 0.06
        lr  = max(0.10, min(lr, 1.50))
        prem = avg_prem * s_prem * (1 + z_prem * 0.04)
        prem = max(prem, 0.0)

        sim_history.append({
            "week_start_date": week_date,
            "week_label":      _fmt_date(week_date),
            "data_type":       "simulated",
            "bcr":             round(lr, 4),
            "loss_ratio":      round(lr, 4),
            "premium":         round(prem, 2),
            "payout":          round(prem * lr, 2),
            "claims":          None,
            "policies":        None,
            "status":          _status(lr),
        })

    # ── Current week (live tick) ───────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    week_day = now.weekday()
    progress = (week_day * 86400 + now.hour * 3600 + now.minute * 60 + now.second) / (7 * 86400)
    progress = min(progress, 1.0)

    sc     = SCENARIOS[scenario]
    s_lr   = SEASONAL_LR.get(now.month, 1.0)
    s_prem = SEASONAL_PREM.get(now.month, 1.0)
    seed   = _live_seed(city_name)
    z_lr,   seed = _gauss(seed)
    z_prem, _    = _gauss(seed)

    cur_lr   = avg_lr   * sc["lr_mult"]   * s_lr  + z_lr   * 0.06
    cur_lr   = max(0.10, min(cur_lr, 2.0))
    cur_prem = avg_prem * sc["prem_mult"] * s_prem * progress * (1 + z_prem * 0.04)

    # Find Monday of current week
    monday = now.date() - timedelta(days=now.weekday())
    current_week = {
        "week_start_date": monday,
        "week_label":      f"{_fmt_date(monday)} ▶",
        "data_type":       "live",
        "bcr":             round(cur_lr, 4),
        "loss_ratio":      round(cur_lr, 4),
        "premium":         round(max(cur_prem, 0.0), 2),
        "payout":          round(max(cur_prem * cur_lr, 0.0), 2),
        "claims":          None,
        "policies":        None,
        "status":          _status(cur_lr),
        "progress_pct":    round(progress * 100, 1),
        "season_mult":     round(s_lr, 2),
        "shock_mult":      round(sc["lr_mult"], 2),
        "suspension_risk": cur_lr > 0.85,
    }

    # ── Monte Carlo projection (12 weeks) ─────────────────────────────────────
    # Run in a thread so CPU-bound work doesn't block the async event loop
    next_month = (now.month % 12) + 1
    mc_results = await asyncio.to_thread(_monte_carlo, avg_lr, avg_prem, 12, scenario, city_name, next_month)
    projection = []
    for i, mc in enumerate(mc_results):
        proj_date = monday + timedelta(weeks=(i + 1))
        projection.append({
            "week_start_date": proj_date,
            "week_label":      _fmt_date(proj_date),
            "data_type":       "projection",
            "bcr_mean":        mc["bcr_mean"],
            "bcr_p10":         mc["bcr_p10"],
            "bcr_p90":         mc["bcr_p90"],
            "band_base":       mc["bcr_p10"],
            "band_width":      round(max(0, mc["bcr_p90"] - mc["bcr_p10"]), 4),
            "premium_mean":    mc["prem_mean"],
            "payout_mean":     round(mc["prem_mean"] * mc["bcr_mean"], 2),
            "status":          mc["status"],
            "suspension_risk": mc["suspension_risk"],
        })

    # ── Serialize (dates → ISO strings for JSON) ──────────────────────────────
    def _ser(row: dict) -> dict:
        out = dict(row)
        if isinstance(out.get("week_start_date"), date):
            out["week_start_date"] = out["week_start_date"].isoformat()
        return out

    return {
        "city":           city_name,
        "city_tier":      city.city_tier.value if city.city_tier else "tier_1",
        "scenario":       scenario,
        "simulated_history": [_ser(p) for p in sim_history],
        "real_history":      [_ser(p) for p in real_weeks],
        "current_week":      _ser(current_week),
        "projection":        [_ser(p) for p in projection],
        "meta": {
            "real_weeks":            len(real_weeks),
            "simulated_weeks":       N_SIM,
            "projection_weeks":      12,
            "real_date_from":        real_weeks[0]["week_start_date"].isoformat() if isinstance(real_weeks[0]["week_start_date"], date) else real_weeks[0]["week_start_date"],
            "real_date_to":          real_weeks[-1]["week_start_date"].isoformat() if isinstance(real_weeks[-1]["week_start_date"], date) else real_weeks[-1]["week_start_date"],
            "avg_real_bcr":          round(avg_lr, 4),
            "avg_real_premium":      round(avg_prem, 2),
            "lr_trend_per_week":     round(lr_trend, 5),
            "suspend_threshold":     0.85,
            "bcr_target":            "0.55–0.70",
            "monte_carlo_paths":     500,
            "tick_interval_s":       15,
            "scenario_label":        sc["label"],
            "scenario_desc":         sc["desc"],
            "note": (
                "simulated_history is generated algorithmically from real avg BCR + "
                "IMD seasonal multipliers + deterministic per-week noise. "
                "real_history is exact data from weekly_ledgers DB table."
            ),
        },
    }


# ── Weather proxy ─────────────────────────────────────────────────────────────
import httpx
from app.core.config import settings

@router.get("/weather")
async def get_weather(city: str = "Delhi"):
    """
    Proxy OpenWeatherMap so the API key never leaves the server.
    Frontend calls /api/data/weather?city=Delhi — key stays server-side.
    Returns: { main, description, temp_c, humidity } or a safe fallback.
    """
    key = settings.OPENWEATHER_API_KEY
    if not key:
        return {"main": "NORMAL", "description": "API key not configured", "temp_c": 28, "humidity": 60}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": f"{city},IN", "appid": key},
            )
            r.raise_for_status()
            d = r.json()
            return {
                "main":        d["weather"][0]["main"],
                "description": d["weather"][0]["description"],
                "temp_c":      round(d["main"]["temp"] - 273.15, 1),
                "humidity":    d["main"]["humidity"],
            }
    except Exception:
        return {"main": "NORMAL", "description": "Weather service unavailable", "temp_c": 28, "humidity": 60}
