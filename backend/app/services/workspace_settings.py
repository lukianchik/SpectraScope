from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import WorkspaceSettings


WORKSPACE_ID = "default"


def get_workspace_record(db: Session) -> WorkspaceSettings | None:
    return db.get(WorkspaceSettings, WORKSPACE_ID)


def effective_settings(db: Session, deployment: Settings) -> Settings:
    record = get_workspace_record(db)
    if record is None:
        return deployment

    target_domains = record.allowed_target_domains or deployment.allowed_domain_list
    lab_targets = record.allowed_lab_targets or deployment.allowed_lab_target_list
    if deployment.enable_real_scanners and not deployment.local_real_scanners:
        target_domains = [
            domain
            for domain in target_domains
            if any(domain == root or domain.endswith(f".{root.lstrip('.')}") for root in deployment.allowed_domain_list)
        ]
    if deployment.lab_mode or deployment.local_real_scanners:
        lab_targets = [target for target in lab_targets if target in deployment.allowed_lab_target_list]
    return deployment.model_copy(
        update={
            "allowed_target_domains": ",".join(target_domains),
            "allowed_lab_targets": ",".join(lab_targets),
        }
    )
