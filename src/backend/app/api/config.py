"""
System configuration API (T088).

GET  /config        — list all config entries (admin)
PATCH /config       — batch update config values
"""
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.config import SystemConfig

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


class ConfigResponse(BaseModel):
    key: str
    value: str
    description: str | None
    updated_at: str


class ConfigUpdate(BaseModel):
    updates: dict[str, str]  # {key: new_value}


@router.get("/config", response_model=list[ConfigResponse])
def get_config(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    return session.exec(select(SystemConfig)).all()


@router.patch("/config", response_model=list[ConfigResponse])
def update_config(
    body: ConfigUpdate,
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:config"))],
):
    for key, value in body.updates.items():
        record = session.get(SystemConfig, key)
        if record:
            record.value = value
            record.updated_at = datetime.utcnow().isoformat()
            session.add(record)
    session.commit()
    return session.exec(select(SystemConfig)).all()
