from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.scan_profiles import SAFE_PROFILE, ScanProfileError, normalize_scan_profile


ScanStatus = Literal["created", "running", "completed", "failed", "cancelled"]
Severity = Literal["critical", "high", "medium", "low", "info"]
StageStatus = Literal["running", "completed", "failed"]


class StageDiagnosticResponse(BaseModel):
    stage: str
    tool: str
    status: StageStatus
    started_at: datetime
    finished_at: datetime | None = None
    duration_ms: int | None = None
    target_count: int | None = None
    result_count: int | None = None
    exit_code: int | None = None
    error: str | None = None


class ScanStartRequest(BaseModel):
    target: str = Field(min_length=3, max_length=255, examples=["example.com", "admin.lab.local:8088"])
    scan_profile: str = Field(default=SAFE_PROFILE, max_length=64)
    confirm_authorized: bool = Field(
        default=False,
        description="Must be true to confirm that you own or are authorized to assess the target.",
    )

    @field_validator("scan_profile")
    @classmethod
    def validate_scan_profile(cls, value: str) -> str:
        try:
            return normalize_scan_profile(value)
        except ScanProfileError as exc:
            raise ValueError(str(exc)) from exc


class ScanResponse(BaseModel):
    id: UUID
    target: str
    status: ScanStatus
    scan_profile: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None
    current_stage: str
    progress_percent: int
    cancellation_requested: bool
    stage_diagnostics: list[StageDiagnosticResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class AssetResponse(BaseModel):
    id: UUID
    scan_id: UUID
    hostname: str
    ip: str | None
    is_alive: bool
    http_status: int | None
    title: str | None
    technologies: list[str] | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServiceResponse(BaseModel):
    id: UUID
    asset_id: UUID
    port: int
    protocol: str
    service_name: str | None
    product: str | None
    version: str | None
    banner: str | None

    model_config = ConfigDict(from_attributes=True)


class FindingResponse(BaseModel):
    id: UUID
    scan_id: UUID
    asset_id: UUID | None
    source_tool: str
    template_id: str | None
    name: str
    severity: Severity
    description: str | None
    matched_at: str | None
    cve: str | None
    cvss: float | None
    raw_json: dict | None
    triage_status: Literal["open", "in_progress", "resolved", "accepted_risk", "false_positive"]
    assigned_to: str | None
    triage_note: str | None
    updated_at: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FindingTriageRequest(BaseModel):
    status: Literal["open", "in_progress", "resolved", "accepted_risk", "false_positive"]
    assigned_to: str | None = Field(default=None, max_length=255)
    note: str | None = Field(default=None, max_length=4000)


class RiskItemResponse(BaseModel):
    name: str | None = None
    risk: str | None = None
    severity: Severity
    score: float | None = None
    affected_assets: int | None = None
    assets: int | None = None
    source_tool: str | None = None
    template_id: str | None = None
    cve: str | None = None
    finding_ids: list[str] = Field(default_factory=list)
    asset_ids: list[str] = Field(default_factory=list)
    matched_at: str | None = None
    reason: str | None = None
    recommended_action: str | None = None


class RiskReportResponse(BaseModel):
    id: UUID
    scan_id: UUID
    summary: str
    top_risks: list[RiskItemResponse]
    recommendations: list[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScanListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[ScanResponse]


class AssetListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[AssetResponse]


class FindingListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: list[FindingResponse]


class ScanAuditLogResponse(BaseModel):
    id: UUID
    scan_id: UUID | None
    action: str
    target: str
    actor: str | None
    decision: str
    reason: str | None
    metadata_json: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
