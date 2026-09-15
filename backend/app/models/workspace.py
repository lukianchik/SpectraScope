from datetime import datetime
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WorkspaceSettings(Base):
    __tablename__ = "workspace_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    allowed_target_domains: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    allowed_lab_targets: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    default_notification_channel: Mapped[str] = mapped_column(
        String(32), nullable=False, default="dashboard"
    )
    alert_threshold: Mapped[str] = mapped_column(String(16), nullable=False, default="high")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class IntegrationConfig(Base):
    __tablename__ = "integration_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="not_configured")
    config_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class AttackPathReview(Base):
    __tablename__ = "attack_path_reviews"
    __table_args__ = (
        UniqueConstraint("scan_id", "step_id", name="uq_attack_path_review_step"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    scan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("scans.id"), nullable=False, index=True
    )
    step_id: Mapped[str] = mapped_column(String(255), nullable=False)
    reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reviewed_by: Mapped[str] = mapped_column(String(255), nullable=False, default="local-operator")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )
