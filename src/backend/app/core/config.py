"""Application settings loaded from environment variables."""

import os
import sys


class Settings:
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///data/sfa_crm.db")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me-in-production")
    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:3000"
    ).split(",")
    WEBHOOK_SECRET: str = os.getenv("WEBHOOK_SECRET", "webhook-secret-change-me")
    ENV: str = os.getenv("ENV", "dev").lower()


settings = Settings()


def _assert_production_secrets() -> None:
    """生产环境密钥强校验（spec 002 FR-025 / contracts/config-contracts.md § 5）.

    ENV=production 时 fail-fast 拒绝以下错误配置：
    - JWT_SECRET 未改占位符 'change-me-in-production'
    - LLM_KEY_FERNET_KEY 未配置
    - CORS_ORIGINS 含通配符 '*'

    Dev 环境跳过校验。
    """
    if settings.ENV != "production":
        return

    errors: list[str] = []

    if (
        not settings.JWT_SECRET
        or settings.JWT_SECRET == "change-me-in-production"
        or len(settings.JWT_SECRET) < 32
    ):
        errors.append(
            "JWT_SECRET 必须在生产环境设置真实值（≥ 32 字符随机串）"
        )

    if not os.environ.get("LLM_KEY_FERNET_KEY", "").strip():
        errors.append(
            "LLM_KEY_FERNET_KEY 必须在生产环境配置（用 Fernet.generate_key() 生成）"
        )

    cors_raw = os.getenv("CORS_ORIGINS", "")
    if not cors_raw or "*" in cors_raw:
        errors.append(
            "CORS_ORIGINS 必须在生产环境配置具体域名（不能用 *）"
        )

    if errors:
        msg = "❌ 生产环境密钥校验失败：\n  - " + "\n  - ".join(errors)
        msg += "\n\n请检查 .env.production，参考仓库根目录 .env.production.example"
        print(msg, file=sys.stderr)
        raise SystemExit(1)
