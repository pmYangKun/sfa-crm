"""System config API endpoints."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.config import SystemConfig
from app.models.org import User

router = APIRouter()


class ConfigUpdate(BaseModel):
    items: dict[str, str]


@router.get("/config")
def get_config(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("config.manage")),
):
    configs = session.exec(select(SystemConfig)).all()
    return configs


@router.patch("/config")
def update_config(
    body: ConfigUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("config.manage")),
):
    for key, value in body.items.items():
        cfg = session.get(SystemConfig, key)
        if cfg:
            cfg.value = value
            cfg.updated_at = datetime.now(timezone.utc).isoformat()
            session.add(cfg)
        else:
            session.add(SystemConfig(key=key, value=value))
    session.commit()
    return {"status": "updated"}
