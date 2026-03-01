"""
Skill Tree System — SecureTrail Learning System v3
===================================================
Replaces the single XP bar with six independent skill domains.

Domains:
  auth_authz        — Authentication & Authorization
  secrets           — Secrets Management
  api_protection    — API Protection
  input_validation  — Input Validation
  dependency        — Dependency Hygiene
  secure_arch       — Secure Architecture

Each domain:
  - Has its own XP bucket (computed from scan diffs)
  - Levels independently on a 0-999+ XP scale
  - Gains XP when related vulnerabilities are resolved
  - Loses up to 30% of gained XP if regressions occur in the same scan

XP Computation:
  All computation is deterministic, derived from historical_comparison diffs.
  AI does NOT compute XP — only this module does.

Level thresholds (per-domain):
  1 Beginner       0–99
  2 Practitioner   100–249
  3 Intermediate   250–499
  4 Advanced       500–999
  5 Expert        1000+
"""

from __future__ import annotations

from typing import Any

from Utils.logger import get_logger

logger = get_logger("skill_tree")

# ── Skill domain definitions ──────────────────────────────────────────────────
SKILL_DOMAINS: list[dict[str, Any]] = [
    {
        "id":           "auth_authz",
        "label":        "Authentication & Authorization",
        "icon":         "Shield",
        "color":        "#6366f1",
        "categories":   ["access_control", "idor", "jwt", "authentication"],
        "description":  "Controls who can access what. Covers session management, token validation, and permission checks.",
    },
    {
        "id":           "secrets",
        "label":        "Secrets Management",
        "icon":         "Key",
        "color":        "#f59e0b",
        "categories":   ["secret_management", "cryptography", "hardcoded_credentials"],
        "description":  "Ensures credentials, keys, and tokens are never hardcoded or exposed.",
    },
    {
        "id":           "api_protection",
        "label":        "API Protection",
        "icon":         "Globe",
        "color":        "#10b981",
        "categories":   ["cors", "rate_limiting", "api_security", "ssrf"],
        "description":  "Protects API endpoints from misuse: rate limits, CORS, and server-side request controls.",
    },
    {
        "id":           "input_validation",
        "label":        "Input Validation",
        "icon":         "AlertTriangle",
        "color":        "#ef4444",
        "categories":   ["injection", "xss", "path_traversal", "xxe", "open_redirect"],
        "description":  "Validates and sanitises all untrusted input before processing or rendering.",
    },
    {
        "id":           "dependency",
        "label":        "Dependency Hygiene",
        "icon":         "Package",
        "color":        "#8b5cf6",
        "categories":   ["dependency", "outdated_dependency", "vulnerable_component"],
        "description":  "Keeps third-party packages up to date and free from known vulnerabilities.",
    },
    {
        "id":           "secure_arch",
        "label":        "Secure Architecture",
        "icon":         "Layers",
        "color":        "#0ea5e9",
        "categories":   ["secure_headers", "logging", "error_handling", "configuration", "deserialization"],
        "description":  "Applies defence-in-depth principles: headers, logging, error handling, and config hardening.",
    },
]

# ── Domain ID → domain dict index ────────────────────────────────────────────
_DOMAIN_BY_ID: dict[str, dict] = {d["id"]: d for d in SKILL_DOMAINS}

# ── Category → domain ID map ─────────────────────────────────────────────────
_CATEGORY_TO_DOMAIN: dict[str, str] = {}
for _d in SKILL_DOMAINS:
    for _cat in _d["categories"]:
        _CATEGORY_TO_DOMAIN[_cat] = _d["id"]


def category_to_domain(category: str) -> str | None:
    """Return the domain ID for a given category slug, or None if unknown."""
    return _CATEGORY_TO_DOMAIN.get(category)


# ── Level thresholds ──────────────────────────────────────────────────────────
DOMAIN_LEVELS: list[dict] = [
    {"level": 1, "label": "Beginner",      "min_xp": 0,    "max_xp": 99},
    {"level": 2, "label": "Practitioner",  "min_xp": 100,  "max_xp": 249},
    {"level": 3, "label": "Intermediate",  "min_xp": 250,  "max_xp": 499},
    {"level": 4, "label": "Advanced",      "min_xp": 500,  "max_xp": 999},
    {"level": 5, "label": "Expert",        "min_xp": 1000, "max_xp": 999999},
]

# ── XP per resolved finding per severity ─────────────────────────────────────
DOMAIN_XP_PER_RESOLVED: dict[str, int] = {
    "critical": 25,
    "high":     15,
    "medium":    8,
    "low":       3,
    "info":      1,
}

# ── Regression XP penalty (fraction of gained XP in same scan) ───────────────
REGRESSION_PENALTY_FRACTION = 0.30


def get_level_for_xp(xp: int) -> dict:
    for lvl in reversed(DOMAIN_LEVELS):
        if xp >= lvl["min_xp"]:
            return lvl
    return DOMAIN_LEVELS[0]


def _progress_pct(xp: int, level: dict) -> int:
    if level["level"] == len(DOMAIN_LEVELS):
        return 100
    band = level["max_xp"] - level["min_xp"] + 1
    return min(100, max(0, int((xp - level["min_xp"]) / band * 100)))


# ── XP delta computation (deterministic from scan diff) ───────────────────────

def compute_domain_xp_delta(
    resolved_by_category: dict[str, dict[str, int]],
    regressed_by_category: dict[str, dict[str, int]],
) -> dict[str, int]:
    """
    Compute XP delta per domain for a single scan transition.

    Parameters
    ----------
    resolved_by_category  : {category_slug: {severity: count}} resolved this scan
    regressed_by_category : {category_slug: {severity: count}} new findings this scan
                            (regressions reduce gained XP by REGRESSION_PENALTY_FRACTION)

    Returns
    -------
    {domain_id: xp_delta}  (can be negative due to clamping at 0 after penalty)
    """
    gained:    dict[str, int] = {d["id"]: 0 for d in SKILL_DOMAINS}
    penalized: dict[str, int] = {d["id"]: 0 for d in SKILL_DOMAINS}

    for cat, sev_counts in resolved_by_category.items():
        domain_id = category_to_domain(cat)
        if not domain_id:
            # Unclassified category → distribute to secure_arch as a catch-all
            domain_id = "secure_arch"
        for sev, count in sev_counts.items():
            gained[domain_id] += DOMAIN_XP_PER_RESOLVED.get(sev.lower(), 1) * count

    for cat, sev_counts in regressed_by_category.items():
        domain_id = category_to_domain(cat) or "secure_arch"
        for sev, count in sev_counts.items():
            penalized[domain_id] += DOMAIN_XP_PER_RESOLVED.get(sev.lower(), 1) * count

    deltas: dict[str, int] = {}
    for d_id in [d["id"] for d in SKILL_DOMAINS]:
        raw_gained = gained[d_id]
        penalty    = round(penalized[d_id] * REGRESSION_PENALTY_FRACTION)
        deltas[d_id] = max(0, raw_gained - penalty)

    return deltas


def apply_domain_xp_delta(
    current_xp: dict[str, int],
    delta: dict[str, int],
    scan_id: str = "",
) -> dict[str, Any]:
    """
    Apply XP deltas to current domain XP totals and return full skill tree state.

    Parameters
    ----------
    current_xp : {domain_id: xp} current stored totals
    delta      : {domain_id: xp_delta} from compute_domain_xp_delta
    scan_id    : for logging

    Returns
    -------
    {
        "domains": list of domain state dicts,
        "total_xp": int,
        "delta": dict[str, int],
    }
    """
    domains_out = []
    total_xp = 0
    for d in SKILL_DOMAINS:
        d_id = d["id"]
        prev_xp = current_xp.get(d_id, 0)
        xp_gain = delta.get(d_id, 0)
        new_xp  = prev_xp + xp_gain

        prev_level = get_level_for_xp(prev_xp)
        new_level  = get_level_for_xp(new_xp)

        domains_out.append({
            "id":               d_id,
            "label":            d["label"],
            "icon":             d["icon"],
            "color":            d["color"],
            "description":      d["description"],
            "xp":               new_xp,
            "xp_gained":        xp_gain,
            "level":            new_level["level"],
            "level_label":      new_level["label"],
            "progress_pct":     _progress_pct(new_xp, new_level),
            "xp_to_next":       (new_level["max_xp"] + 1 - new_xp) if new_level["level"] < len(DOMAIN_LEVELS) else 0,
            "leveled_up":       new_level["level"] > prev_level["level"],
        })
        total_xp += new_xp

    return {
        "domains":   domains_out,
        "total_xp":  total_xp,
        "delta":     delta,
        "scan_id":   scan_id,
    }


def compute_skill_tree_from_scan_history(
    job_dicts: list[dict],
) -> dict[str, Any]:
    """
    Compute full skill tree state from ordered scan history.
    Oldest scans first, newest scan last.
    """
    from Learning.historical_comparison import compare_scans
    from Learning.learning_engine import _get_findings
    from Learning.category_knowledge import classify_finding

    xp_totals: dict[str, int] = {d["id"]: 0 for d in SKILL_DOMAINS}
    history: list[dict] = []

    for i in range(1, len(job_dicts)):
        cur  = job_dicts[i]
        prev = job_dicts[i - 1]
        comparison = compare_scans(
            cur.get("result_json") or {},
            prev.get("result_json") or {},
        )

        # Build resolved_by_category from comparison resolved_categories
        resolved_by_cat: dict[str, dict[str, int]] = {}
        for cat in comparison.get("resolved_categories", []):
            slug = cat if isinstance(cat, str) else cat.get("category", "")
            if slug:
                resolved_by_cat.setdefault(slug, {"medium": 1})

        # Build regression map: new categories that appeared
        regressed_by_cat: dict[str, dict[str, int]] = {}
        for cat in comparison.get("new_categories", []):
            slug = cat if isinstance(cat, str) else cat.get("category", "")
            if slug:
                regressed_by_cat.setdefault(slug, {"medium": 1})

        delta = compute_domain_xp_delta(resolved_by_cat, regressed_by_cat)

        for d_id, gain in delta.items():
            xp_totals[d_id] = xp_totals.get(d_id, 0) + gain

        history.append({
            "scan_id": cur.get("id", ""),
            "delta":   delta,
        })

    result = apply_domain_xp_delta(xp_totals, {d["id"]: 0 for d in SKILL_DOMAINS})
    result["history"] = history
    return result


def get_domain_definitions() -> list[dict]:
    """Return domain metadata without XP (for frontend reference)."""
    return [
        {k: v for k, v in d.items() if k != "categories"}
        for d in SKILL_DOMAINS
    ]
