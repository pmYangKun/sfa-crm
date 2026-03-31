import json
from typing import Any, Optional

from sqlmodel import Session

from app.models.audit import AuditLog


def log_action(
    session: Session,
    action: str,
    user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    payload: Optional[dict[str, Any]] = None,
    ip: Optional[str] = None,
):
    entry = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=json.dumps(payload, ensure_ascii=False) if payload else None,
        ip=ip,
    )
    session.add(entry)
