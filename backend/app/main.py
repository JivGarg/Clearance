from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import checks, health


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Clearance API",
        version="0.1.0",
        description="Phase 1: mock check endpoints returning seeded, deterministic results.",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_origin],
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.include_router(health.router)
    app.include_router(checks.router)
    return app


app = create_app()
