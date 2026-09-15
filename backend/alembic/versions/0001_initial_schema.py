"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-06-11
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "scans",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("target", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("scan_profile", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("started_at", sa.DateTime(), nullable=True),
        sa.Column("finished_at", sa.DateTime(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scans_status"), "scans", ["status"])
    op.create_index(op.f("ix_scans_target"), "scans", ["target"])

    op.create_table(
        "assets",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scan_id", sa.String(length=36), nullable=False),
        sa.Column("hostname", sa.String(length=255), nullable=False),
        sa.Column("ip", sa.String(length=64), nullable=True),
        sa.Column("is_alive", sa.Boolean(), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=512), nullable=True),
        sa.Column("technologies", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assets_hostname"), "assets", ["hostname"])
    op.create_index(op.f("ix_assets_scan_id"), "assets", ["scan_id"])

    op.create_table(
        "risk_reports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scan_id", sa.String(length=36), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("top_risks", sa.JSON(), nullable=False),
        sa.Column("recommendations", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scan_id"),
    )
    op.create_index(op.f("ix_risk_reports_scan_id"), "risk_reports", ["scan_id"])

    op.create_table(
        "services",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("asset_id", sa.String(length=36), nullable=False),
        sa.Column("port", sa.Integer(), nullable=False),
        sa.Column("protocol", sa.String(length=32), nullable=False),
        sa.Column("service_name", sa.String(length=128), nullable=True),
        sa.Column("product", sa.String(length=255), nullable=True),
        sa.Column("version", sa.String(length=128), nullable=True),
        sa.Column("banner", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_services_asset_id"), "services", ["asset_id"])

    op.create_table(
        "findings",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("scan_id", sa.String(length=36), nullable=False),
        sa.Column("asset_id", sa.String(length=36), nullable=True),
        sa.Column("source_tool", sa.String(length=64), nullable=False),
        sa.Column("template_id", sa.String(length=255), nullable=True),
        sa.Column("name", sa.String(length=512), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("matched_at", sa.String(length=1024), nullable=True),
        sa.Column("cve", sa.String(length=64), nullable=True),
        sa.Column("cvss", sa.Float(), nullable=True),
        sa.Column("raw_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"]),
        sa.ForeignKeyConstraint(["scan_id"], ["scans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_findings_asset_id"), "findings", ["asset_id"])
    op.create_index(op.f("ix_findings_scan_id"), "findings", ["scan_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_findings_scan_id"), table_name="findings")
    op.drop_index(op.f("ix_findings_asset_id"), table_name="findings")
    op.drop_table("findings")
    op.drop_index(op.f("ix_services_asset_id"), table_name="services")
    op.drop_table("services")
    op.drop_index(op.f("ix_risk_reports_scan_id"), table_name="risk_reports")
    op.drop_table("risk_reports")
    op.drop_index(op.f("ix_assets_scan_id"), table_name="assets")
    op.drop_index(op.f("ix_assets_hostname"), table_name="assets")
    op.drop_table("assets")
    op.drop_index(op.f("ix_scans_target"), table_name="scans")
    op.drop_index(op.f("ix_scans_status"), table_name="scans")
    op.drop_table("scans")
