"""
Audit log API (T089).

GET /audit-logs     — paginated list, filterable by entity_type, entity_id, user_id
"""
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.audit import AuditLog
from app.models.org import User

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]


class AuditLogResponse(BaseModel):
    id: str
    user_id: Optional[str]
    user_name: Optional[str]
    action: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    payload: Optional[str]
    ip: Optional[str]
    created_at: str


@router.get("/audit-logs", response_model=list[AuditLogResponse])
def list_audit_logs(
    session: SessionDep,
    _: Annotated[None, Depends(require_permission("admin:audit"))],
    entity_type: Optional[str] = Query(None),
    entity_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = select(AuditLog)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditLog.entity_id == entity_id)
    if user_id:
        stmt = stmt.where(AuditLog.user_id == user_id)
    stmt = stmt.order_by(AuditLog.created_at.desc()).offset(offset).limit(limit)  # type: ignore[attr-defined]

    logs = session.exec(stmt).all()

    result = []
    for log in logs:
        user_name = None
        if log.user_id:
            u = session.get(User, log.user_id)
            user_name = u.name if u else None
        result.append(AuditLogResponse(
            id=log.id, user_id=log.user_id, user_name=user_name,
            action=log.action, entity_type=log.entity_type, entity_id=log.entity_id,
            payload=log.payload, ip=log.ip, created_at=log.created_at,
        ))
    return result
