"""
Daily report API endpoints.

POST /reports/daily/{id}/submit        — submit a draft report
GET  /reports/daily                    — list my reports (paginated)
GET  /reports/daily/today-draft        — get today's draft (or 404)
GET  /reports/team                     — manager view: team reports for a date
"""
from datetime import date as date_type
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import get_current_user, require_permission
from app.models.org import User
from app.models.report import DailyReport
from app.services.permission_service import get_visible_user_ids
from app.services.report_service import submit_daily_report

router = APIRouter()

SessionDep = Annotated[Session, Depends(get_session)]
CurrentUser = Annotated[User, Depends(get_current_user)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ReportResponse(BaseModel):
    id: str
    owner_id: str
    report_date: str
    content: str
    status: str
    submitted_at: Optional[str]
    created_at: str

    model_config = {"from_attributes": False}


class ReportUpdateContent(BaseModel):
    content: str


# ── POST /reports/daily/{id}/submit ──────────────────────────────────────────

@router.post("/reports/daily/{report_id}/submit", response_model=ReportResponse)
def submit_report(
    report_id: str,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("report:submit"))],
):
    try:
        r = submit_daily_report(session, current_user.id, report_id)
        return _to_response(r)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── PATCH /reports/daily/{id} — edit draft content ───────────────────────────

@router.patch("/reports/daily/{report_id}", response_model=ReportResponse)
def update_report_content(
    report_id: str,
    body: ReportUpdateContent,
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("report:submit"))],
):
    report = session.get(DailyReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="日报不存在")
    if report.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="只能编辑自己的日报")
    if report.status == "submitted":
        raise HTTPException(status_code=400, detail="已提交的日报不可修改")

    report.content = body.content
    session.add(report)
    session.commit()
    session.refresh(report)
    return _to_response(report)


# ── GET /reports/daily ────────────────────────────────────────────────────────

@router.get("/reports/daily", response_model=list[ReportResponse])
def list_my_reports(
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("report:submit"))],
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=60),
):
    reports = session.exec(
        select(DailyReport)
        .where(DailyReport.owner_id == current_user.id)
        .order_by(DailyReport.report_date.desc())  # type: ignore[attr-defined]
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [_to_response(r) for r in reports]


# ── GET /reports/daily/today-draft ───────────────────────────────────────────

@router.get("/reports/daily/today-draft", response_model=ReportResponse)
def get_today_draft(
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("report:submit"))],
):
    today = date_type.today().isoformat()
    report = session.exec(
        select(DailyReport).where(
            DailyReport.owner_id == current_user.id,
            DailyReport.report_date == today,
        )
    ).first()
    if not report:
        raise HTTPException(status_code=404, detail="今日暂无日报草稿")
    return _to_response(report)


# ── GET /reports/team ─────────────────────────────────────────────────────────

@router.get("/reports/team", response_model=list[ReportResponse])
def list_team_reports(
    session: SessionDep,
    current_user: CurrentUser,
    _: Annotated[None, Depends(require_permission("report:view_team"))],
    report_date: Optional[str] = Query(None, description="YYYY-MM-DD，不填则今日"),
):
    target_date = report_date or date_type.today().isoformat()
    visible_ids = get_visible_user_ids(session, current_user)

    reports = session.exec(
        select(DailyReport).where(
            DailyReport.owner_id.in_(visible_ids),  # type: ignore[attr-defined]
            DailyReport.report_date == target_date,
        ).order_by(DailyReport.owner_id)  # type: ignore[attr-defined]
    ).all()
    return [_to_response(r) for r in reports]


# ── Helper ────────────────────────────────────────────────────────────────────

def _to_response(r: DailyReport) -> ReportResponse:
    return ReportResponse(
        id=r.id,
        owner_id=r.owner_id,
        report_date=r.report_date,
        content=r.content,
        status=r.status,
        submitted_at=r.submitted_at.isoformat() if r.submitted_at else None,
        created_at=r.created_at.isoformat(),
    )
