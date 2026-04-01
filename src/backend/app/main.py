"""FastAPI main application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="SFA CRM API",
    version="0.1.0",
    lifespan=lifespan,
)

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

app.include_router(auth_router, prefix="/api/v1", tags=["auth"])
app.include_router(leads_router, prefix="/api/v1", tags=["leads"])


@app.get("/")
def root():
    return {"status": "ok", "service": "SFA CRM API"}
