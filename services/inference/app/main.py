import os

from fastapi import FastAPI

from .instrumentation import setup_telemetry
from .routers import health, predict


def create_app() -> FastAPI:
    app = FastAPI(title="Inference Service", version="0.1.0")
    app.include_router(health.router)
    app.include_router(predict.router)
    return app


app = create_app()
setup_telemetry(app, service_name=os.getenv("OTEL_SERVICE_NAME", "inference"))
