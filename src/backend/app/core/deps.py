"""FastAPI dependency injection: authentication and permission checks."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.core.auth import verify_token
from app.core.database import get_session
from app.models.auth import Permission, RolePermission, UserRole
from app.models.org import User

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    payload = verify_token(credentials.credentials)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    user_id = payload.get("sub")
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return user


def require_permission(code: str):
    """Return a FastAPI dependency that checks if the current user has
    the specified permission code (e.g. 'lead.create')."""

    def checker(
        current_user: User = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> User:
        # Get all role IDs for the user
        user_roles = session.exec(
            select(UserRole.role_id).where(UserRole.user_id == current_user.id)
        ).all()
        if not user_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERMISSION_DENIED", "message": "无功能权限"},
            )

        # Find the permission by code
        permission = session.exec(
            select(Permission).where(Permission.code == code)
        ).first()
        if permission is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERMISSION_DENIED", "message": f"Permission not found: {code}"},
            )

        # Check if any of the user's roles has this permission
        has_perm = session.exec(
            select(RolePermission).where(
                RolePermission.role_id.in_(user_roles),
                RolePermission.permission_id == permission.id,
            )
        ).first()
        if has_perm is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "PERMISSION_DENIED", "message": "无功能权限"},
            )
        return current_user

    return checker


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
