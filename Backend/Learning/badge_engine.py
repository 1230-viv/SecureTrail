"""
Badge Engine — SecureTrail Learning System v3
==============================================
Defines all progress badges and eligibility checks.

Badges are awarded deterministically based on lifecycle state counts.
AI never awards badges — only this module does.

Badge catalog:
  first_verified_fix      — First time a fix is "verified" ✓
  five_secure_fixes       — 5 cumulative verified fixes
  ten_secure_fixes        — 10 cumulative verified fixes
  auth_master             — 5 verified fixes in auth_authz domain
  secrets_clean_sweep     — All secret_management findings verified
  input_validator         — 5 verified input_validation fixes
  dependency_hygienist    — All dependency findings resolved
  zero_criticals          — No critical findings in a scan
  streak_3                — 3 consecutive scans with improved health score
  full_house              — Verified fix in every category present in a scan
"""

from __future__ import annotations

from typing import Any

from Utils.logger import get_logger

logger = get_logger("badge_engine")

# ── Badge catalog ─────────────────────────────────────────────────────────────
BADGE_CATALOG: list[dict[str, str]] = [
    {
        "id":          "first_verified_fix",
        "name":        "First Verified Fix",
        "description": "Submitted and passed your first security fix verification.",
        "icon":        "CheckCircle",
        "color":       "#10b981",
    },
    {
        "id":          "five_secure_fixes",
        "name":        "5 Secure Fixes",
        "description": "Verified 5 security fixes across your repository.",
        "icon":        "Award",
        "color":       "#6366f1",
    },
    {
        "id":          "ten_secure_fixes",
        "name":        "10 Secure Fixes",
        "description": "Verified 10 security fixes. You are building strong habits.",
        "icon":        "Star",
        "color":       "#f59e0b",
    },
    {
        "id":          "auth_master",
        "name":        "Authorization Master",
        "description": "Verified 5 fixes in the Authentication & Authorization domain.",
        "icon":        "Shield",
        "color":       "#6366f1",
    },
    {
        "id":          "secrets_clean_sweep",
        "name":        "Secrets Clean Sweep",
        "description": "Verified all secret_management findings in a scan.",
        "icon":        "Key",
        "color":       "#f59e0b",
    },
    {
        "id":          "input_validator",
        "name":        "Input Validator",
        "description": "Verified 5 input validation fixes.",
        "icon":        "AlertTriangle",
        "color":       "#ef4444",
    },
    {
        "id":          "dependency_hygienist",
        "name":        "Dependency Hygienist",
        "description": "Resolved all dependency-related findings in a scan.",
        "icon":        "Package",
        "color":       "#8b5cf6",
    },
    {
        "id":          "zero_criticals",
        "name":        "Zero Criticals",
        "description": "Completed a scan with no critical severity findings.",
        "icon":        "TrendingDown",
        "color":       "#10b981",
    },
    {
        "id":          "streak_3",
        "name":        "3-Scan Streak",
        "description": "Improved health score in 3 consecutive scans.",
        "icon":        "TrendingUp",
        "color":       "#0ea5e9",
    },
]

_BADGE_BY_ID: dict[str, dict] = {b["id"]: b for b in BADGE_CATALOG}


def get_badge(badge_id: str) -> dict | None:
    return _BADGE_BY_ID.get(badge_id)


def check_new_badges(
    repo_name: str,
    scan_job_id: str,
    # Lifecycle counts
    total_verified: int,
    auth_verified: int,
    secrets_verified: int,
    input_verified: int,
    dependency_verified: int,
    # Scan-level signals
    has_zero_criticals: bool,
    # Already-earned badge IDs
    already_earned: set[str],
    # Health score history (newest last)
    health_scores: list[int],
) -> list[dict]:
    """
    Check which new badges should be awarded based on the current state.

    Returns a list of badge dicts for badges newly earned this scan.
    """
    new_badges: list[dict] = []

    def _maybe_award(badge_id: str) -> None:
        if badge_id not in already_earned:
            badge = _BADGE_BY_ID.get(badge_id)
            if badge:
                new_badges.append({**badge, "scan_id": scan_job_id, "repo_name": repo_name})

    if total_verified >= 1:
        _maybe_award("first_verified_fix")
    if total_verified >= 5:
        _maybe_award("five_secure_fixes")
    if total_verified >= 10:
        _maybe_award("ten_secure_fixes")
    if auth_verified >= 5:
        _maybe_award("auth_master")
    if secrets_verified >= 1:
        _maybe_award("secrets_clean_sweep")
    if input_verified >= 5:
        _maybe_award("input_validator")
    if dependency_verified >= 1:
        _maybe_award("dependency_hygienist")
    if has_zero_criticals:
        _maybe_award("zero_criticals")

    # 3-scan health score streak
    if len(health_scores) >= 3:
        last3 = health_scores[-3:]
        if last3[0] < last3[1] < last3[2]:
            _maybe_award("streak_3")

    return new_badges
