"""
Uniqueness detection for Lead creation.

Returns:
  - "ok"      → no duplicate found, proceed
  - "warn"    → similar name found (fuzzy), warn manager but allow
  - "blocked" → exact unified_code match, reject
"""
import re
from typing import Literal

from rapidfuzz import fuzz
from sqlmodel import Session, select

from app.models.lead import Lead

# Legal suffixes to strip before fuzzy comparison
_LEGAL_SUFFIXES = re.compile(
    r"(有限公司|有限责任公司|股份有限公司|集团有限公司|集团|公司)$"
)
_FUZZY_THRESHOLD = 85  # 85 % similarity → warn


def _normalize(name: str) -> str:
    """Strip legal suffixes and whitespace for fuzzy comparison."""
    return _LEGAL_SUFFIXES.sub("", name.strip())


CheckResult = Literal["ok", "warn", "blocked"]


def check_uniqueness(
    session: Session,
    company_name: str,
    unified_code: str | None,
) -> tuple[CheckResult, str | None]:
    """
    Returns (result, duplicate_lead_id | None).
    Caller uses result to decide HTTP status (201 / 202 / 409).
    """
    # 1. Exact unified_code match — hard block
    if unified_code:
        existing = session.exec(
            select(Lead).where(
                Lead.unified_code == unified_code,
                Lead.stage != "lost",
            )
        ).first()
        if existing:
            return "blocked", existing.id

    # 2. Fuzzy name match — soft warn
    active_leads = session.exec(
        select(Lead).where(Lead.stage == "active")
    ).all()
    norm_new = _normalize(company_name)
    for lead in active_leads:
        norm_existing = _normalize(lead.company_name)
        score = fuzz.token_sort_ratio(norm_new, norm_existing)
        if score >= _FUZZY_THRESHOLD:
            return "warn", lead.id

    return "ok", None
