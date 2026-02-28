"""
Maturity Model — SecureTrail Learning System
============================================
Security maturity levels and badge system.

Levels map to a health score:
  Beginner          0 – 30
  Improving        31 – 50
  Security-Aware   51 – 70
  Hardened         71 – 85
  Secure Architect 86 – 100

Badges are earned based on scan history patterns.
"""

from __future__ import annotations

from typing import Any

from Learning.learning_engine import (
    compute_health_score,
    compute_progress_metrics,
    extract_categories_from_result,
    extract_severity_counts,
)

# ──────────────────────────────────────────────────────────────────────────────
# Maturity levels
# ──────────────────────────────────────────────────────────────────────────────
MATURITY_LEVELS: list[dict] = [
    {
        "id":          "beginner",
        "label":       "Beginner",
        "min_score":   0,
        "max_score":   30,
        "color":       "#ef4444",
        "bg_color":    "#fee2e2",
        "description": "Critical vulnerabilities are present. Focus on the highest-severity findings immediately.",
        "icon":        "Shield",
        "next_step":   "Resolve all critical and high-severity findings to advance.",
    },
    {
        "id":          "improving",
        "label":       "Improving",
        "min_score":   31,
        "max_score":   50,
        "color":       "#f97316",
        "bg_color":    "#ffedd5",
        "description": "You're making progress but medium/high issues remain. Keep building security habits.",
        "icon":        "TrendingUp",
        "next_step":   "Eliminate high-severity findings and address recurring categories.",
    },
    {
        "id":          "security_aware",
        "label":       "Security-Aware",
        "min_score":   51,
        "max_score":   70,
        "color":       "#eab308",
        "bg_color":    "#fef9c3",
        "description": "Core vulnerabilities are addressed. Focus on hardening remaining medium issues.",
        "icon":        "Eye",
        "next_step":   "Resolve all medium findings and implement proactive controls.",
    },
    {
        "id":          "hardened",
        "label":       "Hardened",
        "min_score":   71,
        "max_score":   85,
        "color":       "#22c55e",
        "bg_color":    "#dcfce7",
        "description": "Strong security posture. Few low-severity issues remain.",
        "icon":        "ShieldCheck",
        "next_step":   "Clean up low findings and maintain with regular scans.",
    },
    {
        "id":          "secure_architect",
        "label":       "Secure Architect",
        "min_score":   86,
        "max_score":   100,
        "color":       "#6366f1",
        "bg_color":    "#eef2ff",
        "description": "Exceptional security posture. You are building with security-first principles.",
        "icon":        "Star",
        "next_step":   "Maintain discipline, mentor others, and run threat modelling.",
    },
]


def get_maturity_level(score: int) -> dict:
    """Return the maturity level dict for a given health score."""
    for level in MATURITY_LEVELS:
        if level["min_score"] <= score <= level["max_score"]:
            return level
    return MATURITY_LEVELS[-1]  # fallback to highest


def maturity_progress_pct(score: int) -> int:
    """
    Return the percentage progress within the current maturity level band.
    e.g. score=60 in Security-Aware (51-70) → (60-51)/(70-51) = 47%
    """
    level = get_maturity_level(score)
    band  = level["max_score"] - level["min_score"]
    if band == 0:
        return 100
    pct = (score - level["min_score"]) / band * 100
    return min(100, max(0, int(pct)))


# ──────────────────────────────────────────────────────────────────────────────
# Badge definitions
# ──────────────────────────────────────────────────────────────────────────────
# Each badge: id, label, description, icon, color, rarity
BADGE_DEFINITIONS: list[dict] = [
    {
        "id":          "first_scan",
        "label":       "First Scan",
        "description": "Completed your first security scan.",
        "icon":        "Radar",
        "color":       "#6366f1",
        "rarity":      "common",
    },
    {
        "id":          "first_clean_scan",
        "label":       "Clean Slate",
        "description": "Achieved a health score of 90+ on any scan.",
        "icon":        "CheckCircle",
        "color":       "#22c55e",
        "rarity":      "rare",
    },
    {
        "id":          "fifty_pct_reduction",
        "label":       "Major Improvement",
        "description": "Reduced total vulnerabilities by 50%+ in a single scan cycle.",
        "icon":        "TrendingDown",
        "color":       "#10b981",
        "rarity":      "uncommon",
    },
    {
        "id":          "zero_secrets",
        "label":       "Secret Guardian",
        "description": "Completed a scan with zero secret management findings.",
        "icon":        "KeyRound",
        "color":       "#8b5cf6",
        "rarity":      "uncommon",
    },
    {
        "id":          "authorization_hardened",
        "label":       "Access Fortress",
        "description": "Resolved all access control and IDOR findings.",
        "icon":        "LockKeyhole",
        "color":       "#f43f5e",
        "rarity":      "rare",
    },
    {
        "id":          "three_consecutive_improvements",
        "label":       "On a Roll",
        "description": "Improved health score in 3 consecutive scans.",
        "icon":        "Zap",
        "color":       "#eab308",
        "rarity":      "uncommon",
    },
    {
        "id":          "five_scans",
        "label":       "Committed",
        "description": "Completed 5 or more scans on the same repository.",
        "icon":        "BarChart2",
        "color":       "#0ea5e9",
        "rarity":      "common",
    },
    {
        "id":          "secure_architect",
        "label":       "Secure Architect",
        "description": "Reached the Secure Architect maturity level (score 86+).",
        "icon":        "Star",
        "color":       "#f59e0b",
        "rarity":      "legendary",
    },
    {
        "id":          "dependency_clean",
        "label":       "Supply Chain Safe",
        "description": "Completed a scan with zero dependency vulnerabilities.",
        "icon":        "Package",
        "color":       "#eab308",
        "rarity":      "uncommon",
    },
    {
        "id":          "injection_free",
        "label":       "Injection Immune",
        "description": "Completed a scan with zero injection findings.",
        "icon":        "Terminal",
        "color":       "#dc2626",
        "rarity":      "rare",
    },
]

# Map id → definition for fast lookup
_BADGE_MAP: dict[str, dict] = {b["id"]: b for b in BADGE_DEFINITIONS}


# ──────────────────────────────────────────────────────────────────────────────
# Badge evaluation
# ──────────────────────────────────────────────────────────────────────────────
def _score_for_job(job: dict) -> int:
    r = job.get("result_json") or {}
    return compute_health_score(r, extract_severity_counts(r))


def _total_vulns(job: dict) -> int:
    r = job.get("result_json") or {}
    return sum(extract_severity_counts(r).values())


def _cats(job: dict) -> dict[str, int]:
    return extract_categories_from_result(job.get("result_json"))


def compute_badges(sorted_jobs: list[dict]) -> list[dict[str, Any]]:
    """
    Evaluate which badges have been earned given scan history.

    Parameters
    ----------
    sorted_jobs : list of ScanJob dicts ordered oldest → newest

    Returns
    -------
    list of badge dicts with added 'earned' bool and 'earned_on' date.
    """
    earned_ids: set[str] = set()

    if not sorted_jobs:
        return _format_badges(earned_ids)

    latest_job = sorted_jobs[-1]
    latest_score = _score_for_job(latest_job)
    latest_cats  = _cats(latest_job)

    # first_scan
    if len(sorted_jobs) >= 1:
        earned_ids.add("first_scan")

    # first_clean_scan
    if any(_score_for_job(j) >= 90 for j in sorted_jobs):
        earned_ids.add("first_clean_scan")

    # fifty_pct_reduction
    for i in range(1, len(sorted_jobs)):
        prev_v = _total_vulns(sorted_jobs[i - 1])
        curr_v = _total_vulns(sorted_jobs[i])
        if prev_v > 0 and curr_v <= prev_v * 0.5:
            earned_ids.add("fifty_pct_reduction")
            break

    # zero_secrets
    if latest_cats.get("secret_management", 0) == 0 and len(sorted_jobs) >= 1:
        earned_ids.add("zero_secrets")

    # authorization_hardened
    if (
        latest_cats.get("access_control", 0) == 0
        and latest_cats.get("idor", 0) == 0
        and len(sorted_jobs) >= 1
    ):
        earned_ids.add("authorization_hardened")

    # three_consecutive_improvements
    metrics = compute_progress_metrics(sorted_jobs)
    if metrics["consecutive_improvements"] >= 3:
        earned_ids.add("three_consecutive_improvements")

    # five_scans
    if len(sorted_jobs) >= 5:
        earned_ids.add("five_scans")

    # secure_architect
    if latest_score >= 86:
        earned_ids.add("secure_architect")

    # dependency_clean
    if latest_cats.get("dependency", 0) == 0 and len(sorted_jobs) >= 1:
        earned_ids.add("dependency_clean")

    # injection_free
    if latest_cats.get("injection", 0) == 0 and len(sorted_jobs) >= 1:
        earned_ids.add("injection_free")

    return _format_badges(earned_ids, sorted_jobs)


def _format_badges(earned_ids: set[str], sorted_jobs: list[dict] | None = None) -> list[dict]:
    """Build full badge list with earned flag and date."""
    latest_date = ""
    if sorted_jobs:
        lj = sorted_jobs[-1]
        latest_date = str(lj.get("completed_at") or lj.get("updated_at", ""))

    result = []
    for badge_def in BADGE_DEFINITIONS:
        earned = badge_def["id"] in earned_ids
        result.append({
            **badge_def,
            "earned":    earned,
            "earned_on": latest_date if earned else None,
        })
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Full maturity report
# ──────────────────────────────────────────────────────────────────────────────
def get_maturity_report(sorted_jobs: list[dict]) -> dict[str, Any]:
    """
    Return complete maturity status: level, score, badges, progress.

    Parameters
    ----------
    sorted_jobs : list of ScanJob dicts (oldest → newest), may be empty

    Returns
    -------
    dict with score, level, progress_pct, badges, next_level, earned_count
    """
    if not sorted_jobs:
        return {
            "score":        0,
            "level":        get_maturity_level(0),
            "progress_pct": 0,
            "badges":       _format_badges(set()),
            "next_level":   MATURITY_LEVELS[1],
            "earned_count": 0,
        }

    latest = sorted_jobs[-1]
    r      = latest.get("result_json") or {}
    score  = compute_health_score(r, extract_severity_counts(r))
    level  = get_maturity_level(score)
    badges = compute_badges(sorted_jobs)
    earned = sum(1 for b in badges if b["earned"])

    # Next level
    idx = next(
        (i for i, lvl in enumerate(MATURITY_LEVELS) if lvl["id"] == level["id"]),
        len(MATURITY_LEVELS) - 1,
    )
    next_level = MATURITY_LEVELS[min(idx + 1, len(MATURITY_LEVELS) - 1)]

    transparent = get_transparent_maturity_explanation(
        score       = score,
        sev_counts  = extract_severity_counts(r),
        categories  = extract_categories_from_result(latest.get("result_json")),
        recurring   = [],
        scan_count  = len(sorted_jobs),
    )

    return {
        "score":              score,
        "level":              level,
        "progress_pct":       maturity_progress_pct(score),
        "badges":             badges,
        "next_level":         next_level,
        "earned_count":       earned,
        "transparent":        transparent,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Transparent reasoning engine
# ──────────────────────────────────────────────────────────────────────────────
def get_transparent_maturity_explanation(
    score:      int,
    sev_counts: dict[str, int],
    categories: dict[str, int],
    recurring:  list[dict],
    scan_count: int = 1,
) -> dict:
    """
    Return a human-readable explanation of WHY the developer is at their
    current maturity level, and EXACTLY what they need to do to advance.

    Parameters
    ----------
    score      : current health score (0-100)
    sev_counts : {critical, high, medium, low, info} counts
    categories : {category_slug: count} from learning_engine
    recurring  : recurring_categories list from recurring_weakness
    scan_count : total scan count for this repository

    Returns
    -------
    dict with level, score, score_gap, next_level, reasons, to_advance, encouragement
    """
    level      = get_maturity_level(score)
    idx        = next(
        (i for i, lvl in enumerate(MATURITY_LEVELS) if lvl["id"] == level["id"]),
        0,
    )
    next_level = MATURITY_LEVELS[min(idx + 1, len(MATURITY_LEVELS) - 1)]
    score_gap  = max(0, next_level["min_score"] - score)

    crits  = sev_counts.get("critical", 0)
    highs  = sev_counts.get("high", 0)
    meds   = sev_counts.get("medium", 0)
    lows   = sev_counts.get("low", 0)

    # ── Build reasons (WHY this level) ────────────────────────────────────────
    reasons: list[str] = []

    if crits > 0:
        reasons.append(
            f"{crits} critical {'vulnerability' if crits == 1 else 'vulnerabilities'} "
            "present — these are the main driver of your low score"
        )
    if highs > 0:
        reasons.append(
            f"{highs} high-severity {'finding' if highs == 1 else 'findings'} "
            "are pulling your score down significantly"
        )
    if meds > 0 and crits == 0 and highs == 0:
        reasons.append(
            f"{meds} medium-severity issues are the primary factor keeping your score below "
            + str(next_level["min_score"])
        )
    if lows > 0 and crits == 0 and highs == 0 and meds == 0:
        reasons.append(
            f"{lows} low-severity findings are the remaining gap — you're close to the next level"
        )
    if recurring:
        rec_labels = [r.get("label") or r.get("category", "") for r in recurring[:2]]
        if rec_labels:
            reasons.append(
                f"Recurring patterns in {' and '.join(rec_labels)} suggest systemic gaps "
                "not yet addressed in your development process"
            )
    if scan_count == 1:
        reasons.append("This is your first scan — baseline established, now track improvement")
    if not reasons:
        reasons.append(f"Your security health score is {score}/100")

    # ── Build to_advance (HOW to reach next level) ────────────────────────────
    to_advance: list[str] = []

    if score >= 86:
        to_advance = [
            "Maintain zero critical/high findings across all scans",
            "Conduct regular threat modelling sessions",
            "Automate security testing in your CI/CD pipeline",
        ]
    else:
        if crits > 0:
            to_advance.append(
                f"Resolve all {crits} critical {'finding' if crits == 1 else 'findings'} "
                "— these alone will boost your score by the most"
            )
        if highs > 0:
            to_advance.append(
                f"Fix {highs} high-severity {'issue' if highs == 1 else 'issues'} "
                "to move out of the current level"
            )
        if score_gap > 0:
            to_advance.append(
                f"Raise your score by {score_gap} points "
                f"(current: {score} → target: {next_level['min_score']}+) "
                f"to reach '{next_level['label']}'"
            )
        if meds > 0 and not to_advance:
            to_advance.append(
                f"Resolve the {meds} medium-severity findings — they are your main remaining gap"
            )
        if recurring:
            to_advance.append(
                "Break the recurring pattern cycle by adopting preventive tooling "
                "(pre-commit hooks, linting rules, or automated dependency updates)"
            )

    if not to_advance:
        to_advance = [next_level["next_step"]]

    # ── Encouragement ─────────────────────────────────────────────────────────
    encouragement_map = {
        "beginner": (
            "Every expert was once a beginner — your first scan is the hardest step. "
            f"Tackle the critical issues first and watch your score climb."
        ),
        "improving": (
            f"You're already making progress! {score_gap} more points and you reach "
            f"'{next_level['label']}'. Keep going — each fix compounds."
        ),
        "security_aware": (
            "You've built solid security awareness. "
            f"You're {score_gap} points away from '{next_level['label']}' — the home stretch."
        ),
        "hardened": (
            "You're in the top tier of secure developers. "
            "A few more clean scans and you'll reach Secure Architect status."
        ),
        "secure_architect": (
            "Exceptional work — you've reached the highest maturity level. "
            "Your codebase is a model for secure development. Keep it up!"
        ),
    }
    encouragement = encouragement_map.get(level["id"], level["description"])

    return {
        "level":        level["id"],
        "level_label":  level["label"],
        "score":        score,
        "score_gap":    score_gap,
        "next_level":   next_level["id"],
        "next_label":   next_level["label"],
        "reasons":      reasons,
        "to_advance":   to_advance,
        "encouragement": encouragement,
    }
