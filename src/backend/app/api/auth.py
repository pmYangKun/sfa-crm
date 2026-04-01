from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.auth import create_access_token, verify_password
from app.core.database import get_session
from app.models.auth import Role, UserRole
from app.models.org import User

router = APIRouter()


class LoginRequest(BaseModel):
    login: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    roles: list[str]  # role names, e.g. ["销售", "战队队长"]


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.login == body.login)).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已停用",
        )
    token = create_access_token(user.id)
    role_ids = session.exec(select(UserRole.role_id).where(UserRole.user_id == user.id)).all()
    role_names = [
        r.name for r in session.exec(select(Role).where(Role.id.in_(role_ids))).all()  # type: ignore[attr-defined]
    ] if role_ids else []
    return LoginResponse(access_token=token, user_id=user.id, name=user.name, roles=role_names)
