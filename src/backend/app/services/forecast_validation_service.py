"""Forecast validation service — spec 004 §6.

调 LLM 校验销售/经理把 forecast_category 改到"必赢/大概率"是否站得住脚。

设计要点：
- 3 秒 timeout（超时返 abstain，前端放行）
- 60 秒 in-process cache（lead_id+target 命中直接返）
- LLM 输出 schema：verdict ∈ {support, challenge, abstain}, reasoning, suggested_category, missing_dimensions
- 上游接 spec 002 限流（API 层做）+ 熔断（API 层做）
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from dataclasses import dataclass, field
from typing import Optional

import httpx
from sqlmodel import Session, select

from app.models.lead import Lead
from app.models.lead_meddicc_evidence import DIMENSIONS, LeadMeddiccEvidence
from app.models.llm_config import LLMConfig

logger = logging.getLogger(__name__)


VALID_VERDICTS = ("support", "challenge", "abstain")
VALIDATABLE_TARGETS = ("必赢", "大概率")
LLM_TIMEOUT_SECONDS = 3.0
CACHE_TTL_SECONDS = 60

# Dimension key → 中文 label（用于 missing_dimensions 输出）
DIM_CN = {
    "metrics": "Metrics（量化指标）",
    "economic_buyer": "Economic Buyer（决策人）",
    "decision_criteria": "Decision Criteria（决策标准）",
    "decision_process": "Decision Process（决策流程）",
    "pain": "Pain（痛点）",
    "champion": "Champion（内部支持者）",
    "competition": "Competition（竞争）",
}


@dataclass
class ValidationResult:
    verdict: str  # support | challenge | abstain
    reasoning: str
    suggested_category: Optional[str] = None
    missing_dimensions: list[str] = field(default_factory=list)
    cached: bool = False
    timed_out: bool = False

    def to_dict(self) -> dict:
        return {
            "verdict": self.verdict,
            "reasoning": self.reasoning,
            "suggested_category": self.suggested_category,
            "missing_dimensions": self.missing_dimensions,
            "cached": self.cached,
            "timed_out": self.timed_out,
        }


# ── In-process cache ─────────────────────────────────────────────────────────

_cache: dict[str, tuple[float, ValidationResult]] = {}
_cache_lock = threading.Lock()


def _cache_key(lead_id: str, target: str) -> str:
    return f"{lead_id}|{target}"


def _cache_get(lead_id: str, target: str) -> Optional[ValidationResult]:
    key = _cache_key(lead_id, target)
    with _cache_lock:
        item = _cache.get(key)
        if not item:
            return None
        expires, res = item
        if time.time() > expires:
            _cache.pop(key, None)
            return None
        # Return a copy with cached=True
        return ValidationResult(
            verdict=res.verdict,
            reasoning=res.reasoning,
            suggested_category=res.suggested_category,
            missing_dimensions=list(res.missing_dimensions),
            cached=True,
        )


def _cache_set(lead_id: str, target: str, res: ValidationResult) -> None:
    key = _cache_key(lead_id, target)
    with _cache_lock:
        _cache[key] = (time.time() + CACHE_TTL_SECONDS, res)


def clear_cache() -> None:
    """测试用：清空 cache."""
    with _cache_lock:
        _cache.clear()


# ── Prompt construction ─────────────────────────────────────────────────────


def _build_system_prompt(user_role: str) -> str:
    role_hint = {
        "manager": "你正在帮一位销售经理做团队商机过程管理诊断，文案侧重双保险 + 反查销售吹牛。",
        "sales": "你正在帮一位销售做自我检查，文案侧重自检 + 提醒，避免严厉打击。",
    }.get(user_role, "你正在做销售辅导诊断。")
    return f"""你是 SFA CRM 的销售辅导 AI（spec 004）。

{role_hint}

【任务】
用户要把这条 lead 的 forecast_category 改到 "{{target_category}}"。请基于 MEDDICC 7 维证据 + 跟进记录，判断这个判断站不站得住脚。

【输出格式】
严格 JSON，无 markdown 包裹：
{{{{
  "verdict": "support" | "challenge" | "abstain",
  "reasoning": "中文，2-3 句话",
  "suggested_category": "进行中" | "必赢" | "大概率" | "乐观估算" | null,
  "missing_dimensions": ["Metrics", "Champion", ...]
}}}}

【判断准则】
- 若 MEDDICC 7 维亮灯 ≥5 + 有 champion 证据 → support
- 若亮灯 <3 或 无 champion 无 economic_buyer → challenge（建议降到"大概率"或"乐观估算"）
- 若上下文太薄无法判断 → abstain
- reasoning 中文简洁，不要超过 80 字
- missing_dimensions 给出尚无证据的维度名"""


def _build_user_prompt(
    lead: Lead,
    target_category: str,
    evidences: list[LeadMeddiccEvidence],
) -> str:
    parts = [
        f"线索：{lead.company_name}（stage={lead.stage}, 当前 forecast={lead.forecast_category}, "
        f"金额={lead.amount}, close_date={lead.close_date}）",
        f"目标 forecast_category：{target_category}",
        f"MEDDICC Score：{lead.meddicc_score}, completion={lead.meddicc_completion}/7",
        "",
        "MEDDICC 已收集证据：",
    ]
    by_dim: dict[str, list[str]] = {d: [] for d in DIMENSIONS}
    for ev in evidences:
        if ev.dimension in by_dim:
            by_dim[ev.dimension].append(ev.evidence_text)
    for d in DIMENSIONS:
        items = by_dim[d]
        if items:
            parts.append(f"- {DIM_CN.get(d, d)}: {len(items)} 条 — {' | '.join(items[:3])}")
        else:
            parts.append(f"- {DIM_CN.get(d, d)}: ❌ 无证据")
    return "\n".join(parts)


def _strip_markdown_fence(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


# ── LLM call ────────────────────────────────────────────────────────────────


def _call_llm(
    system_prompt: str,
    user_prompt: str,
    db: Session,
    timeout: float = LLM_TIMEOUT_SECONDS,
) -> Optional[str]:
    """同步调 LLM；timeout 超时抛 httpx.TimeoutException 由调用方捕获."""
    cfg = db.exec(select(LLMConfig).where(LLMConfig.is_active == True)).first()  # noqa: E712
    if not cfg:
        return None

    api_key = cfg.api_key_decrypted if hasattr(cfg, "api_key_decrypted") else cfg.api_key

    if "deepseek" in (cfg.provider or "").lower():
        url = "https://api.deepseek.com/chat/completions"
        body = {
            "model": cfg.model or "deepseek-chat",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 500,
            "response_format": {"type": "json_object"},
        }
    else:
        api_base = getattr(cfg, "api_base", None) or "https://api.openai.com/v1"
        url = f"{api_base}/chat/completions"
        body = {
            "model": cfg.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 500,
        }

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()
    text = data["choices"][0]["message"]["content"]
    return _strip_markdown_fence(text)


def _parse_llm_response(text: str) -> ValidationResult:
    """解析 LLM 返回 JSON → ValidationResult；非法字段 fallback 到 abstain."""
    try:
        parsed = json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return ValidationResult(verdict="abstain", reasoning="AI 返回格式异常，已放行")
    if not isinstance(parsed, dict):
        return ValidationResult(verdict="abstain", reasoning="AI 返回格式异常，已放行")

    verdict = parsed.get("verdict")
    if verdict not in VALID_VERDICTS:
        verdict = "abstain"

    reasoning = str(parsed.get("reasoning") or "")[:300]

    suggested = parsed.get("suggested_category")
    if suggested and suggested not in ("进行中", "必赢", "大概率", "乐观估算", "已赢单", "已丢单"):
        suggested = None

    missing = parsed.get("missing_dimensions") or []
    if not isinstance(missing, list):
        missing = []
    missing = [str(x) for x in missing[:7]]

    return ValidationResult(
        verdict=verdict,
        reasoning=reasoning,
        suggested_category=suggested,
        missing_dimensions=missing,
    )


# ── Public entry ─────────────────────────────────────────────────────────────


def validate_forecast(
    lead_id: str,
    target_category: str,
    db: Session,
    *,
    user_role: str = "sales",
    use_cache: bool = True,
) -> ValidationResult:
    """对一条 lead 的 forecast_category 升级做 AI 校验.

    Args:
        lead_id: Lead UUID
        target_category: 目标 category，必须 ∈ ('必赢', '大概率')
        db: SQLModel session
        user_role: 'sales' | 'manager'
        use_cache: 是否用 in-process 60s cache（默认 True）

    Returns:
        ValidationResult；超时 / 失败一律 fallback 到 abstain
    Raises:
        ValueError 如果 target_category 不在合法值内
    """
    if target_category not in VALIDATABLE_TARGETS:
        raise ValueError(
            f"target_category 必须是 {VALIDATABLE_TARGETS} 之一，收到 {target_category}"
        )

    if use_cache:
        cached = _cache_get(lead_id, target_category)
        if cached is not None:
            return cached

    lead = db.get(Lead, lead_id)
    if lead is None:
        return ValidationResult(verdict="abstain", reasoning="线索不存在，已放行")

    evidences = list(db.exec(
        select(LeadMeddiccEvidence).where(LeadMeddiccEvidence.lead_id == lead_id)
    ).all())

    sys_p = _build_system_prompt(user_role).replace("{target_category}", target_category)
    user_p = _build_user_prompt(lead, target_category, evidences)

    try:
        text = _call_llm(sys_p, user_p, db, timeout=LLM_TIMEOUT_SECONDS)
    except httpx.TimeoutException:
        logger.info("forecast validate LLM timed out for lead %s", lead_id)
        return ValidationResult(
            verdict="abstain",
            reasoning="AI 暂时校验不上，已放行",
            timed_out=True,
        )
    except Exception as e:
        logger.warning("forecast validate LLM error: %s", e)
        return ValidationResult(verdict="abstain", reasoning="AI 暂时校验不上，已放行")

    if not text:
        return ValidationResult(verdict="abstain", reasoning="AI 未返回有效内容，已放行")

    result = _parse_llm_response(text)
    if use_cache:
        _cache_set(lead_id, target_category, result)
    return result
