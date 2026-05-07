"""MEDDICC extractor — 调 LLM 抽 7 维度证据，Replace 写库（spec 003 T010）.

工作流：
1. 读 lead 全量上下文（conversations + followups + key_events + lead 基本信息）
2. 上下文为空 → 直接返回空 + score=0（FR-010）
3. 否则构造 prompt → 调 LLM（沿用 spec 002 LLM 配置）→ retry 1 次
4. 解析 JSON + post-validate（dimension / source_id FK / evidence_text / confidence）
5. Replace 写库（DELETE + INSERT）+ 重算 Lead 衍生字段
"""

import json
import logging
import re
import uuid
from dataclasses import dataclass
from typing import Optional

import httpx
from sqlmodel import Session, delete, select

from app.models.conversation import Conversation
from app.models.followup import FollowUp
from app.models.key_event import KeyEvent
from app.models.lead import Lead
from app.models.lead_meddicc_evidence import (
    DIMENSIONS,
    SOURCE_TYPES,
    LeadMeddiccEvidence,
)
from app.models.llm_config import LLMConfig
from app.services.score_calculator import recompute

logger = logging.getLogger(__name__)

SOURCE_TABLE_MAP = {
    "conversation": Conversation,
    "followup": FollowUp,
    "key_event": KeyEvent,
}

LLM_TIMEOUT_SECONDS = 15
MAX_EVIDENCE_TEXT = 200


@dataclass
class AnalyzeResult:
    """analyze() 返回结构。"""
    lead_id: str
    score: int
    completion: int
    evidence_count: int
    skipped_count: int
    last_analyzed_at: str
    empty_context: bool = False


SYSTEM_PROMPT = """你是 MEDDICC 销售分析助手，为企业家培训公司服务。

【任务】
分析下面这条线索的全部上下文（对话 / 跟进 / 关键事件），按 MEDDICC 7 维度抽取证据。

【7 维度培训行业含义】
- metrics（量化指标）：客户希望培训改变的数字 — 业绩 / 团队留存 / 老板时间 / 人效
- economic_buyer（决策人）：能拍板付钱的人 — 绝大多数是老板 / 创始人，少数 VP/HR
- decision_criteria（决策标准）：客户怎么选培训公司 — 讲师品牌 / 朋友推荐 / 试听 / 同行案例 / 价格 / 课程体系
- decision_process（决策流程）：内部决策方式 — 老板独决 / 老板+配偶 / 老板+合伙人
- pain（痛点）：业绩下滑 / 团队留不住 / 自己累 / 转型焦虑 / 卡瓶颈
- champion（内部支持者）：常是配偶 / 合伙人 / HR；KP 不是 EB 时 KP 通常是
- competition（竞争）：其他培训公司（樊登 / 行动派 / 同行）+ 自己摸索 + "暂时不上"

【输出格式】
严格 JSON，无 markdown 包裹，无前后说明文字：
{
  "evidences": [
    {
      "dimension": "metrics|economic_buyer|decision_criteria|decision_process|pain|champion|competition",
      "source_type": "conversation|followup|key_event",
      "source_id": "<上下文里给的真实 id 字符串>",
      "evidence_text": "原文片段或摘要，≤200 字",
      "confidence": 0.0-1.0
    }
  ]
}

【强约束】
1. source_id 必须严格使用上下文给的真实 id，不要编造
2. 同一段对话可贡献多个维度的证据
3. 若某维度在所有上下文里完全无信号，不要强行抽
4. confidence 反映证据强弱：明确陈述 ≥0.85 / 暗示推断 0.6-0.8 / 弱关联 0.4-0.5 / <0.4 不输出
5. evidence_text 优先用原文片段，太长则浓缩摘要
6. 不要输出任何 JSON 之外的文字，包括 markdown fence

【few-shot 示例】
输入上下文：
线索：示例公司（华南，来源：referral）
== 对话记录 ==
[对话 1] id=conv-demo, recorded_at=2026-01-01
内容：销售：王总您好，听老李提起您。
客户：我们今年业绩从 800 万跌到 500 万，团队也走了 5 个人，我自己都快撑不住了。
销售：您内部一般这种事是您自己定还是要跟太太商量？
客户：跟我太太商量。她一直觉得我应该上这种课。

输出：
{"evidences":[
  {"dimension":"metrics","source_type":"conversation","source_id":"conv-demo","evidence_text":"业绩从 800 万跌到 500 万","confidence":0.9},
  {"dimension":"pain","source_type":"conversation","source_id":"conv-demo","evidence_text":"团队走了 5 个人，自己快撑不住","confidence":0.9},
  {"dimension":"decision_process","source_type":"conversation","source_id":"conv-demo","evidence_text":"跟太太商量决定","confidence":0.85},
  {"dimension":"champion","source_type":"conversation","source_id":"conv-demo","evidence_text":"太太一直觉得应该上这种课","confidence":0.8},
  {"dimension":"decision_criteria","source_type":"conversation","source_id":"conv-demo","evidence_text":"老李推荐","confidence":0.7}
]}
"""


def _build_user_prompt(lead: Lead, conversations: list, followups: list, key_events: list) -> str:
    parts = [f"线索：{lead.company_name}（{lead.region}，来源：{lead.source}）", ""]

    if conversations:
        parts.append("== 对话记录 ==")
        for c in conversations:
            parts.append(f"[对话] id={c.id}, recorded_at={c.recorded_at}")
            parts.append(f"内容：{c.content}")
            parts.append("")

    if followups:
        parts.append("== 跟进记录 ==")
        for f in followups:
            parts.append(f"[跟进] id={f.id}, type={f.type}, followed_at={f.followed_at}")
            parts.append(f"内容：{f.content}")
            parts.append("")

    if key_events:
        parts.append("== 关键事件 ==")
        for k in key_events:
            parts.append(f"[事件] id={k.id}, type={k.type}, occurred_at={k.occurred_at}")
            parts.append(f"payload={k.payload}")
            parts.append("")

    return "\n".join(parts)


def _strip_markdown_fence(text: str) -> str:
    """去除 LLM 返回中可能包裹的 ```json``` fence."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _call_llm(system_prompt: str, user_prompt: str, db: Session) -> Optional[str]:
    """同步调 LLM。沿用 spec 002 LLMConfig（DeepSeek-chat 默认）.

    返回 LLM 的 text 输出（已 strip fence）。
    失败抛异常或返回 None。
    """
    cfg = db.exec(select(LLMConfig).where(LLMConfig.is_active == True)).first()  # noqa: E712
    if not cfg:
        raise RuntimeError("LLM 未配置")

    api_key = cfg.api_key_decrypted if hasattr(cfg, "api_key_decrypted") else cfg.api_key

    # 尝试 DeepSeek 兼容 OpenAI 协议
    if "deepseek" in (cfg.provider or "").lower():
        url = "https://api.deepseek.com/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": cfg.model or "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 2000,
            "response_format": {"type": "json_object"},
        }
    else:
        # 通用 OpenAI 兼容 fallback
        api_base = getattr(cfg, "api_base", None) or "https://api.openai.com/v1"
        url = f"{api_base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": cfg.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.3,
            "max_tokens": 2000,
        }

    with httpx.Client(timeout=LLM_TIMEOUT_SECONDS) as client:
        resp = client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

    # OpenAI 兼容协议
    text = data["choices"][0]["message"]["content"]
    return _strip_markdown_fence(text)


def _validate_and_filter(parsed: dict, db: Session) -> tuple[list[dict], int]:
    """校验 LLM 输出 + post-validate FK，返回 (合法 evidences, skipped_count).

    校验规则（research.md Decision 6）：
    - dimension 在 DIMENSIONS 内
    - source_type 在 SOURCE_TYPES 内
    - source_id 在对应表实存
    - evidence_text 截断到 ≤200 字
    - confidence ∈ [0, 1]，越界 clamp
    """
    evidences_raw = parsed.get("evidences") or []
    if not isinstance(evidences_raw, list):
        return [], 0

    valid = []
    skipped = 0

    for ev in evidences_raw:
        if not isinstance(ev, dict):
            skipped += 1
            continue

        dim = ev.get("dimension")
        if dim not in DIMENSIONS:
            logger.warning("skip evidence: unknown dimension %s", dim)
            skipped += 1
            continue

        st = ev.get("source_type")
        if st not in SOURCE_TYPES:
            logger.warning("skip evidence: unknown source_type %s", st)
            skipped += 1
            continue

        sid = ev.get("source_id")
        if not sid or not isinstance(sid, str):
            skipped += 1
            continue

        # FK validation
        Model = SOURCE_TABLE_MAP[st]
        if not db.get(Model, sid):
            logger.warning("skip evidence: hallucinated %s/%s", st, sid)
            skipped += 1
            continue

        text = (ev.get("evidence_text") or "").strip()
        if not text:
            skipped += 1
            continue
        if len(text) > MAX_EVIDENCE_TEXT:
            text = text[:MAX_EVIDENCE_TEXT]

        try:
            conf = float(ev.get("confidence", 0.0))
        except (TypeError, ValueError):
            conf = 0.5
        conf = max(0.0, min(1.0, conf))

        valid.append({
            "dimension": dim,
            "source_type": st,
            "source_id": sid,
            "evidence_text": text,
            "confidence": conf,
        })

    return valid, skipped


def analyze(lead_id: str, db: Session, current_user_id: Optional[str] = None) -> AnalyzeResult:
    """对指定 lead 跑 MEDDICC 分析（Replace 策略写库 + 重算 Lead 衍生字段）.

    Returns:
        AnalyzeResult
    Raises:
        HTTPException 由 router 层处理；service 层 raise RuntimeError / 业务异常
    """
    from datetime import datetime, timezone

    lead = db.get(Lead, lead_id)
    if not lead:
        raise ValueError(f"Lead {lead_id} 不存在")

    # 1. 读上下文
    conversations = list(db.exec(
        select(Conversation)
        .where(Conversation.lead_id == lead_id)
        .order_by(Conversation.recorded_at.desc())  # type: ignore
    ).all())
    followups = list(db.exec(
        select(FollowUp)
        .where(FollowUp.lead_id == lead_id)
        .order_by(FollowUp.followed_at.desc())  # type: ignore
    ).all())
    key_events = list(db.exec(
        select(KeyEvent)
        .where(KeyEvent.lead_id == lead_id)
        .order_by(KeyEvent.occurred_at.desc())  # type: ignore
    ).all())

    has_context = bool(conversations or followups or key_events)

    # 2. 上下文为空 → 不调 LLM，直接清空 evidence + 重算（FR-010）
    if not has_context:
        db.exec(delete(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead_id))  # type: ignore
        score, completion = recompute(lead_id, db, mark_analyzed=True)
        db.commit()
        last_at = lead.meddicc_last_analyzed_at or datetime.now(timezone.utc).isoformat()
        # spec 004: 即便空上下文也写 snapshot，趋势图能显示 baseline=0
        try:
            from app.services.meddicc_history_service import write_snapshot
            write_snapshot(lead_id, "analyze", db, commit=True)
        except Exception as e:  # pragma: no cover
            logger.warning("write_snapshot(analyze, empty) failed: %s", e)
        return AnalyzeResult(
            lead_id=lead_id,
            score=score,
            completion=completion,
            evidence_count=0,
            skipped_count=0,
            last_analyzed_at=last_at,
            empty_context=True,
        )

    # 3. 调 LLM
    user_prompt = _build_user_prompt(lead, conversations, followups, key_events)

    try:
        text = _call_llm(SYSTEM_PROMPT, user_prompt, db)
    except Exception as e:
        # retry 1 次
        logger.warning("LLM 第一次调用失败，retry: %s", e)
        try:
            text = _call_llm(SYSTEM_PROMPT, user_prompt, db)
        except Exception as e2:
            logger.exception("LLM 重试仍失败: %s", e2)
            raise RuntimeError(f"AI 分析失败：{e2}") from e2

    if not text:
        raise RuntimeError("AI 分析失败：LLM 返回空内容")

    # 4. JSON 解析（容错 retry 1 次再次调 LLM）
    parsed = None
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("LLM 输出非 JSON，retry: %s", e)
        try:
            text2 = _call_llm(SYSTEM_PROMPT, user_prompt, db)
            parsed = json.loads(text2 or "")
        except Exception as e2:
            logger.exception("LLM JSON 解析两次失败")
            raise RuntimeError("AI 分析失败：JSON 解析错误") from e2

    if not isinstance(parsed, dict):
        raise RuntimeError("AI 分析失败：返回格式错误")

    # 5. post-validate
    valid_evidences, skipped = _validate_and_filter(parsed, db)

    # 6. Replace 写库（DELETE + INSERT）
    db.exec(delete(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead_id))  # type: ignore
    for ev in valid_evidences:
        db.add(LeadMeddiccEvidence(
            lead_id=lead_id,
            dimension=ev["dimension"],
            source_type=ev["source_type"],
            source_id=ev["source_id"],
            evidence_text=ev["evidence_text"],
            confidence=ev["confidence"],
        ))

    # 7. 重算 Lead 衍生字段
    score, completion = recompute(lead_id, db, mark_analyzed=True)
    db.commit()

    last_at = db.get(Lead, lead_id).meddicc_last_analyzed_at  # type: ignore

    # 8. spec 004: 写一行 MEDDICC history snapshot（trigger='analyze'）
    try:
        from app.services.meddicc_history_service import write_snapshot
        write_snapshot(lead_id, "analyze", db, commit=True)
    except Exception as e:  # pragma: no cover — 防御式，不让 snapshot 失败影响主流程
        logger.warning("write_snapshot(analyze) failed for lead %s: %s", lead_id, e)

    return AnalyzeResult(
        lead_id=lead_id,
        score=score,
        completion=completion,
        evidence_count=len(valid_evidences),
        skipped_count=skipped,
        last_analyzed_at=last_at,
    )
