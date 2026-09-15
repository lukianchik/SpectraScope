"""Add persisted scanner stage diagnostics.

Revision ID: 0004_scan_stage_diagnostics
Revises: 0003_scan_progress
"""

from alembic import op
import sqlalchemy as sa


revision = "0004_scan_stage_diagnostics"
down_revision = "0003_scan_progress"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scans",
        sa.Column("stage_diagnostics", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("scans", "stage_diagnostics")
