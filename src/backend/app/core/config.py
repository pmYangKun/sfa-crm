"""Application settings loaded from environment variables."""

import os


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///data/sfa_crm.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")
    WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "webhook-secret-change-me")


settings = Settings()
