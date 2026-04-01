"""Daily report generation service."""

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.core.database import engine
from app.models.followup import FollowUp
from app.models.org import User
from app.models.report import DailyReport


def generate_daily_reports():
    """Generate draft daily reports for all active sales users based on today's follow-ups."""
    with Session(engine) as session:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        # Get all active users
        users = session.exec(select(User).where(User.is_active == True)).all()  # noqa: E712
        generated = 0

        for user in users:
            # Check if report already exists
            existing = session.exec(
                select(DailyReport).where(
                    DailyReport.owner_id == user.id,
                    DailyReport.report_date == today,
                )
            ).first()
            if existing:
                continue

            # Get today's follow-ups
            followups = session.exec(
                select(FollowUp).where(
                    FollowUp.owner_id == user.id,
                    FollowUp.followed_at.startswith(today),  # type: ignore
                )
            ).all()

            if not followups:
                continue

            # Generate content
            lines = [f"## {today} 日报\n"]
            for fu in followups:
                fu_type = {"phone": "电话", "wechat": "微信", "visit": "拜访"}.get(fu.type, "其他")
                lines.append(f"- [{fu_type}] {fu.content}")

            content = "\n".join(lines)

            report = DailyReport(
                owner_id=user.id,
                report_date=today,
                content=content,
            )
            session.add(report)
            generated += 1

        session.commit()
        return generated
