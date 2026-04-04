"""
FlowSecure — AI-Powered Parametric Income Protection for Gig Workers
Main FastAPI Application
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.routes import auth, riders, policies, claims, triggers, pricing, admin, fraud, payouts, underwriting, payments, data
from app.core.config import settings
from app.core.database import engine, Base
from app.services.triggers.trigger_engine import TriggerEngine


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup: Initialize trigger monitoring engine
    trigger_engine = TriggerEngine()
    trigger_engine.start()
    print("🛡️  FlowSecure Trigger Engine started — monitoring 6 parametric triggers")
    yield
    # Shutdown
    trigger_engine.stop()
    print("🛡️  FlowSecure Trigger Engine stopped")


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

# CORS — allow all origins for hackathon demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
