"""scan audit logs

Revision ID: 0002_scan_audit_logs
Revises: 0001_initial_schema
Create Date: 2026-06-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0002_scan_audit_logs"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scan_audit_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scan_id", sa.String(length=36), nullable=True),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("actor", sa.String(length=255), nullable=True),
        sa.Column("decision", sa.String(length=32), nullable=False),
        sa.Column("reason", sa.String(length=512), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scan_audit_logs_action"), "scan_audit_logs", ["action"])
    op.create_index(op.f("ix_scan_audit_logs_scan_id"), "scan_audit_logs", ["scan_id"])
    op.create_index(op.f("ix_scan_audit_logs_target"), "scan_audit_logs", ["target"])


def downgrade() -> None:
    op.drop_index(op.f("ix_scan_audit_logs_target"), table_name="scan_audit_logs")
    op.drop_index(op.f("ix_scan_audit_logs_scan_id"), table_name="scan_audit_logs")
    op.drop_index(op.f("ix_scan_audit_logs_action"), table_name="scan_audit_logs")
    op.drop_table("scan_audit_logs")
