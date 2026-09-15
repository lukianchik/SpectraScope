from fastapi import FastAPI
from fastapi import Depends, Response, status
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy.orm import Session

from app.api.errors import install_api_error_handlers
from app.api.scans import router as scans_router
from app.api.operations import router as operations_router
from app.api.workspace import router as workspace_router
from app.api.auth import router as auth_router
from app.core.auth import require_user
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware, SecurityHeadersMiddleware
from app.db.session import get_db
from app.services.health import check_postgres, check_redis

configure_logging()
settings = get_settings()

app = FastAPI(
    title="SpectraScope API",
    version="1.0.0-rc.1",
    description="API for authorized external attack-surface discovery and defensive analysis.",
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
install_api_error_handlers(app)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/live", tags=["health"])
def liveness() -> dict[str, str]:
    return {"status": "alive"}


@app.get("/health/ready", tags=["health"])
def readiness(response: Response, db: Session = Depends(get_db)) -> dict[str, object]:
    postgres_up = check_postgres(db)
    redis_up = check_redis()
    ready = postgres_up and redis_up
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return {
        "status": "ready" if ready else "not_ready",
        "dependencies": {
            "postgres": "up" if postgres_up else "down",
            "redis": "up" if redis_up else "down",
        },
    }


@app.get("/metrics", tags=["observability"])
def metrics() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


app.include_router(auth_router)
app.include_router(scans_router, dependencies=[Depends(require_user)])
app.include_router(operations_router, dependencies=[Depends(require_user)])
app.include_router(workspace_router, dependencies=[Depends(require_user)])
