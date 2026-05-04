"""Unit tests for spec 002 Fernet 加解密包装 (T008).

Spec ref: specs/002-public-deploy-hardening/data-model.md § 4
         specs/002-public-deploy-hardening/contracts/config-contracts.md § 2.2
"""

import os

import pytest


def test_encrypt_decrypt_roundtrip(monkeypatch):
    monkeypatch.setenv("LLM_KEY_FERNET_KEY", "")
    monkeypatch.setenv("ENV", "dev")
    # Reload module so it picks up env
    from app.core import security
    import importlib
    importlib.reload(security)

    plaintext = "sk-ant-real-secret-key-1234567890"
    ciphertext = security.encrypt_api_key(plaintext)
    assert ciphertext != plaintext
    assert ciphertext.startswith("gAAAAA")
    assert security.decrypt_api_key(ciphertext) == plaintext


def test_decrypt_raises_on_wrong_key(monkeypatch):
    monkeypatch.setenv("ENV", "dev")
    from cryptography.fernet import Fernet, InvalidToken

    monkeypatch.setenv("LLM_KEY_FERNET_KEY", Fernet.generate_key().decode())
    from app.core import security
    import importlib
    importlib.reload(security)
    ciphertext = security.encrypt_api_key("hello")

    # rotate to a different key
    monkeypatch.setenv("LLM_KEY_FERNET_KEY", Fernet.generate_key().decode())
    importlib.reload(security)
    with pytest.raises(InvalidToken):
        security.decrypt_api_key(ciphertext)


def test_dev_fallback_emits_warning(monkeypatch, caplog):
    """dev 环境缺 LLM_KEY_FERNET_KEY → fallback + warning，不退出"""
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.delenv("LLM_KEY_FERNET_KEY", raising=False)

    import importlib

    import app.core.security as security
    importlib.reload(security)

    with caplog.at_level("WARNING"):
        f = security.get_fernet()
    assert f is not None
    assert any("LLM_KEY_FERNET_KEY" in r.message for r in caplog.records)


def test_production_missing_fernet_key_raises_systemexit(monkeypatch):
    """ENV=production + 缺 LLM_KEY_FERNET_KEY → SystemExit"""
    monkeypatch.setenv("ENV", "production")
    monkeypatch.delenv("LLM_KEY_FERNET_KEY", raising=False)

    import importlib
    import app.core.security as security
    importlib.reload(security)

    with pytest.raises(SystemExit):
        security.get_fernet()
