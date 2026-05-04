"""Unit tests for spec 002 new SystemConfig default values.

Spec ref: specs/002-public-deploy-hardening/data-model.md § 3
         + specs/002-public-deploy-hardening/contracts/config-contracts.md § 1
"""

import json

from app.core.init_db import DEFAULT_CONFIGS


def _config_dict() -> dict[str, str]:
    """Return DEFAULT_CONFIGS as {key: value} dict for assertion convenience."""
    return {key: value for key, value, _desc in DEFAULT_CONFIGS}


def test_llm_user_minute_limit_present_with_default():
    cfg = _config_dict()
    assert "llm_user_minute_limit" in cfg
    assert cfg["llm_user_minute_limit"] == "10"


def test_llm_user_daily_limit_present_with_default():
    cfg = _config_dict()
    assert "llm_user_daily_limit" in cfg
    assert cfg["llm_user_daily_limit"] == "100"


def test_llm_global_hourly_limit_present_with_default():
    cfg = _config_dict()
    assert "llm_global_hourly_limit" in cfg
    assert cfg["llm_global_hourly_limit"] == "200"


def test_demo_reset_enabled_present_default_true():
    cfg = _config_dict()
    assert "demo_reset_enabled" in cfg
    assert cfg["demo_reset_enabled"] == "true"


def test_demo_reset_interval_minutes_present_default_30():
    cfg = _config_dict()
    assert "demo_reset_interval_minutes" in cfg
    assert cfg["demo_reset_interval_minutes"] == "30"


def test_prompt_guard_keywords_is_valid_json_array():
    cfg = _config_dict()
    assert "prompt_guard_keywords" in cfg
    keywords = json.loads(cfg["prompt_guard_keywords"])
    assert isinstance(keywords, list)
    assert all(isinstance(k, str) for k in keywords)


def test_prompt_guard_keywords_covers_typical_jailbreaks():
    """词表必须覆盖中英文典型 jailbreak 关键词（spec FR-002 + research Decision 3）"""
    cfg = _config_dict()
    keywords = json.loads(cfg["prompt_guard_keywords"])
    keywords_lower = [k.lower() for k in keywords]

    must_have = [
        "忽略上述",
        "ignore previous",
        "system prompt",
        "扮演",
        "jailbreak",
        "developer mode",
    ]
    for needle in must_have:
        assert any(needle.lower() in k for k in keywords_lower), (
            f"prompt_guard_keywords 缺少'{needle}'类关键词"
        )


def test_no_duplicate_keys_in_default_configs():
    keys = [k for k, _, _ in DEFAULT_CONFIGS]
    assert len(keys) == len(set(keys)), f"DEFAULT_CONFIGS 含重复 key: {keys}"
