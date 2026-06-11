from fastapi import FastAPI

from app.api.scans import router as scans_router
from app.core.logging import configure_logging

configure_logging()

app = FastAPI(
    title="SpectraScope API",
    version="0.1.0",
    description="MVP API for authorized external attack surface discovery and basic findings.",
)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(scans_router)
