"""Backfill MEDDICC history baseline — spec 004 T018-T020.

启动时如果 lead_meddicc_history 表为空，对每条 stage='active' lead 写一行 baseline
snapshot，让趋势图开局就有数据。

策略：
- idempotent：每条 lead 已有任何 snapshot 即跳过
- 不调 LLM（只是把当前 lead.meddicc_score / completion / dimensions 写一份 baseline）
- 异步执行（fire-and-forget thread）—— 不阻塞 startup
"""

from __future__ import annotations

import logging
import threading

from sqlmodel import Session, select

from app.core.database import engine
from app.models.lead import Lead
from app.models.lead_meddicc_history import LeadMeddiccHistory
from app.services.meddicc_history_service import has_baseline, write_snapshot

logger = logging.getLogger(__name__)


def is_history_empty() -> bool:
    """history 表是否完全空？空才需要全量 backfill."""
    with Session(engine) as s:
        first = s.exec(select(LeadMeddiccHistory.id).limit(1)).first()
        return first is None


def run() -> dict:
    """对所有 active lead（无 baseline 的）写一行 backfill snapshot.

    Returns 形如 {"backfilled": N, "skipped": M}
    """
    backfilled = 0
    skipped = 0
    with Session(engine) as s:
        leads = s.exec(select(Lead).where(Lead.stage == "active")).all()
        for lead in leads:
            try:
                if has_baseline(lead.id, s):
                    skipped += 1
                    continue
                write_snapshot(lead.id, "backfill", s, commit=True)
                backfilled += 1
            except Exception as e:
                logger.warning("backfill snapshot failed for lead %s: %s", lead.id, e)
                skipped += 1
    logger.info("backfill complete: %d backfilled / %d skipped", backfilled, skipped)
    return {"backfilled": backfilled, "skipped": skipped}


def run_async_if_empty() -> None:
    """启动时调用：history 表空才异步跑全量 backfill（fire-and-forget thread）."""
    try:
        if not is_history_empty():
            logger.info("backfill: history table not empty, skip")
            return
    except Exception as e:
        logger.warning("backfill: empty check failed (probably table missing): %s", e)
        return

    def _worker():
        try:
            run()
        except Exception:  # pragma: no cover
            logger.exception("backfill worker crashed")

    t = threading.Thread(target=_worker, daemon=True, name="meddicc-history-backfill")
    t.start()
    logger.info("backfill: kicked off async worker")
