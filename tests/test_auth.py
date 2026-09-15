import time

from app.core.auth import (
    AuthenticatedUser,
    create_session,
    decode_session,
    hash_password,
    verify_password,
)
from app.core.config import Settings


def test_password_hash_is_salted_and_verifiable() -> None:
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")

    assert first != second
    assert verify_password("correct horse battery staple", first) is True
    assert verify_password("wrong password", first) is False


def test_signed_session_round_trip_and_tamper_detection() -> None:
    settings = Settings(SESSION_SECRET="a" * 64)
    token = create_session(AuthenticatedUser("operator"), settings)

    assert decode_session(token, settings) == AuthenticatedUser("operator")
    assert decode_session(token + "tampered", settings) is None


def test_expired_session_is_rejected(monkeypatch) -> None:
    settings = Settings(SESSION_SECRET="a" * 64, SESSION_TTL_SECONDS=300)
    token = create_session(AuthenticatedUser("operator"), settings)
    current = time.time()
    monkeypatch.setattr(time, "time", lambda: current + 301)

    assert decode_session(token, settings) is None
