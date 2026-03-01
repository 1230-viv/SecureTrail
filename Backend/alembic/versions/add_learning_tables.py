"""add learning cache and xp progress tables

Revision ID: add_learning_tables
Revises: add_s3_url_column
Create Date: 2025-01-01 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_learning_tables"
down_revision: Union[str, None] = "add_s3_url_column"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── learning_insights_cache ───────────────────────────────────────────────
    op.create_table(
        "learning_insights_cache",
        sa.Column(
            "job_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
        ),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["job_id"], ["scan_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("job_id"),
    )

    # ── vuln_guide_cache ──────────────────────────────────────────────────────
    op.create_table(
        "vuln_guide_cache",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category", sa.String(128), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["job_id"], ["scan_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", "category", name="uq_vuln_guide_job_category"),
    )
    op.create_index("ix_vuln_guide_job_id", "vuln_guide_cache", ["job_id"])
    op.create_index("ix_vuln_guide_category", "vuln_guide_cache", ["category"])

    # ── user_xp_progress ─────────────────────────────────────────────────────
    op.create_table(
        "user_xp_progress",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("repository_name", sa.String(512), nullable=False),
        sa.Column("xp_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column(
            "level_label",
            sa.String(64),
            nullable=False,
            server_default="Apprentice",
        ),
        sa.Column(
            "earned_badges",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "history",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("repository_name", name="uq_user_xp_repo"),
    )
    op.create_index(
        "ix_user_xp_progress_repo", "user_xp_progress", ["repository_name"]
    )


def downgrade() -> None:
    op.drop_index("ix_user_xp_progress_repo", table_name="user_xp_progress")
    op.drop_table("user_xp_progress")

    op.drop_index("ix_vuln_guide_category", table_name="vuln_guide_cache")
    op.drop_index("ix_vuln_guide_job_id", table_name="vuln_guide_cache")
    op.drop_table("vuln_guide_cache")

    op.drop_table("learning_insights_cache")
