"""
Customer-side business logic.

Includes the 14-day conversion window reminder job (US8):
- Day 7:  "大课转化窗口还剩 7 天，请抓紧跟进"
- Day 12: "大课转化窗口还剩 2 天，即将关闭"
- Day 14: "大课转化窗口已关闭"

The window is measured from customer.created_at (i.e., the lead conversion date).
No Customer fields are modified; only Notification records are written.
"""
import uuid
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models.customer import Customer
from app.models.notification import Notification


# Days at which reminders fire (measured from customer.created_at)
_REMINDER_SCHEDULE = {
    7: ("大课转化窗口提醒", "大课转化窗口还剩 7 天，请抓紧跟进。"),
    12: ("大课转化窗口紧急提醒", "大课转化窗口还剩 2 天，即将关闭！"),
    14: ("大课转化窗口已关闭", "大课转化窗口（14天）已关闭，本轮转化机会结束。"),
}

_WINDOW_DAYS = 14


def run_conversion_window_reminders() -> dict:
    """Entry point called by APScheduler."""
    with Session(engine) as session:
        sent = _check_and_notify(session)
    return {"reminders_sent": sent, "ran_at": datetime.utcnow().isoformat()}


def get_conversion_window_status(customer: Customer) -> dict:
    """
    Derive the conversion window status for a single customer.
    Returns a dict with: active, days_elapsed, days_remaining.
    """
    now = datetime.utcnow()
    days_elapsed = (now - customer.created_at).days
    days_remaining = max(0, _WINDOW_DAYS - days_elapsed)
    return {
        "active": days_elapsed <= _WINDOW_DAYS,
        "days_elapsed": days_elapsed,
        "days_remaining": days_remaining,
        "window_days": _WINDOW_DAYS,
    }


# ── Internal ──────────────────────────────────────────────────────────────────

def _check_and_notify(session: Session) -> int:
    now = datetime.utcnow()
    sent = 0

    customers = session.exec(select(Customer)).all()
    for customer in customers:
        days_elapsed = (now - customer.created_at).days
        reminder = _REMINDER_SCHEDULE.get(days_elapsed)
        if not reminder:
            continue

        # Idempotency: don't send the same reminder twice on the same day
        if _already_notified(session, customer.id, days_elapsed):
            continue

        title, body = reminder
        session.add(Notification(
            id=str(uuid.uuid4()),
            user_id=customer.owner_id,
            type=f"conversion_window_d{days_elapsed}",
            title=title,
            body=f"「{customer.company_name}」{body}",
            entity_type="customer",
            entity_id=customer.id,
        ))
        sent += 1

    session.commit()
    return sent


def _already_notified(session: Session, customer_id: str, day: int) -> bool:
    return bool(session.exec(
        select(Notification).where(
            Notification.entity_id == customer_id,
            Notification.type == f"conversion_window_d{day}",
        )
    ).first())
