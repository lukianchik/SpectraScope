import logging

from app.db.session import SessionLocal
from app.services.scan_pipeline import run_scan_pipeline
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.run_scan")
def run_scan(scan_id: str) -> None:
    logger.info("scan_task_started", extra={"scan_id": scan_id})
    with SessionLocal() as db:
        run_scan_pipeline(scan_id, db)
    logger.info("scan_task_completed", extra={"scan_id": scan_id})
