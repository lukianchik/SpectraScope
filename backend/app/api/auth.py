import hmac

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Response, status

from app.api.errors import ApiProblem
from app.core.auth import (
    SESSION_COOKIE,
    AuthenticatedUser,
    create_session,
    require_user,
    verify_password,
)
from app.core.config import Settings, get_settings


router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=1024)


class SessionResponse(BaseModel):
    username: str
    role: str
    authentication_required: bool


@router.post("/login", response_model=SessionResponse)
def login(payload: LoginRequest, response: Response, settings: Settings = Depends(get_settings)) -> SessionResponse:
    if not settings.auth_required:
        return SessionResponse(username="local-operator", role="admin", authentication_required=False)
    username_ok = hmac.compare_digest(payload.username, settings.auth_username)
    if not username_ok or not verify_password(payload.password, settings.auth_password_hash):
        raise ApiProblem(status.HTTP_401_UNAUTHORIZED, "INVALID_CREDENTIALS", "Invalid credentials")
    user = AuthenticatedUser(username=settings.auth_username)
    response.set_cookie(
        SESSION_COOKIE,
        create_session(user, settings),
        max_age=settings.session_ttl_seconds,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="strict",
        path="/",
    )
    return SessionResponse(username=user.username, role=user.role, authentication_required=True)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> Response:
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=SessionResponse)
def me(
    user: AuthenticatedUser = Depends(require_user),
    settings: Settings = Depends(get_settings),
) -> SessionResponse:
    return SessionResponse(
        username=user.username,
        role=user.role,
        authentication_required=settings.auth_required,
    )
