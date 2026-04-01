"""Audit log API endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.audit import AuditLog
from app.models.org import User

router = APIRouter()


class AuditListResponse(BaseModel):
    total: int
    items: list[dict]


@router.get("/audit-logs", response_model=AuditListResponse)
def list_audit_logs(
    entity_type: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("config.manage")),
):
    stmt = select(AuditLog)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)

    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = session.exec(
        stmt.order_by(AuditLog.created_at.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    ).all()

    return AuditListResponse(
        total=total,
        items=[
            {
                "id": log.id, "user_id": log.user_id, "action": log.action,
                "entity_type": log.entity_type, "entity_id": log.entity_id,
                "payload": log.payload, "ip": log.ip, "created_at": log.created_at,
            }
            for log in items
        ],
    )
