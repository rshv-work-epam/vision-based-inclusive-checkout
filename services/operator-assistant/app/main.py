import os
from fastapi import FastAPI
from .routers import health, tools
from .instrumentation import setup_telemetry


def create_app() -> FastAPI:
    app = FastAPI(title="Operator Assistant Service", version="0.1.0")
    app.include_router(health.router)
    app.include_router(tools.router)
    return app


app = create_app()
setup_telemetry(app, service_name=os.getenv("OTEL_SERVICE_NAME", "operator-assistant"))
