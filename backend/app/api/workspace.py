from datetime import datetime, timedelta
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, status
from redis import Redis
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.errors import ApiProblem
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models import AttackPathReview, Finding, IntegrationConfig, Scan, WorkspaceSettings
from app.schemas.workspace import (
    AttackPathReviewResponse,
    AttackPathReviewUpdate,
    IntegrationResponse,
    IntegrationUpdate,
    MonitoringServiceResponse,
    MonitoringSummaryResponse,
    WorkspaceRuntimeResponse,
    WorkspaceSettingsResponse,
    WorkspaceSettingsUpdate,
)
from app.services.health import check_postgres, check_redis
from app.services.target_validation import TargetValidationError, normalize_target
from app.services.workspace_settings import WORKSPACE_ID, get_workspace_record
from app.services.integration_delivery import seal_config


router = APIRouter(prefix="/api", tags=["workspace"])

INTEGRATIONS = (
    ("Slack", "comms", "Alert routing for critical findings"),
    ("PagerDuty", "comms", "On-call escalation for high severity findings"),
    ("Jira", "ticketing", "Create remediation tickets from triaged findings"),
    ("GitHub", "ticketing", "Create issues for repository-linked findings"),
    ("Splunk", "siem", "Forward scan audit events"),
    ("AWS GuardDuty", "cloud", "Correlate cloud security findings"),
)


@router.get("/workspace/settings", response_model=WorkspaceSettingsResponse)
def get_workspace_settings(
    db: Session = Depends(get_db),
    deployment: Settings = Depends(get_settings),
) -> WorkspaceSettingsResponse:
    return _settings_response(get_workspace_record(db), deployment)


@router.put("/workspace/settings", response_model=WorkspaceSettingsResponse)
def update_workspace_settings(
    payload: WorkspaceSettingsUpdate,
    db: Session = Depends(get_db),
    deployment: Settings = Depends(get_settings),
) -> WorkspaceSettingsResponse:
    domains = [_validate_domain(item) for item in payload.allowed_target_domains]
    lab_targets = [_validate_lab_target(item) for item in payload.allowed_lab_targets]
    if deployment.enable_real_scanners and not deployment.local_real_scanners:
        _ensure_within_deployment_ceiling(domains, deployment.allowed_domain_list)
    if deployment.lab_mode or deployment.local_real_scanners:
        _ensure_exact_subset(lab_targets, deployment.allowed_lab_target_list, "lab target")

    record = get_workspace_record(db)
    if record is None:
        record = WorkspaceSettings(id=WORKSPACE_ID)
        db.add(record)
    record.allowed_target_domains = domains
    record.allowed_lab_targets = lab_targets
    record.default_notification_channel = payload.default_notification_channel
    record.alert_threshold = payload.alert_threshold
    record.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(record)
    return _settings_response(record, deployment)


@router.get("/integrations", response_model=list[IntegrationResponse])
def list_integrations(db: Session = Depends(get_db)) -> list[IntegrationResponse]:
    _ensure_integrations(db)
    items = list(db.scalars(select(IntegrationConfig).order_by(IntegrationConfig.name)))
    return [_integration_response(item) for item in items]


@router.put("/integrations/{integration_id}", response_model=IntegrationResponse)
def update_integration(
    integration_id: str,
    payload: IntegrationUpdate,
    db: Session = Depends(get_db),
    deployment: Settings = Depends(get_settings),
) -> IntegrationResponse:
    item = db.get(IntegrationConfig, integration_id)
    if item is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "INTEGRATION_NOT_FOUND", "Integration not found")
    if payload.config:
        if item.name == "Slack":
            webhook = urlparse(payload.config.get("webhook_url", ""))
            if webhook.scheme != "https" or webhook.hostname not in {"hooks.slack.com", "hooks.slack-gov.com"}:
                raise ApiProblem(
                    status.HTTP_400_BAD_REQUEST,
                    "INVALID_SLACK_WEBHOOK",
                    "Slack webhook must use the official HTTPS webhook host",
                )
        try:
            item.config_json = seal_config(payload.config, deployment)
        except ValueError as exc:
            raise ApiProblem(status.HTTP_400_BAD_REQUEST, "INTEGRATION_SECRET_KEY_REQUIRED", str(exc)) from exc
    item.enabled = payload.enabled
    item.status = "healthy" if payload.enabled and item.config_json.get("sealed") else "not_configured"
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return _integration_response(item)


@router.get(
    "/scans/{scan_id}/path-reviews",
    response_model=list[AttackPathReviewResponse],
)
def list_path_reviews(scan_id: str, db: Session = Depends(get_db)) -> list[AttackPathReview]:
    _ensure_scan(db, scan_id)
    return list(
        db.scalars(
            select(AttackPathReview)
            .where(AttackPathReview.scan_id == scan_id)
            .order_by(AttackPathReview.updated_at)
        )
    )


@router.put(
    "/scans/{scan_id}/path-reviews/{step_id}",
    response_model=AttackPathReviewResponse,
)
def update_path_review(
    scan_id: str,
    step_id: str,
    payload: AttackPathReviewUpdate,
    db: Session = Depends(get_db),
) -> AttackPathReview:
    _ensure_scan(db, scan_id)
    if not step_id.strip() or len(step_id) > 255:
        raise ApiProblem(status.HTTP_400_BAD_REQUEST, "INVALID_STEP_ID", "Invalid path step id")
    item = db.scalar(
        select(AttackPathReview)
        .where(AttackPathReview.scan_id == scan_id)
        .where(AttackPathReview.step_id == step_id)
    )
    if item is None:
        item = AttackPathReview(scan_id=scan_id, step_id=step_id)
        db.add(item)
    item.reviewed = payload.reviewed
    item.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return item


@router.get("/monitoring/summary", response_model=MonitoringSummaryResponse)
def monitoring_summary(
    db: Session = Depends(get_db),
    deployment: Settings = Depends(get_settings),
) -> MonitoringSummaryResponse:
    now = datetime.utcnow()
    since = now - timedelta(hours=24)
    scans_24h = db.scalar(select(func.count()).select_from(Scan).where(Scan.created_at >= since)) or 0
    failed_24h = db.scalar(
        select(func.count()).select_from(Scan).where(Scan.created_at >= since, Scan.status == "failed")
    ) or 0
    findings_24h = db.scalar(
        select(func.count()).select_from(Finding).where(Finding.created_at >= since)
    ) or 0
    queued = _queue_depth(deployment)
    postgres_up = check_postgres(db)
    redis_up = check_redis()
    return MonitoringSummaryResponse(
        scans_24h=scans_24h,
        findings_24h=findings_24h,
        failed_scans_24h=failed_24h,
        queued_scans=queued,
        scan_history=_daily_counts(db, Scan.created_at, now),
        finding_history=_daily_counts(db, Finding.created_at, now),
        services=[
            MonitoringServiceResponse(name="FastAPI", status="up", detail="API request completed"),
            MonitoringServiceResponse(
                name="PostgreSQL",
                status="up" if postgres_up else "down",
                detail="Database query succeeded" if postgres_up else "Database is unavailable",
            ),
            MonitoringServiceResponse(
                name="Redis broker",
                status="up" if redis_up else "down",
                detail=f"Scan queue depth: {queued}" if redis_up else "Redis is unavailable",
            ),
            MonitoringServiceResponse(
                name="Celery scans queue",
                status="warn" if queued > 10 else "up",
                detail=f"{queued} queued task(s)",
            ),
        ],
    )


def _settings_response(
    record: WorkspaceSettings | None,
    deployment: Settings,
) -> WorkspaceSettingsResponse:
    return WorkspaceSettingsResponse(
        allowed_target_domains=(record.allowed_target_domains if record else deployment.allowed_domain_list),
        allowed_lab_targets=(record.allowed_lab_targets if record else deployment.allowed_lab_target_list),
        default_notification_channel=(record.default_notification_channel if record else "dashboard"),
        alert_threshold=(record.alert_threshold if record else "high"),
        updated_at=record.updated_at if record else None,
        runtime=WorkspaceRuntimeResponse(
            app_env=deployment.app_env,
            lab_mode=deployment.lab_mode,
            enable_real_scanners=deployment.enable_real_scanners,
            local_real_scanners=deployment.local_real_scanners,
            enable_nmap=deployment.enable_nmap,
            allow_benchmark_dns_proxy=deployment.allow_benchmark_dns_proxy,
            scanner_timeout_seconds=deployment.scanner_timeout_seconds,
            scanner_max_results=deployment.scanner_max_results,
        ),
    )


def _validate_domain(value: str) -> str:
    try:
        normalized = normalize_target(value)
    except TargetValidationError as exc:
        raise ApiProblem(status.HTTP_400_BAD_REQUEST, "INVALID_DOMAIN", str(exc)) from exc
    if ":" in normalized:
        raise ApiProblem(status.HTTP_400_BAD_REQUEST, "INVALID_DOMAIN", "Domains cannot include a port")
    return normalized


def _validate_lab_target(value: str) -> str:
    try:
        return normalize_target(value)
    except TargetValidationError as exc:
        raise ApiProblem(status.HTTP_400_BAD_REQUEST, "INVALID_LAB_TARGET", str(exc)) from exc


def _ensure_within_deployment_ceiling(requested: list[str], ceiling: list[str]) -> None:
    if not ceiling and requested:
        raise ApiProblem(
            status.HTTP_400_BAD_REQUEST,
            "SCOPE_EXCEEDS_DEPLOYMENT_ALLOWLIST",
            "Deployment ALLOWED_TARGET_DOMAINS is empty",
        )
    for domain in requested:
        if not any(domain == root or domain.endswith(f".{root.lstrip('.')}") for root in ceiling):
            raise ApiProblem(
                status.HTTP_400_BAD_REQUEST,
                "SCOPE_EXCEEDS_DEPLOYMENT_ALLOWLIST",
                f"{domain} is outside the deployment allowlist",
            )


def _ensure_exact_subset(requested: list[str], ceiling: list[str], label: str) -> None:
    outside = sorted(set(requested) - set(ceiling))
    if outside:
        raise ApiProblem(
            status.HTTP_400_BAD_REQUEST,
            "SCOPE_EXCEEDS_DEPLOYMENT_ALLOWLIST",
            f"Requested {label}s are outside the deployment allowlist",
            {"outside": outside},
        )


def _ensure_integrations(db: Session) -> None:
    existing = set(db.scalars(select(IntegrationConfig.name)))
    for name, kind, description in INTEGRATIONS:
        if name not in existing:
            db.add(IntegrationConfig(name=name, kind=kind, description=description))
    db.commit()


def _integration_response(item: IntegrationConfig) -> IntegrationResponse:
    return IntegrationResponse(
        id=item.id,
        name=item.name,
        kind=item.kind,
        description=item.description,
        enabled=item.enabled,
        status=item.status,
        configured_fields=list(item.config_json.get("fields", [])),
        updated_at=item.updated_at,
    )


def _ensure_scan(db: Session, scan_id: str) -> None:
    if db.get(Scan, scan_id) is None:
        raise ApiProblem(status.HTTP_404_NOT_FOUND, "SCAN_NOT_FOUND", "Scan not found")


def _queue_depth(settings: Settings) -> int:
    if settings.celery_task_always_eager:
        return 0
    try:
        return int(Redis.from_url(settings.redis_url, socket_timeout=1).llen("scans"))
    except Exception:
        return 0


def _daily_counts(db: Session, column, now: datetime) -> list[int]:
    counts = []
    for days_ago in range(6, -1, -1):
        start = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        counts.append(
            db.scalar(select(func.count()).where(column >= start, column < end)) or 0
        )
    return counts
