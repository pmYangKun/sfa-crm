"""Unit tests for spec 002 限流 key 改造为 (IP, user_id) 组合 (T007).

Spec ref: specs/002-public-deploy-hardening/research.md Decision 1
         specs/002-public-deploy-hardening/spec.md FR-006
"""

from unittest.mock import MagicMock


def _mock_request(ip: str, auth_header: str | None = None):
    req = MagicMock()
    req.client.host = ip
    req.headers = {}
    if auth_header is not None:
        req.headers["Authorization"] = auth_header
    return req


def test_anonymous_request_returns_ip_anon():
    """未登录请求 → '{ip}:anon' 组合 key"""
    from app.services.rate_limiter import get_ip_user_key

    req = _mock_request("203.0.113.5")
    key = get_ip_user_key(req)
    assert key == "203.0.113.5:anon"


def test_authenticated_request_returns_ip_user_combo(monkeypatch):
    """已登录请求 → '{ip}:{user_id}' 组合 key"""
    monkeypatch.setattr(
        "app.core.auth.verify_token",
        lambda token: {"sub": "user-abc-123"},
    )
    from app.services.rate_limiter import get_ip_user_key

    req = _mock_request("203.0.113.5", auth_header="Bearer fake-jwt")
    key = get_ip_user_key(req)
    assert key == "203.0.113.5:user-abc-123"


def test_invalid_token_falls_back_to_ip_only(monkeypatch):
    """无效 token → fallback 'ip:anon'，不抛异常"""
    monkeypatch.setattr("app.core.auth.verify_token", lambda token: None)
    from app.services.rate_limiter import get_ip_user_key

    req = _mock_request("198.51.100.7", auth_header="Bearer invalid-jwt")
    key = get_ip_user_key(req)
    assert key == "198.51.100.7:anon"


def test_get_ip_only_key_returns_ip(monkeypatch):
    """get_ip_only_key 返回纯 IP（保留兼容/未来场景用）"""
    from app.services.rate_limiter import get_ip_only_key

    req = _mock_request("198.51.100.7")
    assert get_ip_only_key(req) == "198.51.100.7"
