"""
Learning Engine — SecureTrail Learning System
==============================================
Pure, deterministic algorithms that transform raw scan data into
actionable learning insights.

No AI dependency — all logic is rule-based and reliable.
"""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Any

from Learning.category_knowledge import (
    CAT_GENERIC,
    classify_finding,
    get_knowledge,
)

# ──────────────────────────────────────────────────────────────────────────────
# Severity scoring weights  (used to compute a single health score per scan)
# ──────────────────────────────────────────────────────────────────────────────
SEVERITY_WEIGHTS: dict[str, int] = {
    "critical": 40,
    "high":     20,
    "medium":    8,
    "low":       2,
    "info":      0,
}

# Exploitability factor per category (0.0 – 1.0), used to rank roadmap items
EXPLOITABILITY: dict[str, float] = {
    "injection":       1.0,
    "deserialization": 1.0,
    "ssrf":            0.95,
    "secret_management": 0.95,
    "jwt":             0.90,
    "access_control":  0.85,
    "idor":            0.85,
    "file_upload":     0.80,
    "xss":             0.70,
    "cors":            0.65,
    "rate_limiting":   0.60,
    "crypto":          0.55,
    "dependency":      0.50,
    "logging":         0.30,
    "generic":         0.40,
}


# ──────────────────────────────────────────────────────────────────────────────
# Helper: extract findings list from result_json
# ──────────────────────────────────────────────────────────────────────────────
def _get_findings(result_json: dict | None) -> list[dict]:
    if not result_json:
        return []
    # Result may be nested under "findings", "vulnerabilities", or top-level list
    if isinstance(result_json, list):
        return result_json
    for key in ("findings", "vulnerabilities", "results", "issues"):
        if key in result_json and isinstance(result_json[key], list):
            return result_json[key]
    return []


# ──────────────────────────────────────────────────────────────────────────────
# 1. Category extraction
# ──────────────────────────────────────────────────────────────────────────────
def extract_categories_from_result(result_json: dict | None) -> dict[str, int]:
    """
    Return a mapping {category_slug: count} from raw scan result_json.
    """
    findings = _get_findings(result_json)
    counts: Counter[str] = Counter()
    for f in findings:
        cat = classify_finding(f)
        counts[cat] += 1
    return dict(counts)


def extract_severity_counts(result_json: dict | None) -> dict[str, int]:
    """
    Return {severity: count} normalised to lowercase keys.
    Falls back to top-level count fields if findings list is missing.
    """
    findings = _get_findings(result_json)
    if findings:
        counts: Counter[str] = Counter()
        for f in findings:
            sev = (f.get("severity") or "info").lower()
            counts[sev] += 1
        return dict(counts)

    # Fallback to pre-computed fields
    if result_json:
        return {
            "critical": result_json.get("critical_count", 0),
            "high":     result_json.get("high_count", 0),
            "medium":   result_json.get("medium_count", 0),
            "low":      result_json.get("low_count", 0),
            "info":     result_json.get("info_count", 0),
        }
    return {}


# ──────────────────────────────────────────────────────────────────────────────
# 2. Health score  (0 = worst, 100 = clean)
# ──────────────────────────────────────────────────────────────────────────────
def compute_health_score(
    result_json: dict | None,
    sev_counts: dict[str, int] | None = None,
) -> int:
    """
    Compute a 0-100 health score for a single scan.
    Uses pre-aggregated sev_counts when available (faster).
    """
    if sev_counts is None:
        sev_counts = extract_severity_counts(result_json)

    penalty = 0
    for sev, weight in SEVERITY_WEIGHTS.items():
        count = sev_counts.get(sev, 0)
        if count and weight:
            # Diminishing returns: log scale so one critical ≠ infinite penalty
            penalty += weight * (1 + math.log(count))

    score = max(0, 100 - int(penalty))
    return score


# ──────────────────────────────────────────────────────────────────────────────
# 3. Per-scan learning summary + comparison
# ──────────────────────────────────────────────────────────────────────────────
def compute_learning_summary(
    current_job: dict[str, Any],
    previous_job: dict[str, Any] | None,
) -> dict[str, Any]:
    """
    Produce a rich learning summary for a scan, optionally compared to
    the previous scan of the same repository.

    Parameters
    ----------
    current_job  : ScanJob dict (with result_json field)
    previous_job : previous ScanJob dict or None (first scan)

    Returns
    -------
    dict with keys:
        job_id, repository_name, health_score, sev_counts, categories,
        score_delta, improved_categories, worsened_categories,
        new_categories, resolved_categories, recurring_weaknesses,
        top_findings, is_first_scan
    """
    cur_result  = current_job.get("result_json") or {}
    prev_result = previous_job.get("result_json") or {} if previous_job else {}

    cur_sev   = extract_severity_counts(cur_result)
    prev_sev  = extract_severity_counts(prev_result) if previous_job else {}

    cur_score  = compute_health_score(cur_result, cur_sev)
    prev_score = compute_health_score(prev_result, prev_sev) if previous_job else None

    cur_cats  = extract_categories_from_result(cur_result)
    prev_cats = extract_categories_from_result(prev_result) if previous_job else {}

    improved_cats:   list[dict] = []
    worsened_cats:   list[dict] = []
    new_cats:        list[dict] = []
    resolved_cats:   list[dict] = []
    recurring_cats:  list[dict] = []

    all_keys = set(cur_cats) | set(prev_cats)
    for cat in all_keys:
        c = cur_cats.get(cat, 0)
        p = prev_cats.get(cat, 0)
        knowledge = get_knowledge(cat)
        entry = {
            "category":    cat,
            "label":       knowledge["label"],
            "color":       knowledge["color"],
            "current":     c,
            "previous":    p,
            "delta":       c - p,
        }
        if p == 0 and c > 0:
            new_cats.append(entry)
        elif c == 0 and p > 0:
            resolved_cats.append(entry)
        elif c < p:
            improved_cats.append(entry)
        elif c > p:
            worsened_cats.append(entry)
        elif c > 0 and c == p:
            recurring_cats.append(entry)

    # Sort by impact
    worsened_cats.sort(key=lambda x: x["delta"], reverse=True)

    # Top findings (by severity weight)
    findings = _get_findings(cur_result)
    _sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    top_findings = sorted(
        findings,
        key=lambda f: _sev_order.get((f.get("severity") or "info").lower(), 5),
    )[:10]

    return {
        "job_id":               str(current_job.get("id")),
        "repository_name":      current_job.get("repository_name", ""),
        "scan_date":            str(current_job.get("completed_at") or current_job.get("updated_at", "")),
        "health_score":         cur_score,
        "previous_score":       prev_score,
        "score_delta":          (cur_score - prev_score) if prev_score is not None else None,
        "sev_counts":           cur_sev,
        "categories":           {
            k: {"count": v, "knowledge": get_knowledge(k)}
            for k, v in cur_cats.items()
        },
        "improved_categories":  improved_cats,
        "worsened_categories":  worsened_cats,
        "new_categories":       new_cats,
        "resolved_categories":  resolved_cats,
        "recurring_weaknesses": recurring_cats,
        "top_findings":         top_findings,
        "is_first_scan":        previous_job is None,
        "total_vulns":          sum(cur_sev.values()),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 4. Progress metrics across multiple scans
# ──────────────────────────────────────────────────────────────────────────────
def compute_progress_metrics(sorted_jobs: list[dict]) -> dict[str, Any]:
    """
    Given a list of ScanJob dicts ordered oldest → newest,
    return trend metrics and per-scan score history.

    Returns
    -------
    dict with:
        score_history       : [{job_id, scan_date, score, total_vulns}, ...]
        trend               : "improving" | "declining" | "stable"
        improvement_pct     : float  (positive = better over time)
        best_score          : int
        worst_score         : int
        consecutive_improvements : int  (streak ending at latest scan)
        category_trends     : {category: [count_per_scan, ...]}
    """
    if not sorted_jobs:
        return {
            "score_history":            [],
            "trend":                    "stable",
            "improvement_pct":          0.0,
            "best_score":               0,
            "worst_score":              0,
            "consecutive_improvements": 0,
            "category_trends":          {},
        }

    score_history: list[dict] = []
    category_trends: defaultdict[str, list[int]] = defaultdict(list)

    for job in sorted_jobs:
        result = job.get("result_json") or {}
        sev    = extract_severity_counts(result)
        score  = compute_health_score(result, sev)
        cats   = extract_categories_from_result(result)

        score_history.append({
            "job_id":     str(job.get("id")),
            "scan_date":  str(job.get("completed_at") or job.get("updated_at", "")),
            "score":      score,
            "total_vulns": sum(sev.values()),
            **sev,
        })

        for cat, count in cats.items():
            category_trends[cat].append(count)

    scores = [s["score"] for s in score_history]

    # Trend: compare first half avg vs second half avg
    mid = len(scores) // 2
    first_half_avg  = sum(scores[:mid or 1]) / (mid or 1)
    second_half_avg = sum(scores[mid:])      / len(scores[mid:])

    if second_half_avg - first_half_avg > 3:
        trend = "improving"
    elif first_half_avg - second_half_avg > 3:
        trend = "declining"
    else:
        trend = "stable"

    # Improvement %: (latest - first) / max(first, 1) * 100
    first_score  = scores[0]
    latest_score = scores[-1]
    improvement_pct = round((latest_score - first_score) / max(first_score, 1) * 100, 1)

    # Consecutive improvement streak (scanning latest → older)
    streak = 0
    for i in range(len(scores) - 1, 0, -1):
        if scores[i] > scores[i - 1]:
            streak += 1
        else:
            break

    return {
        "score_history":            score_history,
        "trend":                    trend,
        "improvement_pct":          improvement_pct,
        "best_score":               max(scores),
        "worst_score":              min(scores),
        "consecutive_improvements": streak,
        "category_trends":          dict(category_trends),
    }


# ──────────────────────────────────────────────────────────────────────────────
# 5. Fix Priority Roadmap
# ──────────────────────────────────────────────────────────────────────────────
def build_priority_roadmap(
    result_json: dict | None,
    top_n: int = 10,
) -> list[dict]:
    """
    Return the top N vulnerability categories to fix, sorted by a composite
    priority score = exploitability × (1 + log(count)) × severity_factor.

    Each roadmap item includes the knowledge entry for developer guidance.
    """
    cats  = extract_categories_from_result(result_json)
    findings = _get_findings(result_json)

    # Count severe findings per category
    sev_factor_by_cat: defaultdict[str, float] = defaultdict(float)
    for f in findings:
        sev = (f.get("severity") or "info").lower()
        cat = classify_finding(f)
        sev_factor_by_cat[cat] += SEVERITY_WEIGHTS.get(sev, 0)

    items: list[dict] = []
    for cat, count in cats.items():
        if cat == CAT_GENERIC:
            continue
        exploit   = EXPLOITABILITY.get(cat, 0.4)
        sev_bonus = math.log1p(sev_factor_by_cat.get(cat, 0))
        priority  = exploit * (1 + math.log(count)) * (1 + sev_bonus)
        knowledge = get_knowledge(cat)
        items.append({
            "category":       cat,
            "label":          knowledge["label"],
            "color":          knowledge["color"],
            "count":          count,
            "priority_score": round(priority, 3),
            "exploitability": exploit,
            "checklist":      knowledge["checklist"],
            "secure_pattern": knowledge["secure_pattern"],
            "cwe_refs":       knowledge["cwe_refs"],
        })

    items.sort(key=lambda x: x["priority_score"], reverse=True)
    return items[:top_n]
