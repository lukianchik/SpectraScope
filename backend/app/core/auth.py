import base64
import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass

from fastapi import Depends, Request, status

from app.api.errors import ApiProblem
from app.core.config import Settings, get_settings


SESSION_COOKIE = "spectrascope_session"
PBKDF2_ITERATIONS = 600_000


@dataclass(frozen=True)
class AuthenticatedUser:
    username: str
    role: str = "admin"


def hash_password(password: str, salt: str | None = None) -> str:
    if len(password) < 12:
        raise ValueError("Password must contain at least 12 characters")
    actual_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        actual_salt.encode("ascii"),
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${actual_salt}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected = encoded.split("$", 3)
        if algorithm != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("ascii"),
            int(iterations),
        )
        return hmac.compare_digest(digest.hex(), expected)
    except (TypeError, ValueError):
        return False


def create_session(user: AuthenticatedUser, settings: Settings) -> str:
    payload = {
        "sub": user.username,
        "role": user.role,
        "exp": int(time.time()) + settings.session_ttl_seconds,
    }
    body = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signature = _sign(body, settings.session_secret)
    return f"{body}.{signature}"


def decode_session(token: str, settings: Settings) -> AuthenticatedUser | None:
    try:
        body, signature = token.split(".", 1)
        if not hmac.compare_digest(signature, _sign(body, settings.session_secret)):
            return None
        payload = json.loads(_b64decode(body))
        if int(payload["exp"]) <= int(time.time()):
            return None
        return AuthenticatedUser(username=str(payload["sub"]), role=str(payload["role"]))
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


def require_user(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if not settings.auth_required:
        return AuthenticatedUser(username="local-operator")
    token = request.cookies.get(SESSION_COOKIE)
    authorization = request.headers.get("authorization", "")
    if not token and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    user = decode_session(token or "", settings)
    if user is None:
        raise ApiProblem(status.HTTP_401_UNAUTHORIZED, "AUTHENTICATION_REQUIRED", "Sign in required")
    return user


def _sign(body: str, secret: str) -> str:
    return _b64encode(hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())


def _b64encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _b64decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
