"""
Correlation Engine — SecureTrail

Detects compound risk relationships between vulnerabilities across tools.
When multiple findings interact (e.g. XSS + vulnerable sanitizer library, or
hardcoded secret + public route), the exploitability score of all related
findings is boosted and traceability links are recorded.

All correlation rules are declarative and traceable — no black-box logic.
"""

from __future__ import annotations

import itertools
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from Engines.normalization.schema import (
    CorrelationInfo,
    NormalizedVulnerability,
    Severity,
    VulnerabilityCategory,
)
from Utils.logger import JobLogger


# ──────────────────────────────────────────────────────────────────────────────
# Correlation rule definition
# ──────────────────────────────────────────────────────────────────────────────

@dataclass
class CorrelationRule:
    name: str
    reason: str
    score_boost: float
    category_a: Optional[VulnerabilityCategory]    = None
    category_b: Optional[VulnerabilityCategory]    = None
    keyword_a: Optional[str]                       = None
    keyword_b: Optional[str]                       = None


# Declarative rule table — extend here to add new compound-risk patterns
CORRELATION_RULES: List[CorrelationRule] = [
    CorrelationRule(
        name="xss_vulnerable_sanitizer",
        reason="XSS finding combined with a vulnerable HTML sanitizer library (CVE dependency)",
        score_boost=1.5,
        category_a=VulnerabilityCategory.XSS,
        category_b=VulnerabilityCategory.DEPENDENCY_CVE,
    ),
    CorrelationRule(
        name="hardcoded_secret_public_route",
        reason="Hardcoded secret co-located with a public/unauthenticated route — immediate exposure risk",
        score_boost=2.0,
        category_a=VulnerabilityCategory.SECRET_EXPOSURE,
        category_b=VulnerabilityCategory.BROKEN_AUTH,
    ),
    CorrelationRule(
        name="missing_auth_sensitive_endpoint",
        reason="Missing authentication middleware on an endpoint that handles sensitive data",
        score_boost=1.8,
        category_a=VulnerabilityCategory.BROKEN_AUTH,
        category_b=VulnerabilityCategory.SENSITIVE_EXPOSURE,
    ),
    CorrelationRule(
        name="sql_injection_no_rate_limit",
        reason="SQL injection exposure compounded by missing rate limiting — allows automated attacks",
        score_boost=1.2,
        category_a=VulnerabilityCategory.INJECTION,
        category_b=VulnerabilityCategory.RATE_LIMIT,
    ),
    CorrelationRule(
        name="insecure_upload_with_traversal",
        reason="Insecure file upload combined with path traversal — allows remote code execution",
        score_boost=2.0,
        category_a=VulnerabilityCategory.FILE_UPLOAD,
        category_b=VulnerabilityCategory.BROKEN_ACCESS,
    ),
    CorrelationRule(
        name="cors_wildcard_with_auth",
        reason="CORS wildcard origin combined with authenticated endpoints — enables cross-origin data theft",
        score_boost=1.5,
        category_a=VulnerabilityCategory.CORS,
        category_b=VulnerabilityCategory.BROKEN_AUTH,
    ),
    CorrelationRule(
        name="weak_jwt_secret_exposure",
        reason="Weak JWT implementation combined with exposed credentials — full account takeover risk",
        score_boost=2.0,
        category_a=VulnerabilityCategory.JWT,
        category_b=VulnerabilityCategory.SECRET_EXPOSURE,
    ),
    CorrelationRule(
        name="idor_with_injection",
        reason="IDOR combined with injection vulnerability — allows data manipulation across objects",
        score_boost=1.5,
        category_a=VulnerabilityCategory.IDOR,
        category_b=VulnerabilityCategory.INJECTION,
    ),
]


# ──────────────────────────────────────────────────────────────────────────────
# Engine
# ──────────────────────────────────────────────────────────────────────────────

def _matches_rule_side(
    vuln: NormalizedVulnerability,
    category: Optional[VulnerabilityCategory],
    keyword: Optional[str],
) -> bool:
    if category and vuln.category == category:
        return True
    if keyword:
        searchable = f"{vuln.type} {vuln.title} {vuln.description}".lower()
        if keyword.lower() in searchable:
            return True
    return False


def correlate_vulnerabilities(
    vulns: List[NormalizedVulnerability],
    job_id: str,
) -> Tuple[List[NormalizedVulnerability], List[Dict[str, Any]]]:
    """
    Find compound-risk relationships and boost exploitability scores.

    Returns:
        mutated vulnerabilities list (scores boosted in-place)
        correlation_summary — list of correlation event dicts for the report
    """
    log = JobLogger(job_id, "correlation_engine")
    log.info(f"Running correlation analysis on {len(vulns)} findings")

    correlation_summary: List[Dict[str, Any]] = []

    for rule in CORRELATION_RULES:
        # Find all vulnerabilities matching each side of the rule
        side_a = [
            v for v in vulns if _matches_rule_side(v, rule.category_a, rule.keyword_a)
        ]
        side_b = [
            v for v in vulns if _matches_rule_side(v, rule.category_b, rule.keyword_b)
        ]

        if not side_a or not side_b:
            continue

        log.info(
            f"Rule '{rule.name}' triggered: "
            f"{len(side_a)} × {len(side_b)} correlated pairs"
        )

        all_affected_ids = [v.id for v in side_a + side_b]

        # Boost scores and add correlation metadata
        for vuln in side_a + side_b:
            if vuln.exploitability:
                new_score = min(10.0, vuln.exploitability.score + rule.score_boost)
                vuln.exploitability.score = round(new_score, 2)
                vuln.exploitability.explanation += (
                    f" | Correlation boost +{rule.score_boost} ({rule.name})"
                )

            vuln.correlation = CorrelationInfo(
                correlated_with=[i for i in all_affected_ids if i != vuln.id],
                correlation_reason=rule.reason,
                score_boost=rule.score_boost,
            )

        correlation_summary.append({
            "rule": rule.name,
            "reason": rule.reason,
            "score_boost": rule.score_boost,
            "affected_ids": all_affected_ids,
            "side_a_count": len(side_a),
            "side_b_count": len(side_b),
        })

    # Re-sort after score boosts
    vulns.sort(
        key=lambda v: (v.exploitability.score if v.exploitability else 0),
        reverse=True,
    )

    log.info(
        f"Correlation complete: {len(correlation_summary)} rules triggered"
    )
    return vulns, correlation_summary
