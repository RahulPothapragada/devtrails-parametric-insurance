"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "GigShield"
    ENV: str = "development"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/gigshield"
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # External APIs
    OPENWEATHER_API_KEY: Optional[str] = None
    WAQI_API_KEY: Optional[str] = None
    NEWSAPI_KEY: Optional[str] = None
    TOMTOM_API_KEY: Optional[str] = None

    # Razorpay (Test Mode)
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None

    # Trigger Engine
    TRIGGER_POLL_INTERVAL_MINUTES: int = 30
    FRAUD_SCORE_UPDATE_INTERVAL_HOURS: int = 24

    class Config:
        env_file = ".env"


settings = Settings()
