"""Lead uniqueness detection: exact match on unified_code + fuzzy match on company name."""

import re

from rapidfuzz import fuzz
from sqlmodel import Session, select

from app.models.lead import Lead

LEGAL_SUFFIXES = [
    "有限责任公司", "股份有限公司", "有限公司", "集团有限公司",
    "集团股份有限公司", "集团", "控股", "公司",
]

SUFFIX_PATTERN = re.compile(
    "(" + "|".join(re.escape(s) for s in sorted(LEGAL_SUFFIXES, key=len, reverse=True)) + ")$"
)


def strip_legal_suffix(name: str) -> str:
    return SUFFIX_PATTERN.sub("", name).strip()


def check_uniqueness(
    session: Session,
    company_name: str,
    unified_code: str | None,
    threshold: int = 85,
) -> dict:
    """Check for duplicate leads.

    Returns:
        {"status": "ok"} — no duplicates
        {"status": "exact", "existing_lead": Lead, "owner_name": str} — exact match on unified_code
        {"status": "similar", "similar_leads": list} — fuzzy match above threshold
    """
    # 1. Exact match on unified_code
    if unified_code:
        existing = session.exec(
            select(Lead).where(Lead.unified_code == unified_code)
        ).first()
        if existing:
            from app.models.org import User
            owner = session.get(User, existing.owner_id) if existing.owner_id else None
            return {
                "status": "exact",
                "existing_lead": existing,
                "owner_name": owner.name if owner else "公共池",
            }

    # 2. Fuzzy match on company name
    stripped_input = strip_legal_suffix(company_name)
    all_leads = session.exec(select(Lead).where(Lead.stage == "active")).all()

    similar: list[dict] = []
    for lead in all_leads:
        stripped_existing = strip_legal_suffix(lead.company_name)
        score = max(
            fuzz.ratio(stripped_input, stripped_existing),
            fuzz.partial_ratio(stripped_input, stripped_existing),
        )
        if score >= threshold:
            similar.append({"lead": lead, "score": score})

    if similar:
        similar.sort(key=lambda x: x["score"], reverse=True)
        return {"status": "similar", "similar_leads": similar[:5]}

    return {"status": "ok"}
