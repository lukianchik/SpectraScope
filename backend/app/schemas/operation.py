from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


OperationStatus = Literal["ready", "running", "awaiting_approval", "completed", "aborted"]
OperationAction = Literal[
    "start",
    "map_surface",
    "correlate_exposure",
    "approve_path",
    "complete",
    "abort",
]


class ScopeManifestResponse(BaseModel):
    allowed_targets: list[str]
    source_scan_id: UUID
    scan_profile: str
    simulation_only: bool
    active_actions: bool
    expires_at: datetime


class OperationCreateRequest(BaseModel):
    scan_id: UUID
    confirm_authorized: bool = Field(
        default=False,
        description="Confirms authorization for the exact target captured by the source scan.",
    )


class OperationTransitionRequest(BaseModel):
    action: OperationAction
    confirm_human: bool = False


class OperationEventResponse(BaseModel):
    id: UUID
    sequence: int
    event_type: str
    phase: str
    decision: str | None
    message: str
    metadata_json: dict | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OperationResponse(BaseModel):
    id: UUID
    scan_id: UUID | None
    target: str
    status: OperationStatus
    current_phase: str
    scope_manifest: ScopeManifestResponse
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None
    events: list[OperationEventResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class OperationListResponse(BaseModel):
    total: int
    items: list[OperationResponse]
