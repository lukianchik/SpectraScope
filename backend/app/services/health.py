from sqlalchemy import text
from sqlalchemy.orm import Session
from redis import Redis

from app.core.config import get_settings
from app.core.metrics import DEPENDENCY_UP


def check_postgres(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        DEPENDENCY_UP.labels(dependency="postgres").set(0)
        return False
    DEPENDENCY_UP.labels(dependency="postgres").set(1)
    return True


def check_redis() -> bool:
    settings = get_settings()
    if settings.celery_task_always_eager:
        DEPENDENCY_UP.labels(dependency="redis").set(1)
        return True
    try:
        client = Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
    except Exception:
        DEPENDENCY_UP.labels(dependency="redis").set(0)
        return False
    DEPENDENCY_UP.labels(dependency="redis").set(1)
    return True
