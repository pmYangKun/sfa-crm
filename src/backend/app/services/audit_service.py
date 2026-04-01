"""Audit log service — write-only, append-only."""

import json
from typing import Optional

from sqlmodel import Session

from app.models.audit import AuditLog


def write_audit_log(
    session: Session,
    *,
    user_id: Optional[str],
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    payload: Optional[dict] = None,
    ip: Optional[str] = None,
) -> AuditLog:
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=json.dumps(payload, ensure_ascii=False) if payload else None,
        ip=ip,
    )
    session.add(log)
    return log
