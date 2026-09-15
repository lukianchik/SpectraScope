import base64
import hashlib
import json
import logging
from urllib.request import Request, urlopen
from urllib.parse import urlparse

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import IntegrationConfig, Scan


logger = logging.getLogger("app.integrations")


def seal_config(config: dict[str, str], settings: Settings) -> dict:
    if len(settings.integration_secret_key) < 32:
        raise ValueError("INTEGRATION_SECRET_KEY must contain at least 32 characters")
    token = _fernet(settings).encrypt(json.dumps(config).encode("utf-8")).decode("ascii")
    return {"sealed": token, "fields": sorted(config)}


def open_config(sealed: dict, settings: Settings) -> dict[str, str]:
    try:
        payload = _fernet(settings).decrypt(str(sealed["sealed"]).encode("ascii"))
        value = json.loads(payload)
        return {str(key): str(item) for key, item in value.items()}
    except (InvalidToken, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise ValueError("Integration credentials cannot be decrypted") from exc


def deliver_scan_notifications(db: Session, scan: Scan, settings: Settings) -> None:
    slack = db.scalar(select(IntegrationConfig).where(IntegrationConfig.name == "Slack"))
    if slack is None or not slack.enabled or not slack.config_json.get("sealed"):
        return
    try:
        webhook_url = open_config(slack.config_json, settings).get("webhook_url", "")
        parsed = urlparse(webhook_url)
        if parsed.scheme != "https" or parsed.hostname not in {"hooks.slack.com", "hooks.slack-gov.com"}:
            raise ValueError("Slack webhook URL must use an official HTTPS webhook host")
        body = json.dumps({
            "text": (
                f"SpectraScope scan completed for {scan.target}: "
                f"{len(scan.assets)} assets, {len(scan.findings)} findings."
            )
        }).encode("utf-8")
        request = Request(webhook_url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(request, timeout=5) as response:
            if response.status >= 300:
                raise RuntimeError(f"Slack returned HTTP {response.status}")
        slack.status = "healthy"
    except Exception as exc:
        logger.warning("integration_delivery_failed", extra={"integration": "Slack", "error": str(exc)[:200]})
        slack.status = "degraded"
    db.commit()


def _fernet(settings: Settings) -> Fernet:
    digest = hashlib.sha256(settings.integration_secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))
