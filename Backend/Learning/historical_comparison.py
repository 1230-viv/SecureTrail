"""
Historical Comparison Engine — SecureTrail Learning System v3
=============================================================
Pure, deterministic engine that diffs two consecutive scan results to produce:
  - resolved / new / recurring finding counts
  - per-category deltas
  - trend direction (improving / worsening / stable)
  - risk momentum indicator (increasing / decreasing / stable)

No AI dependency — fully rule-based.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from Learning.learning_engine import (
    _get_findings,
    compute_health_score,
    extract_categories_from_result,
    extract_severity_counts,
)

# Severity weights for risk-momentum calculation
_SEV_RISK_WEIGHT: dict[str, int] = {
    "critical": 15,
    "high": 8,
    "medium": 3,
    "low": 1,
    "info": 0,
}


def _fingerprint(finding: dict) -> str:
    """Stable identity key for a finding (rule_id + file + severity)."""
    return "|".join([
        (finding.get("rule_id") or finding.get("check_id") or finding.get("id") or "").strip(),
        (finding.get("file") or finding.get("path") or "").replace("\\", "/").strip(),
        (finding.get("severity") or "info").lower().strip(),
    ])


def _risk_score(sev_counts: dict[str, int]) -> int:
    """Weighted risk score from severity counts (higher = worse)."""
    return sum(_SEV_RISK_WEIGHT.get(sev, 0) * cnt for sev, cnt in sev_counts.items())


def compare_scans(
    current_result: dict | None,
    previous_result: dict | None,
) -> dict[str, Any]:
    """
    Diff two scan result_json dicts and return a rich comparison dict.

    Parameters
    ----------
    current_result  : result_json from the current (newer) scan
    previous_result : result_json from the previous scan (may be None)

    Returns
    -------
    dict with keys:
        is_first_scan            : bool
        trend_direction          : "improving" | "worsening" | "stable"
        risk_momentum            : "increasing" | "decreasing" | "stable"
        score_delta              : int (positive = better)
        current_score            : int
        previous_score           : int | None
        new_findings_count       : int   (in current, not in previous)
        resolved_count           : int   (in previous, not in current)
        recurring_count          : int   (in both scans)
        new_categories           : list[str]
        resolved_categories      : list[str]
        recurring_categories     : list[str]
        category_deltas          : {cat: delta_int}  (positive = more this scan)
        severity_deltas          : {sev: delta_int}
        resolved_severities      : {sev: count}  (what was fixed)
        new_severities           : {sev: count}  (what was introduced)
    """
    cur_result  = current_result  or {}
    prev_result = previous_result or {}

    if not previous_result:
        # First scan — no comparison possible
        cur_sev   = extract_severity_counts(cur_result)
        cur_score = compute_health_score(cur_result, cur_sev)
        cur_cats  = extract_categories_from_result(cur_result)
        cur_findings = _get_findings(cur_result)
        return {
            "is_first_scan":       True,
            "trend_direction":     "stable",
            "risk_momentum":       "stable",
            "score_delta":         None,
            "current_score":       cur_score,
            "previous_score":      None,
            "new_findings_count":  len(cur_findings),
            "resolved_count":      0,
            "recurring_count":     0,
            "new_categories":      list(cur_cats.keys()),
            "resolved_categories": [],
            "recurring_categories": [],
            "category_deltas":     {c: v for c, v in cur_cats.items()},
            "severity_deltas":     {s: v for s, v in cur_sev.items()},
            "resolved_severities": {},
            "new_severities":      dict(cur_sev),
        }

    # ── Severity analysis ──────────────────────────────────────────────────────
    cur_sev  = extract_severity_counts(cur_result)
    prev_sev = extract_severity_counts(prev_result)

    cur_score  = compute_health_score(cur_result, cur_sev)
    prev_score = compute_health_score(prev_result, prev_sev)
    score_delta = cur_score - prev_score

    cur_risk  = _risk_score(cur_sev)
    prev_risk = _risk_score(prev_sev)
    risk_diff = cur_risk - prev_risk

    # Trend from score
    if score_delta > 3:
        trend_direction = "improving"
    elif score_delta < -3:
        trend_direction = "worsening"
    else:
        trend_direction = "stable"

    # Risk momentum from weighted severity risk
    if risk_diff > 5:
        risk_momentum = "increasing"
    elif risk_diff < -5:
        risk_momentum = "decreasing"
    else:
        risk_momentum = "stable"

    # Severity deltas
    all_sevs = set(cur_sev) | set(prev_sev)
    severity_deltas: dict[str, int] = {
        sev: cur_sev.get(sev, 0) - prev_sev.get(sev, 0)
        for sev in all_sevs
    }
    resolved_severities: dict[str, int] = {
        sev: max(0, prev_sev.get(sev, 0) - cur_sev.get(sev, 0))
        for sev in all_sevs
        if prev_sev.get(sev, 0) > cur_sev.get(sev, 0)
    }
    new_severities: dict[str, int] = {
        sev: max(0, cur_sev.get(sev, 0) - prev_sev.get(sev, 0))
        for sev in all_sevs
        if cur_sev.get(sev, 0) > prev_sev.get(sev, 0)
    }

    # ── Category analysis ──────────────────────────────────────────────────────
    cur_cats  = extract_categories_from_result(cur_result)
    prev_cats = extract_categories_from_result(prev_result)

    new_categories:       list[str] = []
    resolved_categories:  list[str] = []
    recurring_categories: list[str] = []
    category_deltas:      dict[str, int] = {}

    all_cats = set(cur_cats) | set(prev_cats)
    for cat in all_cats:
        c = cur_cats.get(cat, 0)
        p = prev_cats.get(cat, 0)
        category_deltas[cat] = c - p
        if p == 0 and c > 0:
            new_categories.append(cat)
        elif c == 0 and p > 0:
            resolved_categories.append(cat)
        elif c > 0 and p > 0:
            recurring_categories.append(cat)

    # ── Finding-level fingerprint diff ────────────────────────────────────────
    cur_fingerprints  = {_fingerprint(f) for f in _get_findings(cur_result)}
    prev_fingerprints = {_fingerprint(f) for f in _get_findings(prev_result)}

    new_count       = len(cur_fingerprints  - prev_fingerprints)
    resolved_count  = len(prev_fingerprints - cur_fingerprints)
    recurring_count = len(cur_fingerprints  & prev_fingerprints)

    return {
        "is_first_scan":        False,
        "trend_direction":      trend_direction,
        "risk_momentum":        risk_momentum,
        "score_delta":          score_delta,
        "current_score":        cur_score,
        "previous_score":       prev_score,
        "new_findings_count":   new_count,
        "resolved_count":       resolved_count,
        "recurring_count":      recurring_count,
        "new_categories":       new_categories,
        "resolved_categories":  resolved_categories,
        "recurring_categories": recurring_categories,
        "category_deltas":      category_deltas,
        "severity_deltas":      severity_deltas,
        "resolved_severities":  resolved_severities,
        "new_severities":       new_severities,
    }
