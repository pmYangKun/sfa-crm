"""MEDDICC history snapshot service — spec 004 §4.3.

每条 lead 的 MEDDICC 评分快照：
- write_snapshot(lead_id, trigger_reason): 在 analyze / forecast_change / backfill 时调用
- get_history(lead_id, since_days, limit): 趋势图数据源（FR-018, FR-019）

dimensions_json 形如：
  {"metrics": {"evidence_count": 3, "lit": true}, "economic_buyer": {...}, ...}
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, select

from app.models.lead import Lead
from app.models.lead_meddicc_evidence import DIMENSIONS, LeadMeddiccEvidence
from app.models.lead_meddicc_history import LeadMeddiccHistory

logger = logging.getLogger(__name__)


def _build_dimensions_json(db: Session, lead_id: str) -> str:
    """对每个 MEDDICC 维度统计 evidence_count + lit，返回 JSON 字符串."""
    evs = db.exec(
        select(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead_id)
    ).all()
    by_dim: dict[str, list] = {dim: [] for dim in DIMENSIONS}
    for ev in evs:
        if ev.dimension in by_dim:
            by_dim[ev.dimension].append(ev)
    out: dict[str, dict] = {}
    for dim in DIMENSIONS:
        items = by_dim[dim]
        out[dim] = {"evidence_count": len(items), "lit": len(items) > 0}
    return json.dumps(out, ensure_ascii=False)


def write_snapshot(
    lead_id: str,
    trigger_reason: str,
    db: Session,
    *,
    commit: bool = True,
) -> Optional[LeadMeddiccHistory]:
    """对当前 lead 的 MEDDICC 状态写一条 snapshot 行.

    Args:
        lead_id: Lead UUID
        trigger_reason: 'analyze' | 'forecast_change' | 'backfill'
        db: 已开启的 Session
        commit: 是否在写完后 commit（默认 True；调用方已在 transaction 中可传 False）

    Returns:
        LeadMeddiccHistory 实例（已 add 到 session），lead 不存在则返 None
    """
    if trigger_reason not in ("analyze", "forecast_change", "backfill"):
        raise ValueError(f"Invalid trigger_reason: {trigger_reason}")

    lead = db.get(Lead, lead_id)
    if lead is None:
        logger.warning("write_snapshot: lead %s not found", lead_id)
        return None

    snapshot = LeadMeddiccHistory(
        lead_id=lead_id,
        snapshot_at=datetime.now(timezone.utc).isoformat(),
        meddicc_score=lead.meddicc_score,
        meddicc_completion=lead.meddicc_completion or 0,
        dimensions_json=_build_dimensions_json(db, lead_id),
        forecast_category=lead.forecast_category,
        amount=lead.amount,
        trigger_reason=trigger_reason,
    )
    db.add(snapshot)
    if commit:
        db.commit()
        db.refresh(snapshot)
    else:
        db.flush()
    return snapshot


def get_history(
    lead_id: str,
    db: Session,
    *,
    since_days: int = 30,
    limit: int = 50,
) -> list[LeadMeddiccHistory]:
    """读趋势图数据：最近 since_days 天内的 snapshot，按时间升序排，最多 limit 条."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()
    rows = db.exec(
        select(LeadMeddiccHistory)
        .where(
            LeadMeddiccHistory.lead_id == lead_id,
            LeadMeddiccHistory.snapshot_at >= cutoff,
        )
        .order_by(LeadMeddiccHistory.snapshot_at.asc())  # type: ignore
        .limit(limit)
    ).all()
    return list(rows)


def has_baseline(lead_id: str, db: Session) -> bool:
    """该 lead 是否已有任何 snapshot（backfill idempotent 判断用）."""
    existing = db.exec(
        select(LeadMeddiccHistory.id)
        .where(LeadMeddiccHistory.lead_id == lead_id)
        .limit(1)
    ).first()
    return existing is not None
