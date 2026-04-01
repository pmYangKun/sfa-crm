"""
Daily report generation and management.

run_generate_daily_reports():
  APScheduler entry point. Runs daily at the time configured in SystemConfig
  (daily_report_generate_at, default 18:00). For each active user, collects
  today's FollowUp records and generates a draft DailyReport. Skips users
  who already have a report for today (idempotent).
"""
import uuid
from datetime import datetime, date, timedelta

from sqlmodel import Session, select

from app.core.database import engine
from app.models.config import SystemConfig
from app.models.followup import FollowUp
from app.models.org import User
from app.models.report import DailyReport


_FOLLOWUP_TYPE_LABEL = {
    "phone": "电话",
    "wechat": "微信",
    "visit": "拜访",
    "other": "其他",
}


def run_generate_daily_reports() -> dict:
    """Entry point called by APScheduler."""
    with Session(engine) as session:
        today = date.today().isoformat()
        generated = _generate_for_date(session, today)
    return {"generated": generated, "date": today, "ran_at": datetime.utcnow().isoformat()}


def _generate_for_date(session: Session, report_date: str) -> int:
    """Generate draft daily reports for all active users for the given date."""
    day_start = datetime.fromisoformat(f"{report_date}T00:00:00")
    day_end = datetime.fromisoformat(f"{report_date}T23:59:59")

    active_users = session.exec(select(User).where(User.is_active == True)).all()  # noqa: E712
    generated = 0

    for user in active_users:
        # Idempotency: skip if report already exists
        existing = session.exec(
            select(DailyReport).where(
                DailyReport.owner_id == user.id,
                DailyReport.report_date == report_date,
            )
        ).first()
        if existing:
            continue

        followups = session.exec(
            select(FollowUp).where(
                FollowUp.owner_id == user.id,
                FollowUp.followed_at >= day_start,
                FollowUp.followed_at <= day_end,
            ).order_by(FollowUp.followed_at)  # type: ignore[attr-defined]
        ).all()

        if not followups:
            continue  # No activity → no report generated

        content = _format_report_content(followups, report_date)
        session.add(DailyReport(
            id=str(uuid.uuid4()),
            owner_id=user.id,
            report_date=report_date,
            content=content,
        ))
        generated += 1

    session.commit()
    return generated


def _format_report_content(followups: list[FollowUp], report_date: str) -> str:
    lines = [f"【{report_date} 日报草稿】", f"本日跟进客户 {len(followups)} 次：", ""]
    for i, fu in enumerate(followups, 1):
        t = _FOLLOWUP_TYPE_LABEL.get(fu.type, fu.type)
        entity = f"线索" if fu.lead_id else "客户"
        entity_id = fu.lead_id or fu.customer_id or ""
        time_str = fu.followed_at.strftime("%H:%M")
        lines.append(f"{i}. [{time_str}] {t} | {entity} {entity_id[:8]}…")
        lines.append(f"   {fu.content}")
        lines.append("")
    return "\n".join(lines)


def submit_daily_report(session: Session, actor_id: str, report_id: str) -> DailyReport:
    """Mark a draft report as submitted."""
    report = session.get(DailyReport, report_id)
    if not report:
        raise ValueError(f"日报 {report_id} 不存在")
    if report.owner_id != actor_id:
        raise ValueError("只能提交自己的日报")
    if report.status == "submitted":
        raise ValueError("日报已提交，不可重复提交")

    report.status = "submitted"
    report.submitted_at = datetime.utcnow()
    session.add(report)
    session.commit()
    session.refresh(report)
    return report
