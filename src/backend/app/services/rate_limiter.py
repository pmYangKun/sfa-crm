"""
User-ID-based rate limiter for claim actions.

Extracts user ID from JWT Authorization header so limits apply per user,
not per IP (multiple users may share the same NAT IP).
"""
from slowapi import Limiter
from starlette.requests import Request

from app.core.auth import decode_access_token


def _get_user_id(request: Request) -> str:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            return decode_access_token(auth[7:])
        except Exception:
            pass
    return request.client.host if request.client else "unknown"


user_limiter = Limiter(key_func=_get_user_id)
