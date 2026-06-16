from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = Field(default="spectrascope-backend", alias="SERVICE_NAME")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_format: str = Field(default="json", alias="LOG_FORMAT")
    app_env: str = Field(default="dev", alias="APP_ENV")
    lab_mode: bool = Field(default=False, alias="LAB_MODE")
    database_url: str = Field(
        default="postgresql+psycopg2://spectrascope:spectrascope@postgres:5432/spectrascope",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    celery_broker_url: str = Field(default="redis://redis:6379/0", alias="CELERY_BROKER_URL")
    celery_result_backend: str = Field(default="redis://redis:6379/1", alias="CELERY_RESULT_BACKEND")
    enable_real_scanners: bool = Field(default=False, alias="ENABLE_REAL_SCANNERS")
    enable_nmap: bool = Field(default=False, alias="ENABLE_NMAP")
    scanner_timeout_seconds: int = Field(default=60, alias="SCANNER_TIMEOUT_SECONDS")
    scanner_max_results: int = Field(default=200, alias="SCANNER_MAX_RESULTS")
    nuclei_templates_path: str = Field(default="", alias="NUCLEI_TEMPLATES_PATH")
    allowed_target_domains: str = Field(default="", alias="ALLOWED_TARGET_DOMAINS")
    allowed_lab_targets: str = Field(default="", alias="ALLOWED_LAB_TARGETS")
    celery_task_always_eager: bool = Field(default=False, alias="CELERY_TASK_ALWAYS_EAGER")

    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore", populate_by_name=True)

    @property
    def allowed_domain_list(self) -> list[str]:
        return [item.strip().lower() for item in self.allowed_target_domains.split(",") if item.strip()]

    @property
    def allowed_lab_target_list(self) -> list[str]:
        return [item.strip().lower() for item in self.allowed_lab_targets.split(",") if item.strip()]

    @property
    def nuclei_template_paths(self) -> list[str]:
        return [item.strip() for item in self.nuclei_templates_path.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
