from app.db.session import SessionLocal
from app.services.scan_pipeline import run_scan_pipeline
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.run_scan")
def run_scan(scan_id: str) -> None:
    with SessionLocal() as db:
        run_scan_pipeline(scan_id, db)
