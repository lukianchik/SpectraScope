from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


NotificationChannel = Literal["dashboard", "slack", "email"]
AlertThreshold = Literal["info", "low", "medium", "high", "critical"]


class WorkspaceSettingsUpdate(BaseModel):
    allowed_target_domains: list[str] = Field(default_factory=list, max_length=500)
    allowed_lab_targets: list[str] = Field(default_factory=list, max_length=500)
    default_notification_channel: NotificationChannel = "dashboard"
    alert_threshold: AlertThreshold = "high"

    @field_validator("allowed_target_domains", "allowed_lab_targets")
    @classmethod
    def normalize_entries(cls, values: list[str]) -> list[str]:
        normalized = []
        for value in values:
            item = value.strip().lower()
            if item and item not in normalized:
                normalized.append(item)
        return normalized


class WorkspaceRuntimeResponse(BaseModel):
    app_env: str
    lab_mode: bool
    enable_real_scanners: bool
    local_real_scanners: bool
    enable_nmap: bool
    allow_benchmark_dns_proxy: bool
    scanner_timeout_seconds: int
    scanner_max_results: int


class WorkspaceSettingsResponse(WorkspaceSettingsUpdate):
    updated_at: datetime | None = None
    runtime: WorkspaceRuntimeResponse


class IntegrationUpdate(BaseModel):
    enabled: bool
    config: dict[str, str] = Field(default_factory=dict)

    @field_validator("config")
    @classmethod
    def bound_config(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 20:
            raise ValueError("Integration config accepts at most 20 fields")
        return {str(key)[:64]: str(item)[:2048] for key, item in value.items()}


class IntegrationResponse(BaseModel):
    id: str
    name: str
    kind: str
    description: str
    enabled: bool
    status: str
    configured_fields: list[str]
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttackPathReviewUpdate(BaseModel):
    reviewed: bool


class AttackPathReviewResponse(BaseModel):
    step_id: str
    reviewed: bool
    reviewed_by: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MonitoringServiceResponse(BaseModel):
    name: str
    status: Literal["up", "warn", "down"]
    detail: str


class MonitoringSummaryResponse(BaseModel):
    scans_24h: int
    findings_24h: int
    failed_scans_24h: int
    queued_scans: int
    scan_history: list[int]
    finding_history: list[int]
    services: list[MonitoringServiceResponse]
