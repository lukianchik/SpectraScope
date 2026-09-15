from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = Field(default="spectrascope-backend", alias="SERVICE_NAME")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")
    app_env: str = Field(default="dev", alias="APP_ENV")
    cors_allowed_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        alias="CORS_ALLOWED_ORIGINS",
    )
    auth_required: bool = Field(default=False, alias="AUTH_REQUIRED")
    auth_username: str = Field(default="admin", alias="AUTH_USERNAME", min_length=1, max_length=255)
    auth_password_hash: str = Field(default="", alias="AUTH_PASSWORD_HASH")
    session_secret: str = Field(default="", alias="SESSION_SECRET")
    session_ttl_seconds: int = Field(
        default=28_800,
        alias="SESSION_TTL_SECONDS",
        ge=300,
        le=604_800,
    )
    session_cookie_secure: bool = Field(default=False, alias="SESSION_COOKIE_SECURE")
    integration_secret_key: str = Field(default="", alias="INTEGRATION_SECRET_KEY")
    lab_mode: bool = Field(default=False, alias="LAB_MODE")
    database_url: str = Field(
        default="postgresql+psycopg2://spectrascope:spectrascope@postgres:5432/spectrascope",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    celery_broker_url: str = Field(default="redis://redis:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://redis:6379/1", alias="CELERY_RESULT_BACKEND")
    enable_real_scanners: bool = Field(default=False, alias="ENABLE_REAL_SCANNERS")
    local_real_scanners: bool = Field(default=False, alias="LOCAL_REAL_SCANNERS")
    enable_nmap: bool = Field(default=False, alias="ENABLE_NMAP")
    allow_benchmark_dns_proxy: bool = Field(default=False, alias="ALLOW_BENCHMARK_DNS_PROXY")
    scanner_timeout_seconds: int = Field(
        default=60,
        alias="SCANNER_TIMEOUT_SECONDS",
        ge=1,
        le=3600,
    )
    scanner_max_results: int = Field(
        default=200,
        alias="SCANNER_MAX_RESULTS",
        ge=1,
        le=10_000,
    )
    scan_stale_after_seconds: int = Field(default=1800, alias="SCAN_STALE_AFTER_SECONDS", ge=60)
    nuclei_templates_path: str = Field(default="", alias="NUCLEI_TEMPLATES_PATH")
    allowed_target_domains: str = Field(default="", alias="ALLOWED_TARGET_DOMAINS")
    allowed_lab_targets: str = Field(default="", alias="ALLOWED_LAB_TARGETS")
    local_real_scope_target: str = Field(
        default="perimeter.lab.local:8088",
        alias="LOCAL_REAL_SCOPE_TARGET",
    )
    celery_task_always_eager: bool = Field(default=False, alias="CELERY_TASK_ALWAYS_EAGER")

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore", populate_by_name=True)

    @property
    def allowed_domain_list(self) -> list[str]:
        return [item.strip().lower() for item in self.allowed_target_domains.split(",") if item.strip()]

    @property
    def allowed_lab_target_list(self) -> list[str]:
        return [item.strip().lower() for item in self.allowed_lab_targets.split(",") if item.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_allowed_origins.split(",") if item.strip()]

    @model_validator(mode="after")
    def validate_production_safety(self) -> "Settings":
        if self.app_env.lower() != "production":
            return self
        problems = []
        if not self.auth_required:
            problems.append("AUTH_REQUIRED must be true")
        if not self.auth_password_hash.startswith("pbkdf2_sha256$"):
            problems.append("AUTH_PASSWORD_HASH must be a generated PBKDF2 hash")
        if len(self.session_secret) < 32 or self.session_secret.startswith("CHANGE_ME"):
            problems.append("SESSION_SECRET must be at least 32 random characters")
        if not self.session_cookie_secure:
            problems.append("SESSION_COOKIE_SECURE must be true")
        if len(self.integration_secret_key) < 32 or self.integration_secret_key.startswith("CHANGE_ME"):
            problems.append("INTEGRATION_SECRET_KEY must be at least 32 random characters")
        if self.celery_task_always_eager:
            problems.append("CELERY_TASK_ALWAYS_EAGER must be false")
        if problems:
            raise ValueError("Unsafe production configuration: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
