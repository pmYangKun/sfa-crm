"""Customer service — conversion window detection."""

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.database import engine
from app.models.customer import Customer
from app.models.notification import Notification


def run_conversion_window_check():
    """Daily job: send reminders at day 7, 12 of conversion window; close at day 14."""
    with Session(engine) as session:
        customers = session.exec(select(Customer)).all()
        now = datetime.now(timezone.utc)
        sent = 0

        for customer in customers:
            created = datetime.fromisoformat(customer.created_at)
            days_elapsed = (now - created).days

            if days_elapsed in (7, 12):
                remaining = 14 - days_elapsed
                session.add(Notification(
                    user_id=customer.owner_id,
                    type="conversion_window",
                    title="转化窗口提醒",
                    content=f"客户「{customer.company_name}」转化窗口剩余 {remaining} 天，请及时跟进",
                ))
                sent += 1
            elif days_elapsed == 14:
                session.add(Notification(
                    user_id=customer.owner_id,
                    type="conversion_window",
                    title="转化窗口已关闭",
                    content=f"客户「{customer.company_name}」14天转化窗口已关闭",
                ))
                sent += 1

        session.commit()
        return sent
