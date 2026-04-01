"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.auth import create_access_token, verify_password
from app.core.database import get_session
from app.core.deps import get_current_user
from app.models.auth import Role, UserRole
from app.models.org import User

router = APIRouter()


class LoginRequest(BaseModel):
    login: str
    password: str


class UserInfo(BaseModel):
    id: str
    name: str
    roles: list[str]


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfo


@router.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(
        select(User).where(User.login == body.login)
    ).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect login or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is deactivated",
        )

    # Get role names
    role_ids = session.exec(
        select(UserRole.role_id).where(UserRole.user_id == user.id)
    ).all()
    roles = []
    for rid in role_ids:
        role = session.get(Role, rid)
        if role:
            roles.append(role.name)

    token = create_access_token(user.id, user.login, roles)
    return LoginResponse(
        access_token=token,
        user=UserInfo(id=user.id, name=user.name, roles=roles),
    )


@router.get("/auth/me", response_model=UserInfo)
def get_me(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    role_ids = session.exec(
        select(UserRole.role_id).where(UserRole.user_id == current_user.id)
    ).all()
    roles = []
    for rid in role_ids:
        role = session.get(Role, rid)
        if role:
            roles.append(role.name)
    return UserInfo(id=current_user.id, name=current_user.name, roles=roles)
