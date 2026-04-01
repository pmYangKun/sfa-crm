"""Daily report API endpoints."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, func, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.org import User
from app.models.report import DailyReport
from app.services.audit_service import write_audit_log
from app.services.permission_service import get_visible_user_ids

router = APIRouter()


class ReportSubmitRequest(BaseModel):
    content: Optional[str] = None


class ReportResponse(BaseModel):
    id: str
    owner_id: str
    report_date: str
    content: str
    status: str
    submitted_at: Optional[str]
    created_at: str


class ReportListResponse(BaseModel):
    total: int
    items: list[ReportResponse]


@router.get("/reports/daily", response_model=ReportListResponse)
def list_my_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    stmt = select(DailyReport).where(DailyReport.owner_id == current_user.id)
    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = session.exec(
        stmt.order_by(DailyReport.report_date.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    ).all()
    return ReportListResponse(total=total, items=items)


@router.get("/reports/daily/today-draft", response_model=Optional[ReportResponse])
def get_today_draft(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    report = session.exec(
        select(DailyReport).where(
            DailyReport.owner_id == current_user.id,
            DailyReport.report_date == today,
        )
    ).first()
    return report


@router.post("/reports/daily/{report_id}/submit", response_model=ReportResponse)
def submit_report(
    report_id: str,
    body: ReportSubmitRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("report.submit")),
):
    report = session.get(DailyReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if report.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your report")
    if report.status == "submitted":
        raise HTTPException(status_code=400, detail="Already submitted")

    if body.content:
        report.content = body.content
    report.status = "submitted"
    report.submitted_at = datetime.now(timezone.utc).isoformat()
    session.add(report)

    write_audit_log(
        session, user_id=current_user.id, action="submit_daily_report",
        entity_type="daily_report", entity_id=report_id,
    )
    session.commit()
    return report


@router.get("/reports/team", response_model=ReportListResponse)
def list_team_reports(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("report.view_team")),
):
    stmt = select(DailyReport).where(DailyReport.status == "submitted")

    visible_ids = get_visible_user_ids(session, current_user)
    if visible_ids is not None:
        stmt = stmt.where(DailyReport.owner_id.in_(visible_ids))  # type: ignore

    total = session.exec(select(func.count()).select_from(stmt.subquery())).one()
    items = session.exec(
        stmt.order_by(DailyReport.report_date.desc()).offset((page - 1) * size).limit(size)  # type: ignore
    ).all()
    return ReportListResponse(total=total, items=items)
