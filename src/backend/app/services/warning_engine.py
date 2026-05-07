"""Warning rules engine — spec 004 §5.1.

7 条规则，lazy compute on read（FR-040）。每条规则：
- 接收 lead + context（评估上下文：followups / contacts / team_amount_median 等）
- 返回 Optional[Warning]（满足条件返 Warning，否则 None）
- mitigation 文字硬编码模板，渲染时填入 placeholders（{N} / {缺失维度} / {amount}）

聚合 API：
- compute_warnings_for_lead(lead, context) -> List[Warning]
- compute_warnings_batch(leads, db, ...) -> Dict[lead_id, List[Warning]]

阈值从 system_config 读（带 in-process cache）。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlmodel import Session, select

from app.models.config import SystemConfig
from app.models.contact import Contact
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.lead_meddicc_evidence import DIMENSIONS, LeadMeddiccEvidence

logger = logging.getLogger(__name__)


# ── Dimension key → 中文 label（mitigation 文字渲染用）─────────────────────────
DIM_CN_LABELS = {
    "metrics": "Metrics（量化指标）",
    "economic_buyer": "Economic Buyer（决策人）",
    "decision_criteria": "Decision Criteria（决策标准）",
    "decision_process": "Decision Process（决策流程）",
    "pain": "Pain（痛点）",
    "champion": "Champion（内部支持者）",
    "competition": "Competition（竞争）",
}


@dataclass
class Warning:
    """单条 warning 记录."""

    code: str
    mitigation: str  # 已渲染的中文提示文字（含具体数值）
    severity: str = "warn"  # warn | info；spec 004 一律 warn

    def to_dict(self) -> dict:
        return {
            "code": self.code,
            "mitigation": self.mitigation,
            "severity": self.severity,
        }


@dataclass
class WarningContext:
    """评估单条 lead 时所需上下文，避免每条规则各自查 DB."""

    today: datetime
    last_activity_at: Optional[str]
    followup_count: int
    contacts_count: int
    lit_dimensions: set[str]  # 哪些 MEDDICC 维度有证据
    team_amount_median: Optional[float] = None
    thresholds: dict = field(default_factory=dict)


# ── Threshold helpers ────────────────────────────────────────────────────────

DEFAULT_THRESHOLDS = {
    "warning_silent_days": 14,
    "warning_brag_lit_threshold": 5,
    "warning_close_imminent_days": 14,
    "warning_close_imminent_score": 60,
    "warning_no_champion_followup_count": 3,
    "warning_single_contact_days": 30,
    "warning_big_deal_amount_multiplier": 3,
}


def _read_int(db: Session, key: str, default: int) -> int:
    cfg = db.get(SystemConfig, key)
    if cfg and cfg.value is not None:
        try:
            return int(cfg.value)
        except (TypeError, ValueError):
            pass
    return default


def _read_float(db: Session, key: str, default: float) -> float:
    cfg = db.get(SystemConfig, key)
    if cfg and cfg.value is not None:
        try:
            return float(cfg.value)
        except (TypeError, ValueError):
            pass
    return default


def load_thresholds(db: Session) -> dict:
    """读 7 条 spec 004 warning 阈值；缺失走 DEFAULT_THRESHOLDS."""
    return {
        "warning_silent_days": _read_int(
            db, "warning_silent_days", DEFAULT_THRESHOLDS["warning_silent_days"]
        ),
        "warning_brag_lit_threshold": _read_int(
            db, "warning_brag_lit_threshold", DEFAULT_THRESHOLDS["warning_brag_lit_threshold"]
        ),
        "warning_close_imminent_days": _read_int(
            db, "warning_close_imminent_days", DEFAULT_THRESHOLDS["warning_close_imminent_days"]
        ),
        "warning_close_imminent_score": _read_int(
            db, "warning_close_imminent_score", DEFAULT_THRESHOLDS["warning_close_imminent_score"]
        ),
        "warning_no_champion_followup_count": _read_int(
            db,
            "warning_no_champion_followup_count",
            DEFAULT_THRESHOLDS["warning_no_champion_followup_count"],
        ),
        "warning_single_contact_days": _read_int(
            db, "warning_single_contact_days", DEFAULT_THRESHOLDS["warning_single_contact_days"]
        ),
        "warning_big_deal_amount_multiplier": _read_float(
            db,
            "warning_big_deal_amount_multiplier",
            DEFAULT_THRESHOLDS["warning_big_deal_amount_multiplier"],
        ),
    }


# ── ISO 时间工具 ──────────────────────────────────────────────────────────────


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


def _missing_dim_labels(lit: set[str]) -> list[str]:
    """返回未亮灯的维度中文 label 列表."""
    missing = [d for d in DIMENSIONS if d not in lit]
    return [DIM_CN_LABELS.get(d, d) for d in missing]


# ── 7 条规则函数 ──────────────────────────────────────────────────────────────


def rule_silent_deal(lead: Lead, ctx: WarningContext) -> Optional[Warning]:
    """规则 1: silent_deal —— 最近 X 天没有任何 FollowUp / KeyEvent / Conversation."""
    if lead.stage != "active":
        return None
    threshold_days = ctx.thresholds.get("warning_silent_days", 14)
    last_at = _parse_iso(ctx.last_activity_at)
    # 没有任何活动 + 创建很久 → 也算沉默
    if last_at is None:
        # 用 created_at 兜底
        created = _parse_iso(lead.created_at)
        if created is None:
            return None
        delta = ctx.today - created
        if delta > timedelta(days=threshold_days):
            return Warning(
                code="silent_deal",
                mitigation=f"建议主动联系客户重启沟通——{threshold_days} 天没动可能信号已凉",
            )
        return None
    delta = ctx.today - last_at
    if delta > timedelta(days=threshold_days):
        return Warning(
            code="silent_deal",
            mitigation=f"建议主动联系客户重启沟通——{threshold_days} 天没动可能信号已凉",
        )
    return None


def rule_brag_without_evidence(lead: Lead, ctx: WarningContext) -> Optional[Warning]:
    """规则 2: brag_without_evidence —— 必赢/大概率但 MEDDICC 亮灯不足."""
    if lead.stage != "active":
        return None
    if lead.forecast_category not in ("必赢", "大概率"):
        return None
    threshold = ctx.thresholds.get("warning_brag_lit_threshold", 5)
    lit_count = len(ctx.lit_dimensions)
    if lit_count >= threshold:
        return None
    missing_labels = _missing_dim_labels(ctx.lit_dimensions)
    missing_str = "、".join(missing_labels) if missing_labels else "（暂无具体缺失项）"
    return Warning(
        code="brag_without_evidence",
        mitigation=f"MEDDICC 维度还不够全，建议先把 {missing_str} 补上再下结论",
    )


def rule_close_imminent_low_score(lead: Lead, ctx: WarningContext) -> Optional[Warning]:
    """规则 3: close_imminent_low_score —— close_date X 天内 + Score < Y."""
    if lead.stage != "active":
        return None
    if not lead.close_date:
        return None
    cd = _parse_iso(lead.close_date) or _parse_iso(lead.close_date + "T00:00:00")
    if cd is None:
        return None
    days_until = (cd - ctx.today).days
    threshold_days = ctx.thresholds.get("warning_close_imminent_days", 14)
    threshold_score = ctx.thresholds.get("warning_close_imminent_score", 60)
    if days_until < 0:
        return None  # 已过期由 rule 4 处理
    if days_until > threshold_days:
        return None
    score = lead.meddicc_score if lead.meddicc_score is not None else 0
    if score >= threshold_score:
        return None
    return Warning(
        code="close_imminent_low_score",
        mitigation="关单日临近但准备度不足——建议本周内补齐关键证据",
    )


def rule_overdue_not_closed(lead: Lead, ctx: WarningContext) -> Optional[Warning]:
    """规则 4: overdue_not_closed —— close_date < today 且 stage='active'."""
    if lead.stage != "active":
        return None
    if not lead.close_date:
        return None
    cd = _parse_iso(lead.close_date) or _parse_iso(lead.close_date + "T00:00:00")
    if cd is None:
        return None
    if cd >= ctx.today:
        return None
    return Warning(
        code="overdue_not_closed",
        mitigation="关单日已过但未关闭——确认实际状态：标已赢单 / 已丢单 / 重设 close_date",
    )


def rule_no_champion_after_followups(lead: Lead, ctx: WarningContext) -> Optional[Warning]:
    """规则 5: no_champion_after_followups —— Champion 维度空 + 跟进次数 ≥ N."""
    if lead.stage != "active":
        return None
    threshold = ctx.thresholds.get("warning_no_champion_followup_count", 3)
    if ctx.followup_count < threshold:
        return None
    if "champion" in ctx.lit_dimensions:
        return None
    return Warning(
        code="no_champion_after_followups",
        mitigation=f"跟进了 {ctx.followup_count} 次但还没找到内部支持者——建议下次拜访重点观察客户内部谁在替你说话",
    )


def rule_single_contact_exposed(lead: Lead, ctx: WarningContext) -> Optional[Warning]:
    """规则 6: single_contact_exposed —— 联系人 = 1 + 创建超过 N 天."""
    if lead.stage != "active":
        return None
    if ctx.contacts_count != 1:
        return None
    threshold_days = ctx.thresholds.get("warning_single_contact_days", 30)
    created = _parse_iso(lead.created_at)
    if created is None:
        return None
    days_old = (ctx.today - created).days
    if days_old <= threshold_days:
        return None
    return Warning(
        code="single_contact_exposed",
        mitigation=f"只靠 1 个联系人撑着 {days_old} 天——一旦此人离职/换岗即客户流失，建议拓展第二联系人",
    )


def rule_big_deal_thin_evidence(lead: Lead, ctx: WarningContext) -> Optional[Warning]:
    """规则 7: big_deal_thin_evidence —— amount > 团队中位数 × N 且亮灯 < 5."""
    if lead.stage != "active":
        return None
    if lead.amount is None or lead.amount <= 0:
        return None
    median = ctx.team_amount_median
    if not median or median <= 0:
        return None
    multiplier = ctx.thresholds.get("warning_big_deal_amount_multiplier", 3)
    if lead.amount < median * multiplier:
        return None
    lit_threshold = ctx.thresholds.get("warning_brag_lit_threshold", 5)
    if len(ctx.lit_dimensions) >= lit_threshold:
        return None
    missing_labels = _missing_dim_labels(ctx.lit_dimensions)
    missing_str = "、".join(missing_labels) if missing_labels else "（暂无具体缺失项）"
    amount_yuan = f"¥{int(lead.amount):,}"
    return Warning(
        code="big_deal_thin_evidence",
        mitigation=f"大单证据偏薄——金额 {amount_yuan}（高于团队中位数 {multiplier} 倍）但 MEDDICC 缺 {missing_str}，建议升级为重点跟进",
    )


# ── 聚合主入口 ────────────────────────────────────────────────────────────────


ALL_RULES = [
    rule_silent_deal,
    rule_brag_without_evidence,
    rule_close_imminent_low_score,
    rule_overdue_not_closed,
    rule_no_champion_after_followups,
    rule_single_contact_exposed,
    rule_big_deal_thin_evidence,
]


def compute_warnings_for_lead(lead: Lead, ctx: WarningContext) -> list[Warning]:
    """对单条 lead 应用全部 7 条规则，返回触发的 warning 列表."""
    out: list[Warning] = []
    for rule in ALL_RULES:
        try:
            w = rule(lead, ctx)
        except Exception as e:  # pragma: no cover — 防御式
            logger.warning("warning rule %s failed for lead %s: %s", rule.__name__, lead.id, e)
            continue
        if w is not None:
            out.append(w)
    return out


# ── Batch helpers ────────────────────────────────────────────────────────────


def _last_activity_for_lead(db: Session, lead: Lead) -> Optional[str]:
    """取该 lead 最近活动时间——followup / conversation / key_event 任一最新."""
    candidates: list[str] = []
    if lead.last_followup_at:
        candidates.append(lead.last_followup_at)
    last_conv = db.exec(
        select(Conversation.recorded_at)
        .where(Conversation.lead_id == lead.id)
        .order_by(Conversation.recorded_at.desc())  # type: ignore
        .limit(1)
    ).first()
    if last_conv:
        candidates.append(last_conv)
    last_ke = db.exec(
        select(KeyEvent.occurred_at)
        .where(KeyEvent.lead_id == lead.id)
        .order_by(KeyEvent.occurred_at.desc())  # type: ignore
        .limit(1)
    ).first()
    if last_ke:
        candidates.append(last_ke)
    if not candidates:
        return None
    return max(candidates)


def _team_amount_median(db: Session, owner_ids: list[str]) -> Optional[float]:
    """团队范围内 active lead 的 amount 中位数（None / 0 都过滤）."""
    if not owner_ids:
        # 看全部 active lead
        amounts = db.exec(
            select(Lead.amount).where(Lead.stage == "active", Lead.amount.is_not(None))  # type: ignore
        ).all()
    else:
        amounts = db.exec(
            select(Lead.amount).where(
                Lead.stage == "active",
                Lead.amount.is_not(None),  # type: ignore
                Lead.owner_id.in_(owner_ids),  # type: ignore
            )
        ).all()
    vals = sorted([float(a) for a in amounts if a is not None and a > 0])
    if not vals:
        return None
    n = len(vals)
    if n % 2 == 1:
        return vals[n // 2]
    return (vals[n // 2 - 1] + vals[n // 2]) / 2.0


def compute_warnings_batch(
    leads: list[Lead],
    db: Session,
    *,
    today: Optional[datetime] = None,
    thresholds: Optional[dict] = None,
    team_amount_median: Optional[float] = None,
    owner_ids_for_median: Optional[list[str]] = None,
) -> dict[str, list[Warning]]:
    """批量计算 lead 列表的 warning，单次 < 50ms 量级（FR-040）.

    Args:
        leads: 待计算的 Lead 列表
        db: SQLModel session
        today: 时间锚点（默认 utcnow）
        thresholds: 已加载的阈值 dict（默认从 SystemConfig 读）
        team_amount_median: 已计算好的团队 amount 中位数（避免重复算）
        owner_ids_for_median: 若 team_amount_median 未传，用这组 owner 算中位数

    Returns:
        {lead_id: [Warning, ...]}（无 warning 的 lead 不出现在 dict 中）
    """
    if not leads:
        return {}
    if today is None:
        today = datetime.now(timezone.utc)
    if thresholds is None:
        thresholds = load_thresholds(db)
    if team_amount_median is None:
        team_amount_median = _team_amount_median(db, owner_ids_for_median or [])

    lead_ids = [l.id for l in leads]

    # 批量查 contacts_count
    contacts_count_map: dict[str, int] = {lid: 0 for lid in lead_ids}
    contacts = db.exec(
        select(Contact.lead_id).where(Contact.lead_id.in_(lead_ids))  # type: ignore
    ).all()
    for cid in contacts:
        if cid:
            contacts_count_map[cid] = contacts_count_map.get(cid, 0) + 1

    # 批量查 followup_count
    followup_count_map: dict[str, int] = {lid: 0 for lid in lead_ids}
    fus = db.exec(
        select(FollowUp.lead_id).where(FollowUp.lead_id.in_(lead_ids))  # type: ignore
    ).all()
    for fid in fus:
        if fid:
            followup_count_map[fid] = followup_count_map.get(fid, 0) + 1

    # 批量查 lit dimensions（每个 lead 哪些维度有 evidence）
    lit_map: dict[str, set[str]] = {lid: set() for lid in lead_ids}
    evs = db.exec(
        select(LeadMeddiccEvidence.lead_id, LeadMeddiccEvidence.dimension).where(
            LeadMeddiccEvidence.lead_id.in_(lead_ids)  # type: ignore
        )
    ).all()
    for row in evs:
        # row 可能是 tuple (lead_id, dimension)
        if isinstance(row, tuple):
            lid, dim = row
        else:
            lid, dim = row[0], row[1]
        if lid and dim:
            lit_map.setdefault(lid, set()).add(dim)

    out: dict[str, list[Warning]] = {}
    for lead in leads:
        ctx = WarningContext(
            today=today,
            last_activity_at=_last_activity_for_lead(db, lead),
            followup_count=followup_count_map.get(lead.id, 0),
            contacts_count=contacts_count_map.get(lead.id, 0),
            lit_dimensions=lit_map.get(lead.id, set()),
            team_amount_median=team_amount_median,
            thresholds=thresholds,
        )
        warnings = compute_warnings_for_lead(lead, ctx)
        if warnings:
            out[lead.id] = warnings
    return out
