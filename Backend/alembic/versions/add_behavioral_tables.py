"""add behavioral mentoring tables

Revision ID: add_behavioral_tables
Revises: add_learning_tables
Create Date: 2026-03-01 00:00:00.000000

Tables added:
  - vuln_lifecycle        (vulnerability lifecycle state machine)
  - habit_confidence      (per-repo habit confidence scores)
  - skill_tree_progress   (six-domain skill tree per repo)
  - progress_badges       (earned gamification badges)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "add_behavioral_tables"
down_revision: Union[str, None] = "add_learning_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── vuln_lifecycle ────────────────────────────────────────────────────────
    op.create_table(
        "vuln_lifecycle",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rule_id", sa.String(256), nullable=False),
        sa.Column("category", sa.String(128), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=True),
        sa.Column("severity", sa.String(32), nullable=False, server_default="medium"),
        sa.Column("state", sa.String(32), nullable=False, server_default="detected"),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("xp_awarded", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "fix_evaluation",
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
        sa.ForeignKeyConstraint(["job_id"], ["scan_jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", "rule_id", "file_path", name="uq_vuln_lifecycle"),
    )
    op.create_index("ix_vuln_lifecycle_job_id", "vuln_lifecycle", ["job_id"])
    op.create_index(
        "ix_vuln_lifecycle_category_state", "vuln_lifecycle", ["category", "state"]
    )

    # ── habit_confidence ─────────────────────────────────────────────────────
    op.create_table(
        "habit_confidence",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("repository_name", sa.String(512), nullable=False),
        sa.Column("pattern_name", sa.String(256), nullable=False),
        sa.Column("trigger_category", sa.String(128), nullable=False),
        sa.Column("occurrence_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("scan_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("recurrence_rate", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("confidence_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("trend", sa.String(32), nullable=False, server_default="Stable"),
        sa.Column("first_detected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_detected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "scan_history",
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
        sa.UniqueConstraint(
            "repository_name",
            "trigger_category",
            name="uq_habit_confidence_repo_cat",
        ),
    )
    op.create_index("ix_habit_confidence_repo", "habit_confidence", ["repository_name"])
    op.create_index(
        "ix_habit_confidence_trigger", "habit_confidence", ["trigger_category"]
    )

    # ── skill_tree_progress ──────────────────────────────────────────────────
    op.create_table(
        "skill_tree_progress",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("repository_name", sa.String(512), nullable=False),
        sa.Column("auth_authz_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("secrets_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("api_protection_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("input_validation_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("dependency_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("secure_arch_xp", sa.Integer(), nullable=False, server_default="0"),
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
        sa.UniqueConstraint("repository_name", name="uq_skill_tree_repo"),
    )
    op.create_index(
        "ix_skill_tree_repo", "skill_tree_progress", ["repository_name"]
    )

    # ── progress_badges ──────────────────────────────────────────────────────
    op.create_table(
        "progress_badges",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("repository_name", sa.String(512), nullable=False),
        sa.Column("badge_id", sa.String(128), nullable=False),
        sa.Column("badge_name", sa.String(256), nullable=False),
        sa.Column("badge_description", sa.Text(), nullable=True),
        sa.Column(
            "earned_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("scan_id", sa.String(64), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "repository_name", "badge_id", name="uq_progress_badge_repo_badge"
        ),
    )
    op.create_index("ix_progress_badges_repo", "progress_badges", ["repository_name"])


def downgrade() -> None:
    op.drop_index("ix_progress_badges_repo", table_name="progress_badges")
    op.drop_table("progress_badges")

    op.drop_index("ix_skill_tree_repo", table_name="skill_tree_progress")
    op.drop_table("skill_tree_progress")

    op.drop_index("ix_habit_confidence_trigger", table_name="habit_confidence")
    op.drop_index("ix_habit_confidence_repo", table_name="habit_confidence")
    op.drop_table("habit_confidence")

    op.drop_index("ix_vuln_lifecycle_category_state", table_name="vuln_lifecycle")
    op.drop_index("ix_vuln_lifecycle_job_id", table_name="vuln_lifecycle")
    op.drop_table("vuln_lifecycle")
