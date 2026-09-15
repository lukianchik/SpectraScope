"""Add persistent finding triage.

Revision ID: 0007_finding_triage
Revises: 0006_workspace_product_state
"""

from alembic import op
import sqlalchemy as sa


revision = "0007_finding_triage"
down_revision = "0006_workspace_product_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("findings", sa.Column("triage_status", sa.String(length=32), nullable=False, server_default="open"))
    op.add_column("findings", sa.Column("assigned_to", sa.String(length=255), nullable=True))
    op.add_column("findings", sa.Column("triage_note", sa.Text(), nullable=True))
    op.add_column("findings", sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()))
    op.create_index(op.f("ix_findings_triage_status"), "findings", ["triage_status"])


def downgrade() -> None:
    op.drop_index(op.f("ix_findings_triage_status"), table_name="findings")
    op.drop_column("findings", "updated_at")
    op.drop_column("findings", "triage_note")
    op.drop_column("findings", "assigned_to")
    op.drop_column("findings", "triage_status")
