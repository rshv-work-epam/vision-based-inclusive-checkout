from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    log_level: str = "INFO"
    otlp_endpoint: str = "http://otel-collector:4317"
    otel_service_name: str = "review-tasks"
    # Default to /tmp since the container runs as a non-root user (WORKDIR is not writable).
    db_url: str = Field(
        default="sqlite:////tmp/review_tasks.db",
        validation_alias=AliasChoices("REVIEW_TASKS_DB_URL", "DB_URL"),
    )


settings = Settings()
