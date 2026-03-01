"""
Habit Confidence Scoring — SecureTrail Learning System v3
===========================================================
Upgrades habit detection from binary (present/absent) to a continuous
confidence model that tracks frequency, recurrence, and time signals.

Habit Confidence Score (0–100):
  Base score = (occurrences / total_scans) × 100
  Recurrence multiplier: ×1.25 if seen in >50% of scans
  Recency decay: −20 if not seen in last 2 scans, −5 if not seen in last scan
  Trend bonus: +10 if count is increasing, −10 if strictly decreasing
  Clamped to [0, 100]

Trend classification:
  "Improving"  — category no longer present in latest N scans but was present before
  "Regressing" — category just appeared or increased count
  "Stable"     — category present consistently with no change

All computation is deterministic — no AI dependency.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from Utils.logger import get_logger

logger = get_logger("habit_tracker")


# ── Public entry point ────────────────────────────────────────────────────────

def compute_habit_confidence(
    pattern_name: str,
    trigger_category: str,
    scan_history: list[dict],
) -> dict[str, Any]:
    """
    Compute the habit confidence record for a single habit across all scans.

    Parameters
    ----------
    pattern_name      : human label (e.g. "Hardcoded Credentials")
    trigger_category  : slug (e.g. "secret_management")
    scan_history      : list of scan records, OLDEST → NEWEST, each:
        {
          "scan_id":      str,
          "scanned_at":   ISO-8601 str,
          "categories":   list[str],   # category slugs found in this scan
          "count":        int,         # number of findings in trigger_category
        }

    Returns
    -------
    dict:
        pattern_name           str
        trigger_category       str
        occurrence_count       int    (scans where habit was present)
        scan_count             int    (total scans considered)
        recurrence_rate        float  (0.0–1.0)
        confidence_score       int    (0–100)
        trend                  "Improving" | "Stable" | "Regressing" | "New"
        first_detected_at      str | None
        last_detected_at       str | None
        last_count             int    (finding count in most recent scan)
        count_history          list[int]  (per-scan counts, oldest first)
    """
    total_scans = len(scan_history)
    if total_scans == 0:
        return _empty_record(pattern_name, trigger_category)

    # Build per-scan presence and count arrays (oldest → newest)
    presence: list[bool] = []
    counts: list[int] = []
    dates: list[str | None] = []

    for entry in scan_history:
        cats = entry.get("categories") or []
        cnt  = entry.get("count", 0) if trigger_category in cats else 0
        present = trigger_category in cats
        presence.append(present)
        counts.append(cnt)
        dates.append(entry.get("scanned_at"))

    occurrence_count = sum(presence)
    recurrence_rate  = occurrence_count / total_scans

    # ── First / last detected ───────────────────────────────────────────────
    first_detected_at: str | None = None
    last_detected_at:  str | None = None
    for i, p in enumerate(presence):
        if p:
            if first_detected_at is None:
                first_detected_at = dates[i]
            last_detected_at = dates[i]

    # ── Base confidence score ─────────────────────────────────────────────
    base = recurrence_rate * 100

    # Recurrence multiplier
    if recurrence_rate > 0.5:
        base = min(100, base * 1.25)

    # Recent-scan recency decay
    if total_scans >= 2 and not presence[-1] and not presence[-2]:
        base = max(0, base - 20)
    elif total_scans >= 1 and not presence[-1]:
        base = max(0, base - 5)

    # Trend bonus/penalty
    trend = _compute_trend(presence, counts)
    if trend == "Improving":
        base = max(0, base - 10)
    elif trend == "Regressing":
        base = min(100, base + 10)

    confidence_score = max(0, min(100, round(base)))

    return {
        "pattern_name":       pattern_name,
        "trigger_category":   trigger_category,
        "occurrence_count":   occurrence_count,
        "scan_count":         total_scans,
        "recurrence_rate":    round(recurrence_rate, 3),
        "confidence_score":   confidence_score,
        "trend":              trend,
        "first_detected_at":  first_detected_at,
        "last_detected_at":   last_detected_at,
        "last_count":         counts[-1] if counts else 0,
        "count_history":      counts,
    }


def _compute_trend(
    presence: list[bool],
    counts:   list[int],
) -> str:
    """Classify the trend based on presence/count trajectory."""
    n = len(presence)
    if n == 0:
        return "Stable"

    if sum(presence) == 0:
        return "Stable"  # never seen

    if n == 1:
        return "New"

    # Recent window: last 3 scans vs previous 3
    window = min(3, n // 2) or 1
    recent_counts  = counts[-window:]
    earlier_counts = counts[max(0, -window * 2): -window]

    recent_sum  = sum(recent_counts)
    earlier_sum = sum(earlier_counts)

    # Improving: category cleared in last scan(s)
    if not presence[-1]:
        if n >= 2 and presence[-2]:
            return "Improving"
        if recent_sum == 0 and earlier_sum > 0:
            return "Improving"

    # Regressing: category appeared or count increased
    if presence[-1] and not any(presence[:-1]):
        return "Regressing"  # "New" is a form of regression

    if recent_sum > earlier_sum and earlier_sum > 0:
        return "Regressing"
    if recent_sum < earlier_sum and earlier_sum > 0:
        return "Improving"

    return "Stable"


def _empty_record(pattern_name: str, trigger_category: str) -> dict:
    return {
        "pattern_name":       pattern_name,
        "trigger_category":   trigger_category,
        "occurrence_count":   0,
        "scan_count":         0,
        "recurrence_rate":    0.0,
        "confidence_score":   0,
        "trend":              "Stable",
        "first_detected_at":  None,
        "last_detected_at":   None,
        "last_count":         0,
        "count_history":      [],
    }


# ── Batch helper ──────────────────────────────────────────────────────────────

def build_scan_history_entry(job_dict: dict) -> dict:
    """Convert a scan job dict to a scan_history entry for compute_habit_confidence."""
    from Learning.learning_engine import extract_categories_from_result
    result_json = job_dict.get("result_json") or {}
    cats = extract_categories_from_result(result_json)
    # Per-category counts
    return {
        "scan_id":    job_dict.get("id", ""),
        "scanned_at": job_dict.get("completed_at") or job_dict.get("created_at"),
        "categories": cats,
        # build a count dict: we'll look up specific category counts when calling
        "count":      0,  # will be populated per-category by caller
    }


def build_scan_history_for_category(job_dicts: list[dict], category: str) -> list[dict]:
    """
    Build a scan_history list scoped to a single category.
    Each entry has 'count' = number of findings in that category for the scan.
    """
    from Learning.learning_engine import extract_categories_from_result, _get_findings
    from Learning.category_knowledge import classify_finding
    entries = []
    for j in job_dicts:
        result_json = j.get("result_json") or {}
        all_findings = _get_findings(result_json)
        cat_count = sum(1 for f in all_findings if classify_finding(f) == category)
        all_cats = extract_categories_from_result(result_json)
        entries.append({
            "scan_id":    j.get("id", ""),
            "scanned_at": j.get("completed_at") or j.get("created_at"),
            "categories": all_cats,
            "count":      cat_count,
        })
    return entries


def compute_all_habit_confidence(
    job_dicts: list[dict],
) -> list[dict]:
    """
    Compute habit confidence for all known behavioral rules across all scan history.

    Parameters
    ----------
    job_dicts : list of job dicts, OLDEST → NEWEST

    Returns
    -------
    list of habit_confidence dicts (one per behavioral rule that triggered at least once)
    """
    from Learning.behavioral_insights import BEHAVIORAL_RULES

    results = []
    for rule in BEHAVIORAL_RULES:
        cat  = rule["trigger_category"]
        name = rule["pattern_name"]
        history = build_scan_history_for_category(job_dicts, cat)
        record  = compute_habit_confidence(name, cat, history)
        if record["occurrence_count"] > 0:
            results.append(record)

    # Sort by confidence_score descending (highest risk habits first)
    results.sort(key=lambda r: r["confidence_score"], reverse=True)
    return results
