"""Add persisted controlled operations and audit events.

Revision ID: 0005_operations
Revises: 0004_scan_stage_diagnostics
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_operations"
down_revision = "0004_scan_stage_diagnostics"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "operations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scan_id", sa.String(length=36), nullable=True),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("current_phase", sa.String(length=64), nullable=False),
        sa.Column("scope_manifest", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("completed_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_operations_scan_id"), "operations", ["scan_id"])
    op.create_index(op.f("ix_operations_status"), "operations", ["status"])
    op.create_index(op.f("ix_operations_target"), "operations", ["target"])
    op.create_table(
        "operation_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("operation_id", sa.String(length=36), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("phase", sa.String(length=64), nullable=False),
        sa.Column("decision", sa.String(length=32), nullable=True),
        sa.Column("message", sa.String(length=512), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["operation_id"], ["operations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("operation_id", "sequence", name="uq_operation_event_sequence"),
    )
    op.create_index(op.f("ix_operation_events_event_type"), "operation_events", ["event_type"])
    op.create_index(op.f("ix_operation_events_operation_id"), "operation_events", ["operation_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_operation_events_operation_id"), table_name="operation_events")
    op.drop_index(op.f("ix_operation_events_event_type"), table_name="operation_events")
    op.drop_table("operation_events")
    op.drop_index(op.f("ix_operations_target"), table_name="operations")
    op.drop_index(op.f("ix_operations_status"), table_name="operations")
    op.drop_index(op.f("ix_operations_scan_id"), table_name="operations")
    op.drop_table("operations")
