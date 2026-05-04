"""FastAPI main application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.services.rate_limiter import limiter


def _run_demo_reset():
    """Scheduler wrapper：开 session + 调 reset_business_data + 异常 fallback."""
    import logging
    from sqlmodel import Session

    from app.core.database import engine
    from app.services.demo_reset_service import reset_business_data

    log = logging.getLogger("demo_reset_job")
    try:
        with Session(engine) as s:
            reset_business_data(s)
    except Exception:
        log.exception("demo_reset job 执行失败（不影响其他 scheduler）")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup gate: 生产密钥强校验（spec 002 T011 / FR-025）─────────────
    from app.core.config import _assert_production_secrets
    _assert_production_secrets()

    # Startup — register scheduled jobs
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.services.release_service import run_auto_release
    from app.services.customer_service import run_conversion_window_check
    from app.services.report_service import generate_daily_reports

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_auto_release, "cron", hour=2, minute=0, id="auto_release")
    scheduler.add_job(run_conversion_window_check, "cron", hour=8, minute=0, id="conversion_window_check")
    scheduler.add_job(generate_daily_reports, "cron", hour=18, minute=0, id="daily_report_gen")
    # spec 002 T025: 半小时业务数据自动重置
    scheduler.add_job(
        _run_demo_reset, "interval", minutes=30, id="demo_reset", replace_existing=True
    )
    scheduler.start()

    # spec 002: startup 时立即跑一次确保干净起步（如果 demo_reset_enabled=true）
    _run_demo_reset()

    app.state.scheduler = scheduler

    yield

    # Shutdown
    scheduler.shutdown(wait=False)


app = FastAPI(
    title="SFA CRM API",
    version="0.1.0",
    lifespan=lifespan,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"code": "INTERNAL_ERROR", "message": str(exc)},
    )


# ── Register routers ─────────────────────────────────────────────────────────
from app.api.auth import router as auth_router  # noqa: E402
from app.api.leads import router as leads_router  # noqa: E402
from app.api.customers import router as customers_router  # noqa: E402
from app.api.followups import router as followups_router  # noqa: E402
from app.api.key_events import router as key_events_router  # noqa: E402
from app.api.contacts import router as contacts_router  # noqa: E402
from app.api.reports import router as reports_router  # noqa: E402
from app.api.org import router as org_router  # noqa: E402
from app.api.users import router as users_router  # noqa: E402
from app.api.roles import router as roles_router  # noqa: E402
from app.api.config import router as config_router  # noqa: E402
from app.api.audit import router as audit_router  # noqa: E402
from app.api.webhooks import router as webhooks_router  # noqa: E402
from app.api.dashboard import router as dashboard_router  # noqa: E402
from app.api.notifications import router as notifications_router  # noqa: E402
from app.api.agent import router as agent_router  # noqa: E402

app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(leads_router, prefix="/api/v1", tags=["leads"])
app.include_router(customers_router, prefix="/api/v1", tags=["customers"])
app.include_router(followups_router, prefix="/api/v1", tags=["followups"])
app.include_router(key_events_router, prefix="/api/v1", tags=["key_events"])
app.include_router(contacts_router, prefix="/api/v1", tags=["contacts"])
app.include_router(reports_router, prefix="/api/v1", tags=["reports"])
app.include_router(org_router, prefix="/api/v1", tags=["org"])
app.include_router(users_router, prefix="/api/v1", tags=["users"])
app.include_router(roles_router, prefix="/api/v1", tags=["roles"])
app.include_router(config_router, prefix="/api/v1", tags=["config"])
app.include_router(audit_router, prefix="/api/v1", tags=["audit"])
app.include_router(webhooks_router, prefix="/api/v1", tags=["webhooks"])
app.include_router(dashboard_router, prefix="/api/v1", tags=["dashboard"])
app.include_router(notifications_router, prefix="/api/v1", tags=["notifications"])
app.include_router(agent_router, prefix="/api/v1", tags=["agent"])


@app.get("/")
def root():
    return {"status": "ok", "service": "SFA CRM API"}
