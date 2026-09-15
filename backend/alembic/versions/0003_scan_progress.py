"""Add observable scan progress and cancellation.

Revision ID: 0003_scan_progress
Revises: 0002_scan_audit_logs
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_scan_progress"
down_revision = "0002_scan_audit_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scans", sa.Column("current_stage", sa.String(length=64), nullable=False, server_default="queued"))
    op.add_column("scans", sa.Column("progress_percent", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "scans",
        sa.Column("cancellation_requested", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("scans", "cancellation_requested")
    op.drop_column("scans", "progress_percent")
    op.drop_column("scans", "current_stage")
