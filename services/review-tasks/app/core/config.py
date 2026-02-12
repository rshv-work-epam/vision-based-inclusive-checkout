from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    log_level: str = "INFO"
    otlp_endpoint: str = "http://otel-collector:4317"
    otel_service_name: str = "review-tasks"
    db_url: str = "sqlite:///./review_tasks.db"

    class Config:
        env_file = ".env"


settings = Settings()
