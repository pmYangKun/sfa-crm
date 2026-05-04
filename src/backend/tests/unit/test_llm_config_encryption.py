"""Unit tests for spec 002 LLMConfig.api_key Fernet 透明加解密 (T009).

Spec ref: specs/002-public-deploy-hardening/data-model.md § 4
         specs/002-public-deploy-hardening/spec.md FR-027
"""

import pytest


def _setup_dev_fernet(monkeypatch):
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.delenv("LLM_KEY_FERNET_KEY", raising=False)
    from app.core import security
    import importlib
    importlib.reload(security)
    security.reset_fernet_cache()


def test_set_api_key_stores_ciphertext(monkeypatch):
    _setup_dev_fernet(monkeypatch)
    from app.models.llm_config import LLMConfig

    config = LLMConfig(provider="anthropic", model="claude-3-5-sonnet", api_key="placeholder")
    config.set_api_key("sk-ant-real-secret-1234567890")

    assert config.api_key.startswith("gAAAAA"), "api_key 应该是 Fernet 密文"
    assert config.api_key != "sk-ant-real-secret-1234567890"


def test_api_key_decrypted_returns_plaintext(monkeypatch):
    _setup_dev_fernet(monkeypatch)
    from app.models.llm_config import LLMConfig

    config = LLMConfig(provider="anthropic", model="x", api_key="placeholder")
    config.set_api_key("sk-ant-real-secret-key-9876")

    assert config.api_key_decrypted == "sk-ant-real-secret-key-9876"


def test_api_key_decrypted_on_unencrypted_falls_back(monkeypatch):
    """既有明文数据（迁移前）→ api_key_decrypted 应返回原值不抛异常"""
    _setup_dev_fernet(monkeypatch)
    from app.models.llm_config import LLMConfig

    # 模拟"老明文数据"——直接构造未加密的 api_key
    config = LLMConfig(provider="anthropic", model="x", api_key="sk-old-plaintext-key")
    # api_key 不是 gAAAAA 开头 → 视为未加密 fallback 返回原值
    assert config.api_key_decrypted == "sk-old-plaintext-key"


def test_set_api_key_idempotent(monkeypatch):
    """重复 set_api_key 同一明文 → 每次产生不同密文（Fernet 含时间戳/IV），
    但解密回来都是同样明文"""
    _setup_dev_fernet(monkeypatch)
    from app.models.llm_config import LLMConfig

    c1 = LLMConfig(provider="anthropic", model="x", api_key="placeholder")
    c1.set_api_key("hello")
    c2 = LLMConfig(provider="anthropic", model="x", api_key="placeholder")
    c2.set_api_key("hello")

    assert c1.api_key != c2.api_key  # 密文不同（含 IV）
    assert c1.api_key_decrypted == c2.api_key_decrypted == "hello"
