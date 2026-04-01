"""FastAPI main application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.services.rate_limiter import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup — register scheduled jobs
    from apscheduler.schedulers.background import BackgroundScheduler
    from app.services.release_service import run_auto_release

    scheduler = BackgroundScheduler()
    scheduler.add_job(run_auto_release, "cron", hour=2, minute=0, id="auto_release")
    scheduler.start()
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
from app.api.webhooks import router as webhooks_router  # noqa: E402

app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(leads_router, prefix="/api/v1", tags=["leads"])
app.include_router(customers_router, prefix="/api/v1", tags=["customers"])
app.include_router(webhooks_router, prefix="/api/v1", tags=["webhooks"])


@app.get("/")
def root():
    return {"status": "ok", "service": "SFA CRM API"}
