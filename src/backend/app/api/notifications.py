"""Notification API endpoints."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, func, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.notification import Notification
from app.models.org import User

router = APIRouter()


@router.get("/notifications")
def list_notifications(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    """Get notifications for current user, newest first."""
    notifications = session.exec(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())  # type: ignore
        .limit(50)
    ).all()
    return [
        {
            "id": n.id,
            "type": n.type,
            "title": n.title,
            "content": n.content,
            "is_read": n.is_read,
            "created_at": n.created_at,
        }
        for n in notifications
    ]


@router.get("/notifications/unread-count")
def unread_count(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    count = session.exec(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    ).one()
    return {"count": count}


@router.patch("/notifications/{notification_id}/read")
def mark_read(
    notification_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    n = session.get(Notification, notification_id)
    if not n or n.user_id != current_user.id:
        return {"success": False}
    n.is_read = True
    session.add(n)
    session.commit()
    return {"success": True}


@router.patch("/notifications/read-all")
def mark_all_read(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    unread = session.exec(
        select(Notification).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,  # noqa: E712
        )
    ).all()
    for n in unread:
        n.is_read = True
        session.add(n)
    session.commit()
    return {"success": True, "count": len(unread)}
