"""Score calculator — MEDDICC 仪表盘 Score 与 completion 计算（spec 003 T008）.

公式（research.md Decision 3）：
  完整度分 = (有证据维度数 / 7) × 60          # 0-60
  深度分   = min(总证据条数, 14) / 14 × 25     # 0-25
  活跃度分 = 15 if 7 天内有新对话或新分析
           = 8  if 30 天内
           = 0  otherwise                       # 0-15
  meddicc_score = round(完整度分 + 深度分 + 活跃度分)  # 0-100
"""

from datetime import datetime, timedelta, timezone
from typing import Optional, Sequence

from sqlmodel import Session, select

from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.lead_meddicc_evidence import DIMENSIONS, LeadMeddiccEvidence


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str) -> Optional[datetime]:
    if not s:
        return None
    try:
        # tolerate Z suffix
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _activity_pts(last_activity_at: Optional[str]) -> float:
    dt = _parse_iso(last_activity_at) if last_activity_at else None
    if dt is None:
        return 0
    delta = _now_utc() - dt
    if delta <= timedelta(days=7):
        return 15
    if delta <= timedelta(days=30):
        return 8
    return 0


def calculate_meddicc_score(
    evidences: Sequence[LeadMeddiccEvidence],
    last_activity_at: Optional[str],
) -> tuple[int, int]:
    """返回 (score, completion)。

    completion = 有证据的维度数（0-7）
    score = 三段式公式（0-100）
    """
    # 过滤合法 dimension（防御性，实际入库前已校验）
    valid = [e for e in evidences if e.dimension in DIMENSIONS]

    completion = len({e.dimension for e in valid})

    completeness_pts = (completion / 7) * 60
    depth_pts = min(len(valid), 14) / 14 * 25
    activity_pts = _activity_pts(last_activity_at)

    score = round(completeness_pts + depth_pts + activity_pts)
    score = max(0, min(100, score))  # clamp [0, 100]
    return score, completion


def _latest_activity_at(lead_id: str, db: Session) -> Optional[str]:
    """取该 lead 最近一次 conversation.recorded_at 或 lead.last_followup_at（取较新者）."""
    last_conv = db.exec(
        select(Conversation.recorded_at)
        .where(Conversation.lead_id == lead_id)
        .order_by(Conversation.recorded_at.desc())  # type: ignore
        .limit(1)
    ).first()

    lead = db.get(Lead, lead_id)
    last_fu = lead.last_followup_at if lead else None

    candidates = [t for t in (last_conv, last_fu) if t]
    if not candidates:
        return None
    return max(candidates)


def recompute(lead_id: str, db: Session, mark_analyzed: bool = True) -> tuple[int, int]:
    """重算 Lead 的 3 个 MEDDICC 衍生字段并写库。

    Args:
        lead_id: Lead UUID
        db: 已开启的 Session（调用方负责 commit）
        mark_analyzed: 是否更新 last_analyzed_at（删 evidence 时也需要更新，因仪表盘内容已变）

    Returns:
        (score, completion)
    """
    lead = db.get(Lead, lead_id)
    if not lead:
        return (0, 0)

    evidences = db.exec(
        select(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead_id)
    ).all()

    last_activity = _latest_activity_at(lead_id, db)
    score, completion = calculate_meddicc_score(evidences, last_activity)

    lead.meddicc_score = float(score)
    lead.meddicc_completion = completion
    if mark_analyzed:
        lead.meddicc_last_analyzed_at = _now_utc().isoformat()

    db.add(lead)
    return (score, completion)
