from dataclasses import dataclass

from app.core.config import Settings
from app.services.target_validation import TargetValidationError, normalize_target


class TargetPolicyError(ValueError):
    pass


@dataclass(frozen=True)
class TargetPolicyDecision:
    target: str
    decision: str
    reason: str | None = None


def authorize_target(raw_target: str, confirm_authorized: bool, settings: Settings) -> TargetPolicyDecision:
    try:
        target = normalize_target(raw_target)
    except TargetValidationError as exc:
        raise TargetPolicyError(str(exc)) from exc

    if not confirm_authorized:
        raise TargetPolicyError("You must confirm that you are authorized to scan this target")

    if settings.lab_mode:
        allowed_targets = settings.allowed_lab_target_list
        if allowed_targets and target not in allowed_targets:
            raise TargetPolicyError("Target is not allowed in LAB_MODE")
        return TargetPolicyDecision(target=target, decision="allowed", reason="Allowed LAB_MODE target")

    allowed_domains = settings.allowed_domain_list
    if allowed_domains and not _matches_allowed_domain(target, allowed_domains):
        raise TargetPolicyError("Target is outside the configured allowlist")

    return TargetPolicyDecision(target=target, decision="allowed")


def _matches_allowed_domain(target: str, allowed_domains: list[str]) -> bool:
    target_hostname = target.split(":", 1)[0]
    for domain in allowed_domains:
        normalized = domain.lstrip(".")
        if target_hostname == normalized or target_hostname.endswith(f".{normalized}"):
            return True
    return False
