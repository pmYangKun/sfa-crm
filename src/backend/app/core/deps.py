from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlmodel import Session, select

from app.core.auth import decode_access_token
from app.core.database import get_session
from app.models.auth import Permission, RolePermission, UserRole
from app.models.org import User

bearer = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer)],
    session: Annotated[Session, Depends(get_session)],
) -> User:
    try:
        user_id = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = session.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_permission(permission_code: str):
    """Returns a FastAPI dependency that checks the current user has the given permission."""

    def _check(
        current_user: Annotated[User, Depends(get_current_user)],
        session: Annotated[Session, Depends(get_session)],
    ) -> User:
        role_ids = session.exec(
            select(UserRole.role_id).where(UserRole.user_id == current_user.id)
        ).all()

        if not role_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No roles assigned")

        permission = session.exec(
            select(Permission).where(Permission.code == permission_code)
        ).first()
        if not permission:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission not found")

        has_perm = session.exec(
            select(RolePermission).where(
                RolePermission.role_id.in_(role_ids),
                RolePermission.permission_id == permission.id,
            )
        ).first()

        if not has_perm:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission denied")

        return current_user

    return _check
