"""Unit tests for spec 002 启动密钥校验 (T010).

Spec ref: specs/002-public-deploy-hardening/contracts/config-contracts.md § 5
         specs/002-public-deploy-hardening/spec.md FR-025
"""

import pytest


def _reload_config():
    import importlib
    import app.core.config as config
    importlib.reload(config)
    return config


def test_dev_env_skips_strict_check(monkeypatch):
    """ENV=dev 时哪怕用占位符 JWT_SECRET 也不退出"""
    monkeypatch.setenv("ENV", "dev")
    monkeypatch.setenv("JWT_SECRET", "change-me-in-production")
    config = _reload_config()

    # Should not raise
    config._assert_production_secrets()


def test_production_default_jwt_secret_raises(monkeypatch, capsys):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "change-me-in-production")
    monkeypatch.setenv("LLM_KEY_FERNET_KEY", "Z2FBQUFBQmtfZmFrZWtleQ==")
    monkeypatch.setenv("CORS_ORIGINS", "https://sfacrm.pmyangkun.com")
    config = _reload_config()

    with pytest.raises(SystemExit):
        config._assert_production_secrets()
    captured = capsys.readouterr()
    assert "JWT_SECRET" in captured.err


def test_production_missing_fernet_key_raises(monkeypatch, capsys):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "real-secret-32-chars-aaaaaaaaaaaa")
    monkeypatch.delenv("LLM_KEY_FERNET_KEY", raising=False)
    monkeypatch.setenv("CORS_ORIGINS", "https://sfacrm.pmyangkun.com")
    config = _reload_config()

    with pytest.raises(SystemExit):
        config._assert_production_secrets()
    captured = capsys.readouterr()
    assert "LLM_KEY_FERNET_KEY" in captured.err


def test_production_wildcard_cors_raises(monkeypatch, capsys):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "real-secret-32-chars-aaaaaaaaaaaa")
    monkeypatch.setenv("LLM_KEY_FERNET_KEY", "Z2FBQUFBQmtfZmFrZWtleQ==")
    monkeypatch.setenv("CORS_ORIGINS", "*")
    config = _reload_config()

    with pytest.raises(SystemExit):
        config._assert_production_secrets()
    captured = capsys.readouterr()
    assert "CORS_ORIGINS" in captured.err


def test_production_all_correct_passes(monkeypatch):
    monkeypatch.setenv("ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "real-secret-32-chars-aaaaaaaaaaaa")
    monkeypatch.setenv("LLM_KEY_FERNET_KEY", "Z2FBQUFBQmtfZmFrZWtleQ==")
    monkeypatch.setenv("CORS_ORIGINS", "https://sfacrm.pmyangkun.com")
    config = _reload_config()

    config._assert_production_secrets()  # should not raise
