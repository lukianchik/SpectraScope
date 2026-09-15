import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.api.errors import ApiProblem
from app.api.workspace import (
    list_integrations,
    list_path_reviews,
    monitoring_summary,
    update_integration,
    update_path_review,
    update_workspace_settings,
)
from app.core.config import Settings
from app.db.base import Base
from app.models import Scan
from app.schemas.workspace import (
    AttackPathReviewUpdate,
    IntegrationUpdate,
    WorkspaceSettingsUpdate,
)
from app.services.workspace_settings import effective_settings


@pytest.fixture
def db() -> Session:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_workspace_scope_is_persisted_and_applied(db: Session) -> None:
    deployment = Settings(
        ENABLE_REAL_SCANNERS=True,
        ALLOWED_TARGET_DOMAINS="example.com,example.org",
    )
    response = update_workspace_settings(
        WorkspaceSettingsUpdate(
            allowed_target_domains=["api.example.com"],
            allowed_lab_targets=[],
            default_notification_channel="dashboard",
            alert_threshold="critical",
        ),
        db,
        deployment,
    )

    assert response.allowed_target_domains == ["api.example.com"]
    assert response.alert_threshold == "critical"
    assert effective_settings(db, deployment).allowed_domain_list == ["api.example.com"]


def test_workspace_scope_cannot_expand_deployment_allowlist(db: Session) -> None:
    deployment = Settings(
        ENABLE_REAL_SCANNERS=True,
        ALLOWED_TARGET_DOMAINS="example.com",
    )

    with pytest.raises(ApiProblem) as raised:
        update_workspace_settings(
            WorkspaceSettingsUpdate(allowed_target_domains=["example.org"]),
            db,
            deployment,
        )

    assert raised.value.code == "SCOPE_EXCEEDS_DEPLOYMENT_ALLOWLIST"


def test_stale_workspace_scope_is_filtered_by_new_deployment_ceiling(db: Session) -> None:
    update_workspace_settings(
        WorkspaceSettingsUpdate(allowed_target_domains=["example.org"]),
        db,
        Settings(ENABLE_REAL_SCANNERS=False),
    )

    effective = effective_settings(
        db,
        Settings(ENABLE_REAL_SCANNERS=True, ALLOWED_TARGET_DOMAINS="example.com"),
    )

    assert effective.allowed_domain_list == []


def test_integration_state_is_persistent_and_secrets_are_not_returned(db: Session) -> None:
    integration = list_integrations(db)[0]
    updated = update_integration(
        integration.id,
        IntegrationUpdate(enabled=True, config={"webhook_url": "https://hooks.slack.com/services/secret"}),
        db,
        Settings(INTEGRATION_SECRET_KEY="i" * 64),
    )

    assert updated.enabled is True
    assert updated.status == "healthy"
    assert updated.configured_fields == ["webhook_url"]
    assert "hooks.slack.com" not in updated.model_dump_json()


def test_attack_path_reviews_are_stored_per_scan(db: Session) -> None:
    scan = Scan(target="example.com", status="completed", scan_profile="safe")
    db.add(scan)
    db.commit()

    review = update_path_review(scan.id, "surface", AttackPathReviewUpdate(reviewed=True), db)

    assert review.reviewed is True
    assert [item.step_id for item in list_path_reviews(scan.id, db)] == ["surface"]


def test_monitoring_summary_uses_real_database_counts(db: Session) -> None:
    db.add(Scan(target="example.com", status="failed", scan_profile="safe"))
    db.commit()

    summary = monitoring_summary(db, Settings(CELERY_TASK_ALWAYS_EAGER=True))

    assert summary.scans_24h == 1
    assert summary.failed_scans_24h == 1
    assert summary.queued_scans == 0
    assert any(service.name == "PostgreSQL" and service.status == "up" for service in summary.services)
