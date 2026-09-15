from typing import Literal, cast

from app.core.config import Settings

ScanProfileName = Literal["discovery", "safe", "lab", "local-real"]

DISCOVERY_PROFILE: ScanProfileName = "discovery"
SAFE_PROFILE: ScanProfileName = "safe"
LAB_PROFILE: ScanProfileName = "lab"
LOCAL_REAL_PROFILE: ScanProfileName = "local-real"
SUPPORTED_SCAN_PROFILES: tuple[ScanProfileName, ...] = (
    DISCOVERY_PROFILE,
    SAFE_PROFILE,
    LAB_PROFILE,
    LOCAL_REAL_PROFILE,
)


class ScanProfileError(ValueError):
    pass


def normalize_scan_profile(value: str) -> ScanProfileName:
    normalized = value.strip().lower()
    if normalized not in SUPPORTED_SCAN_PROFILES:
        supported = ", ".join(SUPPORTED_SCAN_PROFILES)
        raise ScanProfileError(f"Unsupported scan_profile '{value}'. Supported profiles: {supported}")
    return cast(ScanProfileName, normalized)


def validate_scan_profile_for_settings(scan_profile: str, settings: Settings) -> ScanProfileName:
    profile = normalize_scan_profile(scan_profile)
    if profile == LAB_PROFILE and not settings.lab_mode:
        raise ScanProfileError("scan_profile 'lab' requires LAB_MODE=true")
    if profile == LOCAL_REAL_PROFILE:
        if not settings.local_real_scanners:
            raise ScanProfileError("scan_profile 'local-real' requires LOCAL_REAL_SCANNERS=true")
        if not settings.enable_real_scanners:
            raise ScanProfileError("scan_profile 'local-real' requires ENABLE_REAL_SCANNERS=true")
    if settings.lab_mode and profile != LAB_PROFILE:
        raise ScanProfileError("LAB_MODE only supports scan_profile 'lab'")
    return profile


def should_run_nuclei_stage(scan_profile: ScanProfileName) -> bool:
    return scan_profile in {SAFE_PROFILE, LOCAL_REAL_PROFILE}


def should_run_nmap_stage(scan_profile: ScanProfileName) -> bool:
    return scan_profile == SAFE_PROFILE
