"""Add persistent workspace product state.

Revision ID: 0006_workspace_product_state
Revises: 0005_operations
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_workspace_product_state"
down_revision = "0005_operations"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspace_settings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("allowed_target_domains", sa.JSON(), nullable=False),
        sa.Column("allowed_lab_targets", sa.JSON(), nullable=False),
        sa.Column("default_notification_channel", sa.String(length=32), nullable=False),
        sa.Column("alert_threshold", sa.String(length=16), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "integration_configs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=64), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index(op.f("ix_integration_configs_name"), "integration_configs", ["name"])
    op.create_table(
        "attack_path_reviews",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scan_id", sa.String(length=36), nullable=False),
        sa.Column("step_id", sa.String(length=255), nullable=False),
        sa.Column("reviewed", sa.Boolean(), nullable=False),
        sa.Column("reviewed_by", sa.String(length=255), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scan_id", "step_id", name="uq_attack_path_review_step"),
    )
    op.create_index(op.f("ix_attack_path_reviews_scan_id"), "attack_path_reviews", ["scan_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_attack_path_reviews_scan_id"), table_name="attack_path_reviews")
    op.drop_table("attack_path_reviews")
    op.drop_index(op.f("ix_integration_configs_name"), table_name="integration_configs")
    op.drop_table("integration_configs")
    op.drop_table("workspace_settings")
