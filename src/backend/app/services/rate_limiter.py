"""SlowAPI rate limiter configured for per-user limiting."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from fastapi import Request


def get_user_id_key(request: Request) -> str:
    """Extract user ID from JWT for rate limiting key."""
    from app.core.auth import verify_token

    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        payload = verify_token(token)
        if payload and "sub" in payload:
            return payload["sub"]
    return get_remote_address(request)


limiter = Limiter(key_func=get_user_id_key)
