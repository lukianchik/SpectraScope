from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


ScanStatus = Literal["created", "running", "completed", "failed"]
Severity = Literal["critical", "high", "medium", "low", "info"]


class ScanStartRequest(BaseModel):
    target: str = Field(min_length=3, max_length=255, examples=["example.com"])
    scan_profile: str = Field(default="safe", max_length=64)


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
