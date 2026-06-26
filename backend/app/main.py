from fastapi import FastAPI
from fastapi import Depends, Response, status
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import CONTENT_TYPE_LATEST, generate_latest
from sqlalchemy.orm import Session

from app.api.scans import router as scans_router
from app.core.logging import configure_logging
from app.core.middleware import RequestContextMiddleware
from app.db.session import get_db
from app.services.health import check_postgres, check_redis

configure_logging()

app = FastAPI(
    title="SpectraScope API",
    version="0.1.0",
    description="MVP API for authorized external attack surface discovery and basic findings.",
)

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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


app.include_router(scans_router)
