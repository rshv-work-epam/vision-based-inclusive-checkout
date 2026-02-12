import os
from fastapi import FastAPI
from .routers import health, tasks
from .instrumentation import setup_telemetry
from .core.db import init_db


def create_app() -> FastAPI:
    app = FastAPI(title="Review Tasks Service", version="0.1.0")
    app.include_router(health.router)
    app.include_router(tasks.router)
    @app.on_event("startup")
    def on_startup():
        init_db()
    return app


app = create_app()
setup_telemetry(app, service_name=os.getenv("OTEL_SERVICE_NAME", "review-tasks"))
