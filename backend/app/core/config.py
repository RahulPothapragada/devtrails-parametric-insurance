"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "FlowSecure"
    ENV: str = "development"
    DEBUG: bool = True

    # Database — defaults to SQLite so the app runs with zero config
    DATABASE_URL: str = "sqlite+aiosqlite:///./flowsecure.db"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # External APIs
    OPENWEATHER_API_KEY: Optional[str] = None
    WAQI_API_KEY: Optional[str] = None
    NEWSAPI_KEY: Optional[str] = None
    TOMTOM_API_KEY: Optional[str] = None
    GOOGLE_MAPS_API_KEY: Optional[str] = None

    # Razorpay (Test Mode)
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None

    # Trigger Engine
    TRIGGER_POLL_INTERVAL_MINUTES: int = 30
    FRAUD_SCORE_UPDATE_INTERVAL_HOURS: int = 24

    class Config:
        env_file = ".env"


settings = Settings()
