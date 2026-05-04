"""Unit tests for spec 002 llm_call_counter model (T005).

Spec ref: specs/002-public-deploy-hardening/data-model.md § 2
"""


def test_llm_call_counter_model_imports():
    from app.models.llm_call_counter import LLMCallCounter

    assert LLMCallCounter.__tablename__ == "llm_call_counter"


def test_llm_call_counter_fields():
    from app.models.llm_call_counter import LLMCallCounter

    instance = LLMCallCounter(hour_bucket="2026050414", count=42)
    assert instance.hour_bucket == "2026050414"
    assert instance.count == 42


def test_llm_call_counter_count_default_zero():
    from app.models.llm_call_counter import LLMCallCounter

    instance = LLMCallCounter(hour_bucket="2026050415")
    assert instance.count == 0


def test_llm_call_counter_updated_at_auto_set():
    from app.models.llm_call_counter import LLMCallCounter

    instance = LLMCallCounter(hour_bucket="2026050416")
    assert instance.updated_at is not None
