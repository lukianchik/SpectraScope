import logging
import json
from datetime import datetime, timezone
from typing import Any

from app.core.config import get_settings
from app.core.request_context import request_id_var


class RequestContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = request_id_var.get()
        if not hasattr(record, "service_name"):
            record.service_name = get_settings().service_name
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": getattr(record, "service_name", get_settings().service_name),
        }
        for key in ("request_id", "method", "path", "status_code", "duration_ms", "scan_id", "target"):
            value = getattr(record, key, None)
            if value is not None:
                payload[key] = value
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def configure_logging() -> None:
    settings = get_settings()
    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    handlers: list[logging.Handler] = [logging.StreamHandler()]
    handlers[0].addFilter(RequestContextFilter())
    if settings.log_format.lower() == "json":
        handlers[0].setFormatter(JsonFormatter())
    else:
        handlers[0].setFormatter(logging.Formatter("%(asctime)s %(levelname)s [%(name)s] %(message)s"))

    logging.basicConfig(
        level=level,
        handlers=handlers,
        force=True,
    )
