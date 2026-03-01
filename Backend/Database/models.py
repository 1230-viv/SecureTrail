"""
SQLAlchemy ORM Models — SecureTrail
All tables use UUID primary keys with server-side defaults for safe distributed inserts.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


# ── Base ──────────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


# ── Users ─────────────────────────────────────────────────────────────────────
class User(Base):
    """
    GitHub (and future Google) OAuth users.
    Upserted on every successful login so the record stays fresh.
    """

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    # OAuth provider identifiers — at most one per provider is ever set
    github_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True, unique=True)
    google_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)

    # Profile info
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # "github" | "google"
    login: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    email: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    html_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Flags
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        onupdate=func.now(),
    )

    # Relationships
    scan_jobs: Mapped[list[ScanJob]] = relationship(
        "ScanJob", back_populates="user", passive_deletes=True
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User id={self.id} login={self.login!r} provider={self.provider!r}>"


# ── Scan Jobs ─────────────────────────────────────────────────────────────────
class ScanJob(Base):
    """
    One row per scan initiated by the API.
    The id mirrors the in-memory job_manager job_id so both systems agree.
    """

    __tablename__ = "scan_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # What is being scanned
    repository_name: Mapped[str] = mapped_column(String(512), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)   # "github" | "upload"
    repo_full_name: Mapped[str | None] = mapped_column(String(512), nullable=True)
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    s3_url: Mapped[str | None] = mapped_column(Text, nullable=True)  # S3 URL for stored ZIP file

    # Live status — kept in sync from job_manager writes
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    stage: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Aggregated counts (denormalised for fast dashboard queries)
    total_vulnerabilities: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    critical_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    high_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    medium_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    low_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    info_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Full result payload (Postgres JSONB for efficient key lookups)
    result_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    user: Mapped[User | None] = relationship("User", back_populates="scan_jobs")
    logs: Mapped[list[ScanLog]] = relationship(
        "ScanLog", back_populates="job", cascade="all, delete-orphan", passive_deletes=True
    )
    vulnerabilities: Mapped[list[VulnerabilityRecord]] = relationship(
        "VulnerabilityRecord",
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("ix_scan_jobs_status_created", "status", "created_at"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ScanJob id={self.id} status={self.status!r} repo={self.repository_name!r}>"


# ── Scan Logs ─────────────────────────────────────────────────────────────────
class ScanLog(Base):
    """
    Per-job structured log lines emitted during the scan pipeline.
    Uses BigInt serial PK for high-throughput inserts without UUID overhead.
    """

    __tablename__ = "scan_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    level: Mapped[str] = mapped_column(String(16), nullable=False)        # DEBUG|INFO|WARNING|ERROR
    logger_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    job: Mapped[ScanJob] = relationship("ScanJob", back_populates="logs")

    __table_args__ = (
        Index("ix_scan_logs_job_id", "job_id"),
        Index("ix_scan_logs_job_id_level", "job_id", "level"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<ScanLog id={self.id} job={self.job_id} level={self.level!r}>"


# ── Vulnerability Records ─────────────────────────────────────────────────────
class VulnerabilityRecord(Base):
    """
    Each identified vulnerability from any scanner (Semgrep / Trivy / Gitleaks).
    Provides fast aggregation queries without unpacking the job's JSONB blob.
    """

    __tablename__ = "vulnerability_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Identification
    vuln_id: Mapped[str | None] = mapped_column(String(512), nullable=True)  # e.g. CVE, rule-id
    severity: Mapped[str] = mapped_column(String(32), nullable=False, index=True)  # CRITICAL|HIGH…
    source: Mapped[str] = mapped_column(String(64), nullable=False)   # "semgrep"|"trivy"|"gitleaks"
    vuln_type: Mapped[str | None] = mapped_column(
        "type", String(128), nullable=True
    )                                                                   # sast|secret|dependency
    title: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Location
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Scoring
    exploitability_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    cvss_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # AI enrichment flag
    has_ai_explanation: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Raw payload for display without joining scan_jobs.result_json
    raw_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    # Relationships
    job: Mapped[ScanJob] = relationship("ScanJob", back_populates="vulnerabilities")

    __table_args__ = (
        Index("ix_vuln_records_job_id", "job_id"),
        Index("ix_vuln_records_severity", "severity"),
        Index("ix_vuln_records_source", "source"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<VulnerabilityRecord id={self.id} severity={self.severity!r} "
            f"source={self.source!r}>"
        )


# ── Learning — AI Insights Cache ──────────────────────────────────────────────
class LearningInsightsCache(Base):
    """
    Cached AI mentor insights per scan job.
    Replaces the file-based .ai_cache/ directory for production deployments.
    One row per job_id; overwritten on force-refresh.
    """

    __tablename__ = "learning_insights_cache"

    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        primary_key=True,
    )
    # Full insights payload (same shape as Routes/learning.py /insights response)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # When the AI was last invoked (not when the row was read)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    # TTL: NULL = never expire; set to future timestamp to allow re-generation
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<LearningInsightsCache job_id={self.job_id}>"


# ── Learning — Vuln Guide Cache ───────────────────────────────────────────────
class VulnGuideCache(Base):
    """
    Cached AI vulnerability guide per (job_id, category).
    One row per (job, category) pair; overwritten on force-refresh.
    """

    __tablename__ = "vuln_guide_cache"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    # Full guide payload (same shape as /vuln-guide response)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("job_id", "category", name="uq_vuln_guide_job_category"),
        Index("ix_vuln_guide_job_id", "job_id"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<VulnGuideCache job_id={self.job_id} category={self.category!r}>"


# ── Learning — User XP Progress ───────────────────────────────────────────────
class UserXPProgress(Base):
    """
    Persistent XP and badge progress per repository.
    Replaces the file-based .xp_store/ directory for production deployments.
    Keyed by repository_name (scoped to the platform, not per-user for now).
    """

    __tablename__ = "user_xp_progress"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    repository_name: Mapped[str] = mapped_column(
        String(512), nullable=False, unique=True, index=True
    )
    xp_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    level_label: Mapped[str] = mapped_column(
        String(64), nullable=False, default="Apprentice"
    )
    # Earned badge IDs stored as a JSON array of strings
    earned_badges: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Extra history JSONB (per-scan XP breakdown, etc.)
    history: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<UserXPProgress repo={self.repository_name!r} "
            f"xp={self.xp_total} level={self.level}>"
        )


# ── Learning — Vulnerability Lifecycle State ─────────────────────────────────
class VulnLifecycle(Base):
    """
    Tracks the lifecycle state of individual findings as developers learn.

    States: detected → learning → fix_attempted → verified → mastered

    Keyed by (job_id, rule_id, file_path) so each unique finding instance
    has its own lifecycle record.
    """

    __tablename__ = "vuln_lifecycle"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    job_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scan_jobs.id", ondelete="CASCADE"),
        nullable=False,
    )
    rule_id: Mapped[str] = mapped_column(String(256), nullable=False)
    category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False, default="medium")
    # State machine: detected | learning | fix_attempted | verified | mastered
    state: Mapped[str] = mapped_column(
        String(32), nullable=False, default="detected", index=True
    )
    verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    xp_awarded: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Snapshot of the last submitted fix evaluation
    fix_evaluation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        Index("ix_vuln_lifecycle_job_id", "job_id"),
        Index("ix_vuln_lifecycle_category_state", "category", "state"),
        UniqueConstraint("job_id", "rule_id", "file_path", name="uq_vuln_lifecycle"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<VulnLifecycle job_id={self.job_id} rule={self.rule_id!r} "
            f"state={self.state!r}>"
        )


# ── Learning — Habit Confidence Scores ───────────────────────────────────────
class HabitConfidence(Base):
    """
    Tracks habit confidence scores per (repository, pattern) over time.
    Updated after every scan for existing habits.
    """

    __tablename__ = "habit_confidence"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    repository_name: Mapped[str] = mapped_column(
        String(512), nullable=False, index=True
    )
    pattern_name: Mapped[str] = mapped_column(String(256), nullable=False)
    trigger_category: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    occurrence_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    scan_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    recurrence_rate: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    confidence_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Improving | Stable | Regressing | New
    trend: Mapped[str] = mapped_column(String(32), nullable=False, default="Stable")
    first_detected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_detected_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Per-scan count history [{scan_id, count, date}]
    scan_history: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint(
            "repository_name", "trigger_category",
            name="uq_habit_confidence_repo_cat",
        ),
        Index("ix_habit_confidence_repo", "repository_name"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<HabitConfidence repo={self.repository_name!r} "
            f"pattern={self.pattern_name!r} score={self.confidence_score}>"
        )


# ── Learning — Skill Tree Progress ───────────────────────────────────────────
class SkillTreeProgress(Base):
    """
    Per-repository skill tree: six independent domain XP buckets.
    One row per repository; updated after every scan.
    """

    __tablename__ = "skill_tree_progress"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    repository_name: Mapped[str] = mapped_column(
        String(512), nullable=False, unique=True, index=True
    )
    # Domain XP columns
    auth_authz_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    secrets_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    api_protection_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    input_validation_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dependency_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    secure_arch_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # JSON scan history for audit
    history: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<SkillTreeProgress repo={self.repository_name!r}>"


# ── Learning — Progress Badges ────────────────────────────────────────────────
class ProgressBadge(Base):
    """
    Earned gamification badges per repository.
    One row per (repository, badge_id) — never deleted once earned.
    """

    __tablename__ = "progress_badges"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=func.gen_random_uuid(),
    )
    repository_name: Mapped[str] = mapped_column(
        String(512), nullable=False, index=True
    )
    # Stable badge identifier: "first_verified_fix", "five_secure_fixes", etc.
    badge_id: Mapped[str] = mapped_column(String(128), nullable=False)
    badge_name: Mapped[str] = mapped_column(String(256), nullable=False)
    badge_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    earned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    # Scan that triggered this badge
    scan_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "repository_name", "badge_id",
            name="uq_progress_badge_repo_badge",
        ),
        Index("ix_progress_badges_repo", "repository_name"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"<ProgressBadge repo={self.repository_name!r} "
            f"badge={self.badge_id!r}>"
        )
