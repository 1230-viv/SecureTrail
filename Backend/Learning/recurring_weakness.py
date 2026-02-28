"""
Recurring Weakness Detector — SecureTrail Learning System
==========================================================
Fully DETERMINISTIC. Zero AI dependency.

Analyses a chronological list of scan jobs and surfaces:
  1. Categories appearing in N+ consecutive scans
  2. CWE IDs that recur across scans
  3. File/path patterns that keep appearing
  4. Severity escalation (same category getting worse)
  5. Stagnation (category never improving despite multiple scans)

All logic is pure Python — no external calls, no LLM, always reliable.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from typing import Any

from Learning.category_knowledge import classify_finding, get_knowledge
from Learning.learning_engine import (
    _get_findings,
    extract_categories_from_result,
    extract_severity_counts,
    compute_health_score,
)

# ── Thresholds ────────────────────────────────────────────────────────────────
RECURRING_SCAN_THRESHOLD = 3   # category must appear in this many scans to flag
CWE_RECURRING_THRESHOLD  = 2   # CWE must appear this many scans
FILE_PATTERN_THRESHOLD   = 2   # same file must appear in this many scans
STAGNATION_SCANS         = 3   # N scans with no improvement = stagnation

# ── Severity ordering ─────────────────────────────────────────────────────────
_SEV_RANK = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _extract_cwes(findings: list[dict]) -> list[str]:
    """Extract all CWE IDs from a finding list."""
    cwes = []
    for f in findings:
        # Try dedicated cwe field
        cwe_raw = f.get("cwe") or f.get("cwe_id") or ""
        if cwe_raw:
            # Normalise: "CWE-89" or "89" → "CWE-89"
            m = re.search(r'\d{2,4}', str(cwe_raw))
            if m:
                cwes.append(f"CWE-{m.group()}")
        # Also scan rule_id for CWE references
        rule = str(f.get("rule_id") or "").lower()
        for m in re.finditer(r'cwe[-_]?(\d{2,4})', rule):
            cwes.append(f"CWE-{m.group(1)}")
    return cwes


def _extract_files(findings: list[dict]) -> list[str]:
    """Return list of file paths from findings, normalised."""
    files = []
    for f in findings:
        path = f.get("file") or f.get("path") or f.get("filename") or ""
        if path:
            # Strip leading slashes / repo prefixes, keep last 3 path segments
            parts = path.replace("\\", "/").split("/")
            files.append("/".join(parts[-3:]) if len(parts) >= 3 else path)
    return files


def _max_severity_rank(findings: list[dict]) -> int:
    """Return the highest severity rank among findings."""
    return max(
        (_SEV_RANK.get((f.get("severity") or "info").lower(), 0) for f in findings),
        default=0,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1. Category recurrence
# ─────────────────────────────────────────────────────────────────────────────

def detect_recurring_categories(sorted_jobs: list[dict]) -> list[dict]:
    """
    Return categories that appear in RECURRING_SCAN_THRESHOLD or more scans.
    Each result includes streak length, scan count, and suggested message.
    """
    if not sorted_jobs:
        return []

    # Per-scan category counts
    per_scan: list[dict[str, int]] = [
        extract_categories_from_result(j.get("result_json")) for j in sorted_jobs
    ]

    # How many scans does each category appear in?
    appearance_counts: Counter[str] = Counter()
    for scan_cats in per_scan:
        for cat in scan_cats:
            appearance_counts[cat] += 1

    # Track consecutive streak (most recent scans)
    streak_by_cat: dict[str, int] = {}
    for cat in appearance_counts:
        streak = 0
        for scan_cats in reversed(per_scan):
            if scan_cats.get(cat, 0) > 0:
                streak += 1
            else:
                break
        streak_by_cat[cat] = streak

    results = []
    for cat, total_appearances in appearance_counts.items():
        if total_appearances < RECURRING_SCAN_THRESHOLD:
            continue
        knowledge = get_knowledge(cat)
        consecutive = streak_by_cat.get(cat, 0)

        # Compute trend across appearances
        counts_timeline = [s.get(cat, 0) for s in per_scan if s.get(cat, 0) > 0]
        if len(counts_timeline) >= 2:
            if counts_timeline[-1] > counts_timeline[0]:
                trend = "escalating"
            elif counts_timeline[-1] < counts_timeline[0]:
                trend = "improving_but_present"
            else:
                trend = "stagnant"
        else:
            trend = "stagnant"

        # Human-readable message
        suggestion = _category_suggestion(cat, total_appearances, consecutive, trend)

        results.append({
            "category":           cat,
            "label":              knowledge["label"],
            "color":              knowledge["color"],
            "total_appearances":  total_appearances,
            "consecutive_streak": consecutive,
            "trend":              trend,
            "message":            (
                f"{knowledge['label']} issues have appeared in "
                f"{total_appearances} of {len(sorted_jobs)} scans."
            ),
            "suggestion":         suggestion,
            "checklist":          knowledge.get("checklist", [])[:3],
        })

    # Sort by consecutive streak desc, then total appearances
    results.sort(key=lambda x: (x["consecutive_streak"], x["total_appearances"]), reverse=True)
    return results


def _category_suggestion(cat: str, appearances: int, streak: int, trend: str) -> str:
    SUGGESTIONS = {
        "secret_management": (
            "Secrets are repeatedly committed to source. "
            "Install pre-commit hooks with Gitleaks and rotate all exposed credentials immediately."
        ),
        "access_control": (
            "Access control failures appear consistently. "
            "Implement a centralized permission-check decorator/middleware applied to all routes."
        ),
        "idor": (
            "IDOR issues persist across scans. "
            "Enforce owner_id filtering on every DB query and write cross-user access integration tests."
        ),
        "injection": (
            "Injection vulnerabilities keep reappearing. "
            "Adopt an ORM or parameterised query helper and enforce it in code review checklists."
        ),
        "dependency": (
            "Outdated dependencies recur. "
            "Enable Dependabot or Renovate with auto-merge for patch versions and weekly security reviews."
        ),
        "jwt": (
            "JWT misconfigurations persist. "
            "Centralise token validation to one utility and enforce it via a middleware/dependency."
        ),
        "cors": (
            "CORS misconfiguration keeps surfacing. "
            "Define an explicit origin allowlist in your environment config and test it in CI."
        ),
        "rate_limiting": (
            "Rate limiting is consistently missing. "
            "Apply a global rate-limit middleware and document limits per endpoint in your API spec."
        ),
        "xss": (
            "XSS issues recurring. "
            "Enable template auto-escaping globally and add a Content-Security-Policy header."
        ),
    }
    base = SUGGESTIONS.get(
        cat,
        f"This category has appeared in {appearances} scans. "
        "Consider adding a dedicated security test suite for this pattern."
    )
    if trend == "escalating":
        base = "⚠️ ESCALATING: " + base
    elif streak >= RECURRING_SCAN_THRESHOLD:
        base = "🔁 PERSISTENT: " + base
    return base


# ─────────────────────────────────────────────────────────────────────────────
# 2. CWE recurrence
# ─────────────────────────────────────────────────────────────────────────────

def detect_recurring_cwes(sorted_jobs: list[dict]) -> list[dict]:
    """
    Return CWE IDs that appear across CWE_RECURRING_THRESHOLD or more scans.
    """
    cwe_scan_presence: defaultdict[str, int] = defaultdict(int)

    for job in sorted_jobs:
        findings  = _get_findings(job.get("result_json"))
        cwes_this = set(_extract_cwes(findings))  # dedupe within scan
        for cwe in cwes_this:
            cwe_scan_presence[cwe] += 1

    results = []
    for cwe, scan_count in cwe_scan_presence.items():
        if scan_count < CWE_RECURRING_THRESHOLD:
            continue
        results.append({
            "cwe_id":      cwe,
            "scan_count":  scan_count,
            "message":     f"{cwe} has been detected in {scan_count} scans.",
        })

    results.sort(key=lambda x: x["scan_count"], reverse=True)
    return results[:10]  # top 10 only


# ─────────────────────────────────────────────────────────────────────────────
# 3. File pattern recurrence
# ─────────────────────────────────────────────────────────────────────────────

def detect_recurring_files(sorted_jobs: list[dict]) -> list[dict]:
    """
    Return file paths that appear in findings across multiple scans.
    """
    file_scan_presence: defaultdict[str, int] = defaultdict(int)
    file_categories: defaultdict[str, set] = defaultdict(set)

    for job in sorted_jobs:
        findings   = _get_findings(job.get("result_json"))
        files_this = set()
        for f in findings:
            path = (f.get("file") or f.get("path") or "").replace("\\", "/")
            if not path:
                continue
            parts = path.split("/")
            short = "/".join(parts[-3:]) if len(parts) >= 3 else path
            files_this.add(short)
            file_categories[short].add(classify_finding(f))
        for path in files_this:
            file_scan_presence[path] += 1

    results = []
    for path, scan_count in file_scan_presence.items():
        if scan_count < FILE_PATTERN_THRESHOLD:
            continue
        cats = list(file_categories[path])
        results.append({
            "file":        path,
            "scan_count":  scan_count,
            "categories":  cats,
            "message": (
                f"'{path}' has had security findings in {scan_count} scans "
                f"({', '.join(cats[:3])})."
            ),
        })

    results.sort(key=lambda x: x["scan_count"], reverse=True)
    return results[:10]


# ─────────────────────────────────────────────────────────────────────────────
# 4. Stagnation detection
# ─────────────────────────────────────────────────────────────────────────────

def detect_stagnation(sorted_jobs: list[dict]) -> list[dict]:
    """
    Detect categories that have shown no improvement over STAGNATION_SCANS
    consecutive scans (count is flat or increasing).
    """
    if len(sorted_jobs) < STAGNATION_SCANS:
        return []

    # Use the last STAGNATION_SCANS jobs
    recent = sorted_jobs[-STAGNATION_SCANS:]
    per_scan = [extract_categories_from_result(j.get("result_json")) for j in recent]
    all_cats = set().union(*per_scan)

    stagnant = []
    for cat in all_cats:
        counts = [s.get(cat, 0) for s in per_scan]
        # All counts > 0 and last count >= first count = stagnant/worsening
        if all(c > 0 for c in counts) and counts[-1] >= counts[0]:
            knowledge = get_knowledge(cat)
            stagnant.append({
                "category":    cat,
                "label":       knowledge["label"],
                "color":       knowledge["color"],
                "counts":      counts,
                "message": (
                    f"{knowledge['label']} has not improved in the last "
                    f"{STAGNATION_SCANS} scans ({' → '.join(str(c) for c in counts)})."
                ),
            })

    stagnant.sort(key=lambda x: x["counts"][-1], reverse=True)
    return stagnant


# ─────────────────────────────────────────────────────────────────────────────
# 5. Full recurring weakness report
# ─────────────────────────────────────────────────────────────────────────────

def get_recurring_weakness_report(sorted_jobs: list[dict]) -> dict[str, Any]:
    """
    Master function: run all deterministic detectors and return a unified report.
    This is the single entry point consumed by the learning route.

    Parameters
    ----------
    sorted_jobs : ScanJob dicts ordered oldest → newest

    Returns
    -------
    dict with:
        has_recurring_patterns : bool
        recurring_categories   : list[dict]
        recurring_cwes         : list[dict]
        recurring_files        : list[dict]
        stagnant_categories    : list[dict]
        summary_text           : str
    """
    if len(sorted_jobs) < 2:
        return {
            "has_recurring_patterns": False,
            "recurring_categories":   [],
            "recurring_cwes":         [],
            "recurring_files":        [],
            "stagnant_categories":    [],
            "summary_text":           "Not enough scan history for pattern detection (need 2+ scans).",
        }

    rec_cats  = detect_recurring_categories(sorted_jobs)
    rec_cwes  = detect_recurring_cwes(sorted_jobs)
    rec_files = detect_recurring_files(sorted_jobs)
    stagnant  = detect_stagnation(sorted_jobs)

    has_patterns = bool(rec_cats or stagnant)

    # Build a single-sentence summary
    if not has_patterns:
        summary = "No strong recurring patterns detected. Keep scanning regularly."
    else:
        parts = []
        if rec_cats:
            parts.append(
                f"{len(rec_cats)} category{'s' if len(rec_cats)>1 else ''} "
                f"recurring across scans ({', '.join(c['label'] for c in rec_cats[:3])})"
            )
        if stagnant:
            parts.append(
                f"{len(stagnant)} stagnant area{'s' if len(stagnant)>1 else ''} "
                f"with no improvement"
            )
        summary = "Recurring patterns detected: " + "; ".join(parts) + "."

    return {
        "has_recurring_patterns": has_patterns,
        "recurring_categories":   rec_cats,
        "recurring_cwes":         rec_cwes[:5],
        "recurring_files":        rec_files[:5],
        "stagnant_categories":    stagnant,
        "summary_text":           summary,
    }
