import os
import logging

from fastapi import FastAPI

from .core.config import get_settings
from .instrumentation import setup_telemetry
from .routers import health, predict


def _configure_logging() -> None:
    settings = get_settings()
    level_name = str(settings.log_level).upper().strip()
    level = getattr(logging, level_name, logging.INFO)
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )


def create_app() -> FastAPI:
    _configure_logging()
    app = FastAPI(title="Inference Service", version="0.1.0")
    app.include_router(health.router)
    app.include_router(predict.router)
    return app


app = create_app()
setup_telemetry(app, service_name=os.getenv("OTEL_SERVICE_NAME", "inference"))
