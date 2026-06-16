from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ScanProfile = Literal["discovery", "safe", "lab"]
ScanStatus = Literal["created", "running", "completed", "failed"]
Severity = Literal["critical", "high", "medium", "low", "info"]


class ScanStartRequest(BaseModel):
    target: str = Field(min_length=3, max_length=255, examples=["example.com", "admin.lab.local:8088"])
    scan_profile: ScanProfile = Field(default="safe")
    confirm_authorized: bool = Field(
        default=False,
        description="Must be true to confirm that you own or are authorized to assess the target.",
    )


class ScanResponse(BaseModel):
    id: UUID
    target: str
    status: ScanStatus
    scan_profile: str
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    error_message: str | None

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
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RiskReportResponse(BaseModel):
    id: UUID
    scan_id: UUID
    summary: str
    top_risks: list[dict]
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
