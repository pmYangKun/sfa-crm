from contextlib import asynccontextmanager

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api import auth, leads, customers, webhooks
from app.core.init_db import init_db
from app.services.rate_limiter import user_limiter
from app.services.release_service import run_auto_release

limiter = Limiter(key_func=get_remote_address)

_scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    # Schedule daily auto-release at 02:00
    _scheduler.add_job(run_auto_release, "cron", hour=2, minute=0, id="auto_release")
    _scheduler.start()

    yield

    _scheduler.shutdown(wait=False)


app = FastAPI(title="SFA CRM API", version="0.1.0", lifespan=lifespan)

# Register both limiters; SlowAPI only needs one in app.state for middleware,
# but both raise RateLimitExceeded which is caught by the handler below.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
user_limiter.app = app

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(leads.router, prefix="", tags=["leads"])
app.include_router(customers.router, prefix="", tags=["customers"])
app.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/admin/trigger-auto-release", tags=["admin"])
def trigger_auto_release():
    """Manual trigger for testing the auto-release job."""
    result = run_auto_release()
    return result
