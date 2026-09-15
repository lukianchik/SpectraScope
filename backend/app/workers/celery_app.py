from celery import Celery

from app.core.config import get_settings
from app.core.logging import configure_logging

configure_logging()
settings = get_settings()

celery_app = Celery(
    "spectrascope",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["app.workers.tasks"],
)
celery_app.conf.task_routes = {"app.workers.tasks.run_scan": {"queue": "scans"}}
celery_app.conf.task_track_started = True
celery_app.conf.task_always_eager = settings.celery_task_always_eager
celery_app.conf.task_eager_propagates = settings.celery_task_always_eager
celery_app.conf.worker_hijack_root_logger = False
celery_app.conf.broker_connection_retry_on_startup = True
