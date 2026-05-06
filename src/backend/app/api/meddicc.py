"""MEDDICC API endpoints — 仪表盘 / 分析 / 删除证据（spec 003 T018）."""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.deps import require_permission
from app.models.lead import Lead
from app.models.lead_meddicc_evidence import DIMENSIONS, LeadMeddiccEvidence
from app.models.org import User
from app.services.meddicc_extractor import analyze
from app.services.rate_limiter import limiter
from app.services.score_calculator import recompute

router = APIRouter()


# ── Response schemas ──────────────────────────────────────────────


class EvidenceOut(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    lead_id: str
    dimension: str
    source_type: str
    source_id: str
    evidence_text: str
    confidence: float
    created_at: str


class DimensionStatus(BaseModel):
    dimension: str
    is_lit: bool
    count: int
    evidences: list[EvidenceOut]


class DashboardData(BaseModel):
    lead_id: str
    meddicc_score: Optional[float]
    meddicc_completion: int
    last_analyzed_at: Optional[str]
    dimensions: list[DimensionStatus]


class AnalyzeResponse(BaseModel):
    analyzed_at: str
    evidence_count: int
    skipped_count: int
    dashboard: DashboardData
    message: Optional[str] = None


class DeleteResponse(BaseModel):
    deleted: bool
    lead_id: str
    dashboard: DashboardData


# ── Helper ─────────────────────────────────────────────────────────


def _build_dashboard(lead_id: str, db: Session) -> DashboardData:
    """按 7 维度聚合 evidence 构造 DashboardData（即使没证据也返回 7 维度占位）。"""
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="线索不存在")

    evidences = db.exec(
        select(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead_id)
    ).all()

    by_dim: dict[str, list[LeadMeddiccEvidence]] = {d: [] for d in DIMENSIONS}
    for ev in evidences:
        if ev.dimension in by_dim:
            by_dim[ev.dimension].append(ev)

    dimensions = [
        DimensionStatus(
            dimension=d,
            is_lit=len(by_dim[d]) > 0,
            count=len(by_dim[d]),
            evidences=[EvidenceOut.model_validate(e) for e in by_dim[d]],
        )
        for d in DIMENSIONS
    ]

    return DashboardData(
        lead_id=lead.id,
        meddicc_score=lead.meddicc_score,
        meddicc_completion=lead.meddicc_completion,
        last_analyzed_at=lead.meddicc_last_analyzed_at,
        dimensions=dimensions,
    )


# ── Endpoints ──────────────────────────────────────────────────────


@router.get("/leads/{lead_id}/meddicc", response_model=DashboardData)
def get_meddicc(
    lead_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    if not session.get(Lead, lead_id):
        raise HTTPException(status_code=404, detail="线索不存在")
    return _build_dashboard(lead_id, session)


@router.post("/leads/{lead_id}/meddicc/analyze", response_model=AnalyzeResponse)
@limiter.limit("10/minute;100/day")
def analyze_meddicc(
    lead_id: str,
    request: Request,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    if not session.get(Lead, lead_id):
        raise HTTPException(status_code=404, detail="线索不存在")
    try:
        result = analyze(lead_id, session, current_user_id=current_user.id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"AI 分析失败：{e}")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI 分析失败：{e}")

    dashboard = _build_dashboard(lead_id, session)
    msg = "线索暂无对话/跟进/事件记录，请先录入" if result.empty_context else None
    return AnalyzeResponse(
        analyzed_at=result.last_analyzed_at,
        evidence_count=result.evidence_count,
        skipped_count=result.skipped_count,
        dashboard=dashboard,
        message=msg,
    )


@router.delete("/meddicc-evidence/{evidence_id}", response_model=DeleteResponse)
def delete_evidence(
    evidence_id: str,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_permission("lead.view")),
):
    ev = session.get(LeadMeddiccEvidence, evidence_id)
    if not ev:
        raise HTTPException(status_code=404, detail="证据不存在")
    lead_id = ev.lead_id
    session.delete(ev)
    # 同步重算 Lead 衍生字段
    recompute(lead_id, session, mark_analyzed=True)
    session.commit()
    return DeleteResponse(deleted=True, lead_id=lead_id, dashboard=_build_dashboard(lead_id, session))
