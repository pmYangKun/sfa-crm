"""Manager Pipeline service — spec 004 §10 + alignment §10.

提供 2 个聚合查询：
- query_pipeline(user, ...) → Pipeline 全表（行 = lead），含 warnings count + dimensions_lit
- query_team_rollup(user) → Team Rollup（行 = sales），manager 看下属

DataScope（沿用 spec 003）：
- admin (scope=all) → 全公司
- manager (scope=current_and_below) → 团队
- sales (scope=self_only) → 自己
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Session, func, select

from app.models.contact import Contact
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.lead_meddicc_evidence import DIMENSIONS, LeadMeddiccEvidence
from app.models.org import User
from app.services.permission_service import get_visible_user_ids
from app.services.warning_engine import (
    Warning,
    compute_warnings_batch,
    load_thresholds,
)

logger = logging.getLogger(__name__)


VALID_FORECAST_CATEGORIES = ("进行中", "必赢", "大概率", "乐观估算", "已赢单", "已丢单")
ACTIVE_CATEGORIES = ("进行中", "必赢", "大概率", "乐观估算")


# ── Helpers ──────────────────────────────────────────────────────────────────


def _apply_datascope(stmt, current_user: User, db: Session):
    """对 stmt 应用 DataScope 过滤（沿用 spec 003 模式）."""
    visible_ids = get_visible_user_ids(db, current_user)
    if visible_ids is None:
        return stmt  # admin 看全部
    return stmt.where(Lead.owner_id.in_(visible_ids))  # type: ignore


def _dim_lit_map(db: Session, lead_ids: list[str]) -> dict[str, list[str]]:
    """批量查每条 lead 哪些维度有 evidence."""
    if not lead_ids:
        return {}
    out: dict[str, set[str]] = defaultdict(set)
    rows = db.exec(
        select(LeadMeddiccEvidence.lead_id, LeadMeddiccEvidence.dimension).where(
            LeadMeddiccEvidence.lead_id.in_(lead_ids)  # type: ignore
        )
    ).all()
    for row in rows:
        if isinstance(row, tuple):
            lid, dim = row
        else:
            lid, dim = row[0], row[1]
        if lid and dim:
            out[lid].add(dim)
    return {k: sorted(v) for k, v in out.items()}


def _last_activity_map(db: Session, lead_ids: list[str]) -> dict[str, Optional[str]]:
    """批量查每条 lead 最近活动时间（followup / conversation / key_event 取最大）."""
    if not lead_ids:
        return {}
    # 用 lead.last_followup_at 作为基线，再看 key_event 最新
    out: dict[str, Optional[str]] = {lid: None for lid in lead_ids}
    leads = db.exec(select(Lead).where(Lead.id.in_(lead_ids))).all()  # type: ignore
    for lead in leads:
        out[lead.id] = lead.last_followup_at
    # KeyEvent
    ke_rows = db.exec(
        select(KeyEvent.lead_id, func.max(KeyEvent.occurred_at)).where(
            KeyEvent.lead_id.in_(lead_ids)  # type: ignore
        ).group_by(KeyEvent.lead_id)
    ).all()
    for row in ke_rows:
        lid, ts = (row[0], row[1]) if isinstance(row, tuple) else (row.lead_id, row.max)
        if lid and ts:
            cur = out.get(lid)
            if cur is None or ts > cur:
                out[lid] = ts
    return out


def _next_call_map(db: Session, lead_ids: list[str]) -> dict[str, Optional[str]]:
    """暂未实现 next_call 字段；返回 None 占位（FR-013）."""
    return {lid: None for lid in lead_ids}


def _contacts_count_map(db: Session, lead_ids: list[str]) -> dict[str, int]:
    if not lead_ids:
        return {}
    out: dict[str, int] = {lid: 0 for lid in lead_ids}
    rows = db.exec(
        select(Contact.lead_id, func.count(Contact.id)).where(
            Contact.lead_id.in_(lead_ids)  # type: ignore
        ).group_by(Contact.lead_id)
    ).all()
    for row in rows:
        lid, cnt = (row[0], row[1]) if isinstance(row, tuple) else (row.lead_id, row.count)
        if lid:
            out[lid] = cnt
    return out


# ── Public API ───────────────────────────────────────────────────────────────


def query_pipeline(
    current_user: User,
    db: Session,
    *,
    forecast_category: Optional[str] = None,
    owner_id: Optional[str] = None,
    sort_by: str = "score_asc",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Pipeline 全表查询（含 warnings 实时计算）.

    Returns 形如：
      {
        "leads": [...],
        "total": int,
        "category_counts": {"进行中": N, ...},
        "category_warning_counts": {"进行中": N, ...},
      }
    """
    # ── Stage / forecast_category 过滤 ────────────────────────────────────
    base_stmt = select(Lead)
    base_stmt = _apply_datascope(base_stmt, current_user, db)

    # forecast filter
    if forecast_category is not None:
        if forecast_category not in VALID_FORECAST_CATEGORIES:
            raise ValueError(f"forecast_category 不合法: {forecast_category}")
        if forecast_category == "已赢单":
            base_stmt = base_stmt.where(Lead.stage == "converted")
        elif forecast_category == "已丢单":
            base_stmt = base_stmt.where(Lead.stage == "lost")
        else:
            base_stmt = base_stmt.where(
                Lead.stage == "active",
                Lead.forecast_category == forecast_category,
            )
    # 默认不过滤 stage —— 让前端按 tab 自己选

    if owner_id:
        base_stmt = base_stmt.where(Lead.owner_id == owner_id)

    # ── Sort ──────────────────────────────────────────────────────────────
    if sort_by == "score_asc":
        base_stmt = base_stmt.order_by(Lead.meddicc_score.asc().nulls_first())  # type: ignore
    elif sort_by == "score_desc":
        base_stmt = base_stmt.order_by(Lead.meddicc_score.desc().nulls_last())  # type: ignore
    elif sort_by == "amount_desc":
        base_stmt = base_stmt.order_by(Lead.amount.desc().nulls_last())  # type: ignore
    elif sort_by == "close_date_asc":
        base_stmt = base_stmt.order_by(Lead.close_date.asc().nulls_last())  # type: ignore
    else:
        base_stmt = base_stmt.order_by(Lead.meddicc_score.asc().nulls_first())  # type: ignore

    # Total count
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = db.exec(count_stmt).one()

    # Page
    page_stmt = base_stmt.offset(offset).limit(limit)
    leads = list(db.exec(page_stmt).all())
    lead_ids = [l.id for l in leads]

    # ── Compute warnings batch ────────────────────────────────────────────
    thresholds = load_thresholds(db)
    warnings_map = compute_warnings_batch(
        leads, db, thresholds=thresholds,
        owner_ids_for_median=get_visible_user_ids(db, current_user) or [],
    )
    dim_lit = _dim_lit_map(db, lead_ids)
    last_act = _last_activity_map(db, lead_ids)
    next_call = _next_call_map(db, lead_ids)
    contacts_cnt = _contacts_count_map(db, lead_ids)

    # ── Owner 信息 ────────────────────────────────────────────────────────
    owner_ids = list({l.owner_id for l in leads if l.owner_id})
    owners_map: dict[str, User] = {}
    if owner_ids:
        users = db.exec(select(User).where(User.id.in_(owner_ids))).all()  # type: ignore
        owners_map = {u.id: u for u in users}

    out_leads = []
    for lead in leads:
        ws = warnings_map.get(lead.id, [])
        owner = owners_map.get(lead.owner_id) if lead.owner_id else None
        out_leads.append({
            "id": lead.id,
            "company_name": lead.company_name,
            "owner": (
                {"id": owner.id, "name": owner.name, "avatar_url": None}
                if owner
                else None
            ),
            "amount": lead.amount,
            "close_date": lead.close_date,
            "forecast_category": lead.forecast_category,
            "stage": lead.stage,
            "meddicc_score": lead.meddicc_score,
            "meddicc_completion": lead.meddicc_completion or 0,
            "dimensions_lit": dim_lit.get(lead.id, []),
            "warnings": [w.to_dict() for w in ws],
            "warnings_count": len(ws),
            "last_activity_at": last_act.get(lead.id),
            "next_call_at": next_call.get(lead.id),
            "contacts_count": contacts_cnt.get(lead.id, 0),
        })

    # ── 6 个 forecast bucket counts（不受 forecast_category filter 影响，看完整范围）─
    # 重新走一次 base 查询（不带 forecast / owner filter，但保留 DataScope）
    cat_counts: dict[str, int] = {c: 0 for c in VALID_FORECAST_CATEGORIES}
    cat_warn_counts: dict[str, int] = {c: 0 for c in VALID_FORECAST_CATEGORIES}

    full_stmt = _apply_datascope(select(Lead), current_user, db)
    if owner_id:
        full_stmt = full_stmt.where(Lead.owner_id == owner_id)
    all_leads = list(db.exec(full_stmt).all())

    # 计算 bucket
    bucket_leads: dict[str, list[Lead]] = defaultdict(list)
    for l in all_leads:
        if l.stage == "converted":
            cat = "已赢单"
        elif l.stage == "lost":
            cat = "已丢单"
        elif l.stage == "active":
            cat = l.forecast_category if l.forecast_category in ACTIVE_CATEGORIES else "进行中"
        else:
            continue
        cat_counts[cat] += 1
        bucket_leads[cat].append(l)

    # 对每个 bucket 计算 warning count（lazy compute）
    full_warnings = compute_warnings_batch(
        all_leads, db, thresholds=thresholds,
        owner_ids_for_median=get_visible_user_ids(db, current_user) or [],
    )
    for cat, bls in bucket_leads.items():
        cat_warn_counts[cat] = sum(
            1 for l in bls if full_warnings.get(l.id)
        )

    return {
        "leads": out_leads,
        "total": total,
        "category_counts": cat_counts,
        "category_warning_counts": cat_warn_counts,
    }


def query_team_rollup(
    current_user: User,
    db: Session,
    *,
    sort_by: str = "score_asc",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """Team Rollup 聚合（按 sales owner 分组 active lead）."""
    visible_ids = get_visible_user_ids(db, current_user)
    if visible_ids is None:
        # admin 看所有 active leads 的 sales 用户
        users = db.exec(select(User).where(User.is_active == True)).all()  # noqa: E712
        owner_ids = [u.id for u in users]
    else:
        owner_ids = list(visible_ids)

    if not owner_ids:
        return {"rows": [], "total": 0}

    users = db.exec(
        select(User).where(User.id.in_(owner_ids))  # type: ignore
    ).all()
    user_map = {u.id: u for u in users}

    # 拉所有 active lead in scope
    leads = list(db.exec(
        select(Lead).where(
            Lead.stage == "active",
            Lead.owner_id.in_(owner_ids),  # type: ignore
        )
    ).all())

    # 计算 warnings batch
    thresholds = load_thresholds(db)
    warnings_map = compute_warnings_batch(
        leads, db, thresholds=thresholds,
        owner_ids_for_median=owner_ids,
    )

    # 按 owner 聚合
    by_owner: dict[str, list[Lead]] = defaultdict(list)
    for l in leads:
        if l.owner_id:
            by_owner[l.owner_id].append(l)

    last_activity_global = _last_activity_map(db, [l.id for l in leads])

    rows = []
    for oid in owner_ids:
        owner = user_map.get(oid)
        if not owner:
            continue
        owned = by_owner.get(oid, [])
        if not owned:
            # 没有 active lead 的 sales 也展示一行（empty state）
            rows.append({
                "sales": {"id": oid, "name": owner.name, "avatar_url": None},
                "active_lead_count": 0,
                "avg_meddicc_score": None,
                "warnings_count": 0,
                "total_amount": 0,
                "last_activity_at": None,
            })
            continue
        scores = [l.meddicc_score for l in owned if l.meddicc_score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None
        warn_total = sum(len(warnings_map.get(l.id, [])) for l in owned)
        total_amt = sum(l.amount for l in owned if l.amount is not None)
        # 最近活动 = 各 lead 最近活动取 max
        owner_last_acts = [last_activity_global.get(l.id) for l in owned]
        owner_last_acts = [a for a in owner_last_acts if a]
        last_act = max(owner_last_acts) if owner_last_acts else None
        rows.append({
            "sales": {"id": oid, "name": owner.name, "avatar_url": None},
            "active_lead_count": len(owned),
            "avg_meddicc_score": avg_score,
            "warnings_count": warn_total,
            "total_amount": total_amt,
            "last_activity_at": last_act,
        })

    # 排序
    if sort_by == "score_asc":
        rows.sort(key=lambda r: (r["avg_meddicc_score"] is None, r["avg_meddicc_score"] or 0))
    elif sort_by == "score_desc":
        rows.sort(key=lambda r: -(r["avg_meddicc_score"] or 0))
    elif sort_by == "amount_desc":
        rows.sort(key=lambda r: -(r["total_amount"] or 0))

    total = len(rows)
    paged = rows[offset : offset + limit]
    return {"rows": paged, "total": total}


# ── Chat agent helpers (T028) ────────────────────────────────────────────────


def scan_team_warnings(current_user: User, db: Session) -> dict:
    """返回团队中存在 warning 的 lead 列表 + warning code 列表."""
    visible_ids = get_visible_user_ids(db, current_user)
    stmt = select(Lead).where(Lead.stage == "active")
    if visible_ids is not None:
        stmt = stmt.where(Lead.owner_id.in_(visible_ids))  # type: ignore
    leads = list(db.exec(stmt).all())
    thresholds = load_thresholds(db)
    warnings_map = compute_warnings_batch(
        leads, db, thresholds=thresholds,
        owner_ids_for_median=visible_ids or [],
    )
    user_map: dict[str, User] = {}
    if leads:
        owner_ids = list({l.owner_id for l in leads if l.owner_id})
        if owner_ids:
            users = db.exec(select(User).where(User.id.in_(owner_ids))).all()  # type: ignore
            user_map = {u.id: u for u in users}

    out = []
    total_warnings = 0
    for lead in leads:
        ws = warnings_map.get(lead.id, [])
        if not ws:
            continue
        total_warnings += len(ws)
        owner_name = user_map[lead.owner_id].name if lead.owner_id and lead.owner_id in user_map else "未知"
        out.append({
            "id": lead.id,
            "company_name": lead.company_name,
            "owner": owner_name,
            "warnings": [w.code for w in ws],
            "meddicc_score": lead.meddicc_score,
            "amount": lead.amount,
            "detail_url": f"/leads/{lead.id}",
        })
    out.sort(key=lambda x: -len(x["warnings"]))
    return {"leads": out, "total_warnings": total_warnings}


def team_meddicc_summary(current_user: User, db: Session) -> dict:
    """团队 MEDDICC 概览：avg score / 7 维亮灯密度 / Top 3 / Bottom 3 sales."""
    visible_ids = get_visible_user_ids(db, current_user)
    stmt = select(Lead).where(Lead.stage == "active")
    if visible_ids is not None:
        stmt = stmt.where(Lead.owner_id.in_(visible_ids))  # type: ignore
    leads = list(db.exec(stmt).all())
    if not leads:
        return {
            "team_avg_score": 0,
            "lit_density_per_dim": {d: 0 for d in DIMENSIONS},
            "top_sales": [],
            "bottom_sales": [],
        }

    # avg score
    scores = [l.meddicc_score for l in leads if l.meddicc_score is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    # 7 维亮灯密度
    lead_ids = [l.id for l in leads]
    lit_map = _dim_lit_map(db, lead_ids)
    lit_density = {}
    for d in DIMENSIONS:
        n_lit = sum(1 for lid in lead_ids if d in lit_map.get(lid, []))
        lit_density[d] = round(n_lit / len(lead_ids), 2) if lead_ids else 0

    # Top / Bottom sales by avg score
    by_owner: dict[str, list[float]] = defaultdict(list)
    for l in leads:
        if l.owner_id and l.meddicc_score is not None:
            by_owner[l.owner_id].append(l.meddicc_score)
    sales_avg: list[tuple[str, float]] = []
    user_map: dict[str, User] = {}
    if by_owner:
        users = db.exec(select(User).where(User.id.in_(list(by_owner.keys())))).all()  # type: ignore
        user_map = {u.id: u for u in users}
    for oid, ss in by_owner.items():
        sales_avg.append((oid, round(sum(ss) / len(ss), 1)))
    sales_avg.sort(key=lambda x: -x[1])
    top = [{"name": user_map[oid].name if oid in user_map else "未知", "score": s} for oid, s in sales_avg[:3]]
    bottom = [{"name": user_map[oid].name if oid in user_map else "未知", "score": s} for oid, s in sales_avg[-3:]][::-1]

    return {
        "team_avg_score": avg_score,
        "lit_density_per_dim": lit_density,
        "top_sales": top,
        "bottom_sales": bottom,
    }


def top_attention_deals(current_user: User, db: Session, *, limit: int = 5) -> dict:
    """Top N 重点关注 deals：按 (warning 数 + score 反向 + amount 正向) 加权排序."""
    visible_ids = get_visible_user_ids(db, current_user)
    stmt = select(Lead).where(Lead.stage == "active")
    if visible_ids is not None:
        stmt = stmt.where(Lead.owner_id.in_(visible_ids))  # type: ignore
    leads = list(db.exec(stmt).all())
    if not leads:
        return {"leads": []}

    thresholds = load_thresholds(db)
    warnings_map = compute_warnings_batch(
        leads, db, thresholds=thresholds,
        owner_ids_for_median=visible_ids or [],
    )

    # 团队 amount 中位数（用于 amount 加权）
    amts = sorted([float(l.amount) for l in leads if l.amount and l.amount > 0])
    median_amt = amts[len(amts) // 2] if amts else 0

    scored = []
    for lead in leads:
        n_warn = len(warnings_map.get(lead.id, []))
        score = lead.meddicc_score or 0
        amt = lead.amount or 0
        # 简单加权：warnings × 30 + (100 - score) × 0.5 + amount/median × 10
        attention = n_warn * 30 + (100 - score) * 0.5
        if median_amt > 0 and amt > 0:
            attention += min(amt / median_amt, 5.0) * 10
        scored.append((lead, n_warn, attention))
    scored.sort(key=lambda x: -x[2])
    top = scored[:limit]

    out = []
    for lead, n_warn, att in top:
        reasons = []
        if n_warn > 0:
            reasons.append(f"{n_warn} 个 warning")
        if (lead.meddicc_score or 0) < 60:
            reasons.append(f"Score 仅 {int(lead.meddicc_score or 0)}")
        if median_amt > 0 and lead.amount and lead.amount > median_amt * 2:
            reasons.append(f"金额高于团队中位数 {round(lead.amount / median_amt, 1)}x")
        out.append({
            "id": lead.id,
            "company_name": lead.company_name,
            "attention_score": round(att, 1),
            "reasons": reasons or ["综合关注度高"],
            "detail_url": f"/leads/{lead.id}",
        })
    return {"leads": out}


def forecast_category_distribution(current_user: User, db: Session) -> dict:
    """6 个 forecast bucket 的 lead 数 + 总金额 + warnings 数."""
    visible_ids = get_visible_user_ids(db, current_user)
    stmt = select(Lead)
    if visible_ids is not None:
        stmt = stmt.where(Lead.owner_id.in_(visible_ids))  # type: ignore
    leads = list(db.exec(stmt).all())

    thresholds = load_thresholds(db)
    warnings_map = compute_warnings_batch(
        leads, db, thresholds=thresholds,
        owner_ids_for_median=visible_ids or [],
    )

    buckets: dict[str, dict] = {
        c: {"category": c, "count": 0, "total_amount": 0, "warnings_count": 0}
        for c in VALID_FORECAST_CATEGORIES
    }
    for l in leads:
        if l.stage == "converted":
            cat = "已赢单"
        elif l.stage == "lost":
            cat = "已丢单"
        elif l.stage == "active":
            cat = l.forecast_category if l.forecast_category in ACTIVE_CATEGORIES else "进行中"
        else:
            continue
        buckets[cat]["count"] += 1
        if l.amount:
            buckets[cat]["total_amount"] += l.amount
        if warnings_map.get(l.id):
            buckets[cat]["warnings_count"] += 1

    return {"buckets": list(buckets.values())}
