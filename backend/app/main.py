"""
FlowSecure — AI-Powered Parametric Income Protection for Gig Workers
Main FastAPI Application
"""

import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routes import auth, riders, policies, claims, triggers, pricing, admin, fraud, payouts, underwriting, payments, data
from app.core.config import settings
from app.core.database import engine, Base
from app.services.ml_models import ml
from app.services.triggers.trigger_engine import TriggerEngine


async def _warmup_db():
    """
    One-time startup maintenance:
    1. Nullify gps_points on old rows (major source of table bloat — 2KB inline JSON per row).
    2. Create a covering index so the dashboard query never touches the heap.
    3. ANALYZE to refresh planner statistics.
    """
    import asyncpg, ssl
    from app.core.config import settings

    db_url = settings.DATABASE_URL
    if not db_url.startswith("postgresql"):
        return  # SQLite — nothing to do

    # Parse connection params from the SQLAlchemy URL
    from sqlalchemy.engine import make_url as _make_url
    u = _make_url(db_url)

    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    try:
        conn = await asyncpg.connect(
            host=u.host, port=u.port or 5432,
            user=u.username, password=u.password,
            database=u.database,
            ssl=ssl_ctx,
            statement_cache_size=0,
            server_settings={"statement_timeout": "0"},
        )
    except Exception as e:
        print(f"⚠️  DB warmup skipped (can't connect): {e}")
        return

    try:
        # 1. Drop any INVALID index (CREATE INDEX CONCURRENTLY can leave behind an invalid shell).
        #    An invalid index is worse than no index — it wastes space and confuses the planner.
        invalid = await conn.fetch("""
            SELECT indexrelid::regclass::text AS idx
            FROM pg_index
            WHERE indrelid = 'rider_activities'::regclass
              AND NOT indisvalid
        """)
        for row in invalid:
            await conn.execute(f"DROP INDEX IF EXISTS {row['idx']}")
            print(f"✅ Dropped invalid index {row['idx']}")

        # 2. Covering index — enables index-only scans that never touch the bloated heap.
        #    IF NOT EXISTS is safe to re-run on every startup.
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS ix_rider_activities_cover
            ON rider_activities (rider_id, date)
            INCLUDE (deliveries_completed, hours_active, earnings)
        """)
        print("✅ Covering index ready (ix_rider_activities_cover)")

        # 3. Nullify old gps_points — removes ~2KB inline JSON per row from historical records.
        #    GPS data is only needed for fraud detection on recent claims (last 7 days).
        #    This reduces heap bloat so seq scans get faster over time.
        await conn.execute("""
            UPDATE rider_activities
            SET gps_points = NULL
            WHERE gps_points IS NOT NULL
              AND date < NOW() - INTERVAL '7 days'
        """)
        print("✅ Cleared GPS data from old activity rows")

        # 4. ANALYZE to refresh planner statistics after index creation + update
        await conn.execute("ANALYZE rider_activities")
        print("✅ ANALYZE done")
    except Exception as e:
        print(f"⚠️  DB warmup error: {e}")
    finally:
        await conn.close()


async def _topup_demo_riders():
    """
    Keep the 3 demo riders' activity fresh on every cold start so the 7-day
    earnings chart never shows "day off" when real time has drifted past the
    seed date. Safe to re-run — topup_demo_activity only fills missing days.
    """
    try:
        from app.mock_data.topup_demo_activity import topup
        await topup([1, 2, 3])
        print("✅ Demo riders topped up (activity current)")
    except Exception as e:
        print(f"⚠️  Demo topup skipped: {e}")


async def _init_ml_background():
    """Train ML models in background — server accepts requests immediately.
    5-second delay lets the pool warm up before we run DB queries for training.
    """
    await asyncio.sleep(5)
    asyncio.create_task(_warmup_db())
    asyncio.create_task(_topup_demo_riders())
    try:
        await ml.async_initialize()
        print("✅ ML models initialized")
    except Exception as e:
        print(f"⚠️  ML initialization skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Fire ML init in background — don't block startup
    asyncio.create_task(_init_ml_background())

    # Startup: Initialize trigger monitoring engine
    trigger_engine = None
    try:
        trigger_engine = TriggerEngine()
        trigger_engine.start()
        print("🛡️  FlowSecure Trigger Engine started — monitoring 6 parametric triggers")
    except Exception as e:
        print(f"⚠️  Trigger Engine skipped: {e}")

    yield

    # Shutdown
    if trigger_engine:
        try:
            trigger_engine.stop()
        except Exception:
            pass
    print("🛡️  FlowSecure shutdown complete")


app = FastAPI(
    title="FlowSecure API",
    description=(
        "AI-Powered Parametric Income Protection Platform for Gig Delivery Workers. "
        "Predicts disruptions, optimizes rider earnings, and provides automatic "
        "insurance payouts when optimization isn't enough."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow all origins for hackathon demo.
# allow_credentials must be False when origins is "*" (CORS spec). The frontend
# authenticates with Bearer tokens in the Authorization header, not cookies, so
# credentials mode is not required.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ──
app.include_router(underwriting.router, prefix="/api/underwriting", tags=["Underwriting"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(riders.router, prefix="/api/riders", tags=["Riders"])
app.include_router(policies.router, prefix="/api/policies", tags=["Policies"])
app.include_router(claims.router, prefix="/api/claims", tags=["Claims"])
app.include_router(triggers.router, prefix="/api/triggers", tags=["Triggers"])
app.include_router(pricing.router, prefix="/api/pricing", tags=["Pricing"])
app.include_router(fraud.router, prefix="/api/fraud", tags=["Fraud Detection"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin Dashboard"])
app.include_router(payouts.router, prefix="/api/payouts", tags=["Payouts"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments — Razorpay"])
app.include_router(data.router,     prefix="/api/data",     tags=["Data Timeline"])


@app.get("/", tags=["Health"])
async def root():
    return {
        "name": "FlowSecure API",
        "status": "running",
        "version": "1.0.0",
        "description": "AI-Powered Parametric Income Protection",
        "layers": {
            "predict": "7-day disruption forecast per zone",
            "optimize": "AI shift recommendations for riders",
            "protect": "Automatic parametric insurance payouts",
        },
    }


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "triggers_monitored": 6}
