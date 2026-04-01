"""
Notifications API (T107 support).

GET  /notifications              — list my notifications (paginated)
PATCH /notifications/{id}        — mark as read
POST /notifications/mark-all-read — mark all as read
"""
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.notification import Notification
from app.models.org import User

router = APIRouter()
SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


class NotificationResponse(BaseModel):
    id: str
    type: str
    title: str
    body: Optional[str]
    is_read: bool
    entity_type: Optional[str]
    entity_id: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationUpdate(BaseModel):
    is_read: bool


@router.get("/notifications", response_model=list[NotificationResponse])
def list_notifications(
    session: SessionDep,
    actor: CurrentUser,
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
):
    stmt = select(Notification).where(Notification.user_id == actor.id)
    if unread_only:
        stmt = stmt.where(Notification.is_read == False)  # noqa: E712
    stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)  # type: ignore[attr-defined]
    return session.exec(stmt).all()


@router.patch("/notifications/{notif_id}", response_model=NotificationResponse)
def update_notification(
    notif_id: str,
    body: NotificationUpdate,
    session: SessionDep,
    actor: CurrentUser,
):
    notif = session.get(Notification, notif_id)
    if not notif or notif.user_id != actor.id:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="通知不存在")
    notif.is_read = body.is_read
    session.add(notif)
    session.commit()
    session.refresh(notif)
    return notif


@router.post("/notifications/mark-all-read", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(
    session: SessionDep,
    actor: CurrentUser,
):
    unread = session.exec(
        select(Notification).where(
            Notification.user_id == actor.id,
            Notification.is_read == False,  # noqa: E712
        )
    ).all()
    for n in unread:
        n.is_read = True
        session.add(n)
    session.commit()
