"""SlowAPI rate limiter — spec 002 改造为 (IP, user) 组合 key.

Spec ref: specs/002-public-deploy-hardening/research.md Decision 1
         specs/002-public-deploy-hardening/spec.md FR-006

限流粒度：
- get_ip_user_key: '{ip}:{user_id}' 组合（推荐，平衡 NAT 共用与 user 多 IP 绕过）
- get_ip_only_key: 仅 IP，未登录端点或对 IP 单独限流时使用
"""

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _get_user_id_or_anon(request: Request) -> str:
    """从 Authorization header 提取 user_id，失败 fallback 'anon'。"""
    from app.core.auth import verify_token

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        try:
            payload = verify_token(token)
            if payload and "sub" in payload:
                return str(payload["sub"])
        except Exception:
            pass
    return "anon"


def get_ip_user_key(request: Request) -> str:
    """限流 key = '{ip}:{user_id}'。未登录请求 user_id 为 'anon'。"""
    ip = get_remote_address(request) or (request.client.host if request.client else "unknown")
    user_id = _get_user_id_or_anon(request)
    return f"{ip}:{user_id}"


def get_ip_only_key(request: Request) -> str:
    """限流 key = 仅 IP。"""
    return get_remote_address(request) or (
        request.client.host if request.client else "unknown"
    )


# 向后兼容别名（spec 001 既有代码用 get_user_id_key）
get_user_id_key = get_ip_user_key

limiter = Limiter(key_func=get_ip_user_key)
