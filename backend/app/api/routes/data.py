"""
Data Timeline route — Simulated History + Real DB Data + Live Simulation + Monte Carlo Projection.

Zones returned:
  1. simulated_history  — 52 weeks before first DB record, generated deterministically
                          from city avg BCR + IMD seasonal model. NOT hardcoded — pure maths.
  2. real              — exact weekly_ledgers rows from DB (Feb–Mar 2026)
  3. current_week      — live tick, seed changes every 15 s
  4. projection        — 12-week Monte Carlo, 100 paths, P10/P50/P90

All labels are real calendar dates (e.g. "2 Feb 26", "11 Apr 26").
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta, date
import math
import time
from functools import lru_cache

from app.core.database import get_db
from app.models.models import City, WeeklyLedger

router = APIRouter()

# ── Scenario config (labels + premium impact) ─────────────────────────────────
SCENARIOS = {
    "normal":     {"prem_mult": 1.00, "label": "Normal",     "desc": "Baseline — no adverse events"},
    "monsoon":    {"prem_mult": 0.92, "label": "Monsoon",    "desc": "Extreme rain Jun–Sep · suspension risk in peak months"},
    "heat_wave":  {"prem_mult": 0.96, "label": "Heat Wave",  "desc": "Sustained heat >40°C · Apr–Jun stress"},
    "aqi_crisis": {"prem_mult": 0.94, "label": "AQI Crisis", "desc": "AQI >300 · Oct–Dec northern cities"},
}

# Generic premium seasonal pattern (still shared — premiums vary less by city)
SEASONAL_PREM = {
    1: 0.95, 2: 0.93, 3: 1.00, 4: 1.05, 5: 1.08,
    6: 1.15, 7: 1.20, 8: 1.18, 9: 1.10,
    10: 1.00, 11: 0.96, 12: 0.90,
}

# ── City-specific monthly LR baselines (replaces generic SEASONAL_LR) ─────────
# Each city has its own risk curve shape based on IMD geography.
# Values are multipliers on avg_lr for that month.
#
# Mumbai:    Extreme SW monsoon Jul-Aug, very mild Oct-Mar
# Chennai:   Mild SW monsoon, strong NE monsoon Oct-Dec (opposite of Mumbai)
# Delhi:     Heat spike May, moderate SW monsoon, AQI Nov-Jan
# Kolkata:   Strong SW monsoon Jun-Sep + cyclone risk Oct
# Bangalore: Two mild monsoon peaks (Jun, Oct), no extremes — high altitude
# Hyderabad: Moderate SW monsoon, heat Apr-May
# Pune:      Strong SW monsoon Jun-Sep, mild otherwise
# Ahmedabad: Extreme heat Apr-Jun, very low monsoon (arid/semi-arid)
# Jaipur:    Extreme heat Apr-Jun, minimal monsoon (Thar Desert edge)
# Lucknow:   Heat May-Jun, moderate monsoon Jul-Sep, AQI Nov-Jan
# Indore:    Moderate monsoon, mild heat
# Patna:     Hot summers, moderate-high monsoon, some AQI Nov
# Bhopal:    Moderate monsoon, moderate heat

CITY_SEASONAL_LR: dict[str, dict[int, float]] = {
    "Mumbai": {
        1: 0.65, 2: 0.62, 3: 0.70, 4: 0.85, 5: 1.05,
        6: 1.70, 7: 2.30, 8: 2.20, 9: 1.60,
        10: 0.90, 11: 0.70, 12: 0.65,
    },
    "Chennai": {
        # NE monsoon dominates Oct-Dec; SW monsoon is weaker here
        1: 0.85, 2: 0.80, 3: 0.82, 4: 0.90, 5: 1.00,
        6: 1.10, 7: 1.15, 8: 1.10, 9: 1.20,
        10: 1.55, 11: 1.90, 12: 1.65,
    },
    "Kolkata": {
        # Strong SW monsoon Jun-Sep, cyclone risk Oct
        1: 0.80, 2: 0.78, 3: 0.88, 4: 1.05, 5: 1.15,
        6: 1.50, 7: 1.75, 8: 1.70, 9: 1.45,
        10: 1.30, 11: 0.95, 12: 0.82,
    },
    "Bangalore": {
        # Two moderate peaks (SW Jun + NE Oct), high altitude keeps it mild
        1: 0.82, 2: 0.80, 3: 0.88, 4: 1.00, 5: 1.10,
        6: 1.25, 7: 1.20, 8: 1.15, 9: 1.10,
        10: 1.28, 11: 1.05, 12: 0.85,
    },
    "Delhi": {
        # Strong heat May, moderate monsoon Jul-Aug, AQI Nov-Jan
        1: 1.05, 2: 0.88, 3: 0.95, 4: 1.20, 5: 1.55,
        6: 1.30, 7: 1.40, 8: 1.35, 9: 1.15,
        10: 1.05, 11: 1.25, 12: 1.15,
    },
    "Hyderabad": {
        # Heat Apr-May, moderate SW monsoon Jun-Sep
        1: 0.80, 2: 0.78, 3: 0.88, 4: 1.10, 5: 1.25,
        6: 1.35, 7: 1.45, 8: 1.40, 9: 1.25,
        10: 0.95, 11: 0.82, 12: 0.78,
    },
    "Pune": {
        # Strong SW monsoon (Western Ghats), mild rest
        1: 0.72, 2: 0.70, 3: 0.78, 4: 0.92, 5: 1.05,
        6: 1.55, 7: 1.90, 8: 1.85, 9: 1.40,
        10: 0.88, 11: 0.74, 12: 0.70,
    },
    "Ahmedabad": {
        # Extreme heat Apr-Jun dominates; very little monsoon (arid)
        1: 0.80, 2: 0.78, 3: 0.95, 4: 1.35, 5: 1.70,
        6: 1.55, 7: 1.10, 8: 1.05, 9: 0.95,
        10: 0.85, 11: 0.80, 12: 0.78,
    },
    "Jaipur": {
        # Extreme heat Apr-Jun; desert — monsoon barely reaches (Thar)
        1: 0.78, 2: 0.75, 3: 0.92, 4: 1.30, 5: 1.65,
        6: 1.45, 7: 1.05, 8: 1.00, 9: 0.90,
        10: 0.82, 11: 0.78, 12: 0.76,
    },
    "Lucknow": {
        # Heat May-Jun, moderate monsoon, AQI Nov-Jan (IGP)
        1: 1.00, 2: 0.88, 3: 0.95, 4: 1.15, 5: 1.40,
        6: 1.30, 7: 1.35, 8: 1.30, 9: 1.15,
        10: 1.00, 11: 1.20, 12: 1.10,
    },
    "Indore": {
        # Moderate monsoon, moderate heat
        1: 0.82, 2: 0.80, 3: 0.90, 4: 1.05, 5: 1.20,
        6: 1.40, 7: 1.55, 8: 1.50, 9: 1.25,
        10: 0.95, 11: 0.84, 12: 0.80,
    },
    "Patna": {
        # Hot summers, moderate-high monsoon, some AQI Nov
        1: 0.92, 2: 0.85, 3: 0.95, 4: 1.10, 5: 1.35,
        6: 1.40, 7: 1.50, 8: 1.45, 9: 1.25,
        10: 1.00, 11: 1.15, 12: 1.05,
    },
    "Bhopal": {
        # Moderate monsoon Jun-Sep, moderate summer heat
        1: 0.82, 2: 0.80, 3: 0.90, 4: 1.08, 5: 1.22,
        6: 1.42, 7: 1.58, 8: 1.52, 9: 1.28,
        10: 0.97, 11: 0.85, 12: 0.80,
    },
}
# Fallback for cities not in the dict
_DEFAULT_SEASONAL_LR = {
    1: 0.88, 2: 0.85, 3: 0.95, 4: 1.08, 5: 1.15,
    6: 1.35, 7: 1.60, 8: 1.55, 9: 1.30,
    10: 1.00, 11: 0.92, 12: 0.88,
}

def _city_seasonal_lr(city: str, month: int) -> float:
    return CITY_SEASONAL_LR.get(city, _DEFAULT_SEASONAL_LR).get(month, 1.0)

# ── Scenario monthly stress multipliers (shape of event, city-agnostic) ────────
# These amplify the city's own seasonal pattern during the event months.
# Monsoon: Jun–Sep | Heat Wave: Apr–Jun | AQI: Oct–Dec
SCENARIO_MONTHLY_LR: dict[str, dict[int, float]] = {
    "normal":    {m: 1.0 for m in range(1, 13)},
    "monsoon":   {
        1: 1.0,  2: 1.0,  3: 1.0,  4: 1.05, 5: 1.10,
        6: 1.55, 7: 1.80, 8: 1.75, 9: 1.50,
        10: 1.10, 11: 1.0, 12: 1.0,
    },
    "heat_wave": {
        1: 1.0,  2: 1.0,  3: 1.10, 4: 1.50, 5: 1.70,
        6: 1.40, 7: 1.0,  8: 1.0,  9: 1.0,
        10: 1.0, 11: 1.0, 12: 1.0,
    },
    "aqi_crisis": {
        1: 1.20, 2: 1.0,  3: 1.0,  4: 1.0,  5: 1.0,
        6: 1.0,  7: 1.0,  8: 1.0,  9: 1.10,
        10: 1.50, 11: 1.75, 12: 1.55,
    },
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
    sc      = SCENARIOS[scenario]
    # City-specific seasonal LR — different curve shape per city
    s_lr    = _city_seasonal_lr(city, month)
    s_pm    = SEASONAL_PREM.get(month, 1.0)
    # Scenario stress multiplier for this month
    sc_lr_m = SCENARIO_MONTHLY_LR[scenario].get(month, 1.0)
    seed = _city_seed(city, path_idx * 1000 + week_num)
    z_lr,   seed = _gauss(seed)
    z_prem, _    = _gauss(seed)
    # Combined: city seasonal shape × scenario stress × noise
    lr   = base_lr * s_lr * sc_lr_m  + z_lr   * 0.07
    prem = base_prem * sc["prem_mult"] * s_pm * (1 + z_prem * 0.04)
    return max(0.05, min(lr, 2.0)), max(prem, 0.0)

@lru_cache(maxsize=256)
def _monte_carlo(base_lr, base_prem, n_weeks, scenario, city, proj_months: tuple):
    """proj_months: tuple of actual calendar months (1-12) for each projection week."""
    N = 500
    all_lr   = [[] for _ in range(n_weeks)]
    all_prem = [[] for _ in range(n_weeks)]
    for p in range(N):
        for w in range(n_weeks):
            month = proj_months[w]
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

    # Load all ledger rows newest-first, then take last 26 (= 6 months)
    # so history half == projection half == 26 weeks → equal chart split
    ledger_res = await db.execute(
        select(WeeklyLedger)
        .where(WeeklyLedger.city_id == city.id)
        .order_by(WeeklyLedger.week_start.desc())
        .limit(26)
    )
    ledgers = list(reversed(ledger_res.scalars().all()))  # back to oldest→newest
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

    # Baseline: use most recent 8 weeks as the "current season" baseline for projection
    recent = ledgers[-8:] if len(ledgers) >= 8 else ledgers
    avg_lr   = sum(l.loss_ratio        for l in recent) / len(recent)
    avg_prem = sum(l.premium_collected for l in recent) / len(recent)
    lr_trend = (ledgers[-1].loss_ratio - ledgers[0].loss_ratio) / max(len(ledgers) - 1, 1)

    sc = SCENARIOS[scenario]

    # No simulated history — real DB now covers the full year
    sim_history = []
    N_SIM = 0

    # ── Current week (live tick) ───────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    week_day = now.weekday()
    progress = (week_day * 86400 + now.hour * 3600 + now.minute * 60 + now.second) / (7 * 86400)
    progress = min(progress, 1.0)

    s_lr_now    = _city_seasonal_lr(city_name, now.month)
    s_prem_now  = SEASONAL_PREM.get(now.month, 1.0)
    sc_lr_m_now = SCENARIO_MONTHLY_LR[scenario].get(now.month, 1.0)
    seed        = _live_seed(city_name)
    z_lr,   seed = _gauss(seed)
    z_prem, _    = _gauss(seed)

    cur_lr   = avg_lr  * s_lr_now * sc_lr_m_now + z_lr * 0.06
    cur_lr   = max(0.05, min(cur_lr, 2.0))
    cur_prem = avg_prem * sc["prem_mult"] * s_prem_now * progress * (1 + z_prem * 0.04)

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
        "season_mult":     round(s_lr_now, 2),
        "shock_mult":      round(sc_lr_m_now, 2),
        "suspension_risk": cur_lr > 0.85,
    }

    # ── Monte Carlo projection (26 weeks = 6 months) ──────────────────────────
    N_PROJ = 26
    # Compute the actual calendar month for every projected week so the seasonal
    # multipliers in the MC align with the displayed dates (not +1 month/week drift).
    proj_months = tuple(
        (monday + timedelta(weeks=i + 1)).month for i in range(N_PROJ)
    )
    mc_results = _monte_carlo(round(avg_lr, 6), round(avg_prem, 2), N_PROJ, scenario, city_name, proj_months)
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
            "simulated_weeks":       0,
            "projection_weeks":      N_PROJ,
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

_weather_cache: dict = {}

@router.get("/weather")
async def get_weather(city: str = "Delhi"):
    """
    Proxy OpenWeatherMap so the API key never leaves the server.
    Frontend calls /api/data/weather?city=Delhi — key stays server-side.
    Returns: { main, description, temp_c, humidity } or a safe fallback.
    Cached for 5 minutes to avoid blocking the timeline load.
    """
    cache_key = city.lower()
    if cache_key in _weather_cache:
        cached_at, data = _weather_cache[cache_key]
        if time.time() - cached_at < 300:
            return data

    key = settings.OPENWEATHER_API_KEY
    if not key:
        return {"main": "NORMAL", "description": "API key not configured", "temp_c": 28, "humidity": 60}
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            r = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": f"{city},IN", "appid": key},
            )
            r.raise_for_status()
            d = r.json()
            result = {
                "main":        d["weather"][0]["main"],
                "description": d["weather"][0]["description"],
                "temp_c":      round(d["main"]["temp"] - 273.15, 1),
                "humidity":    d["main"]["humidity"],
            }
            _weather_cache[cache_key] = (time.time(), result)
            return result
    except Exception:
        fallback = {"main": "NORMAL", "description": "Weather service unavailable", "temp_c": 28, "humidity": 60}
        _weather_cache[cache_key] = (time.time(), fallback)
        return fallback
