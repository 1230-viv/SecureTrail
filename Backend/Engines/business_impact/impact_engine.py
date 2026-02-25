"""
Business Impact Engine — SecureTrail
Translates technical vulnerability findings into business-language intelligence:
  - Maps to OWASP Top 10
  - Associates real-world breach examples
  - Estimates potential financial impact
  - Describes exploit scenario in application context
  - Constructs AI-ready prompt payloads
"""

from __future__ import annotations

from typing import Any, Dict, List

from Engines.normalization.schema import (
    BusinessImpact,
    NormalizedVulnerability,
    RiskLevel,
    VulnerabilityCategory,
)
from Utils.logger import JobLogger

# ──────────────────────────────────────────────────────────────────────────────
# Static knowledge base
# ──────────────────────────────────────────────────────────────────────────────

_IMPACT_DB: Dict[VulnerabilityCategory, Dict[str, str]] = {
    VulnerabilityCategory.INJECTION: {
        "owasp_category": "A03:2021 – Injection",
        "breach_example": "Heartland Payment Systems (2008) — SQL injection exposed 130M credit cards. Cost: $145M in settlements.",
        "potential_impact": "Full database compromise, data exfiltration, authentication bypass, lateral movement.",
        "estimated_loss_range": "$1M – $500M+ depending on data volume and industry",
    },
    VulnerabilityCategory.XSS: {
        "owasp_category": "A03:2021 – Injection (XSS)",
        "breach_example": "BritishAirways (2018) — XSS used to skim 500K customer payment cards. £20M ICO fine.",
        "potential_impact": "Session hijacking, credential theft, phishing customers, defacement, malware injection.",
        "estimated_loss_range": "$500K – $50M+ (GDPR fines + breach costs)",
    },
    VulnerabilityCategory.SECRET_EXPOSURE: {
        "owasp_category": "A07:2021 – Identification and Authentication Failures",
        "breach_example": "Uber (2022) — HackerOne API key exposed in code gave full access to bug reports and internal tools.",
        "potential_impact": "Full service compromise, cloud infrastructure takeover, data exfiltration, lateral movement.",
        "estimated_loss_range": "$500K – $100M+",
    },
    VulnerabilityCategory.BROKEN_AUTH: {
        "owasp_category": "A07:2021 – Identification and Authentication Failures",
        "breach_example": "Yahoo (2013/2014) — Auth bypass contributed to breach of 3B accounts. $350M deal price reduction.",
        "potential_impact": "Unauthorized access, account takeover, privilege escalation.",
        "estimated_loss_range": "$1M – $1B+ (brand + regulatory penalties)",
    },
    VulnerabilityCategory.SENSITIVE_EXPOSURE: {
        "owasp_category": "A02:2021 – Cryptographic Failures",
        "breach_example": "Capital One (2019) — Misconfigured WAF exposed 100M SSNs and bank accounts. $80M fine.",
        "potential_impact": "PII/PHI exposure, GDPR/HIPAA violations, identity theft liability.",
        "estimated_loss_range": "$10M – $500M+",
    },
    VulnerabilityCategory.BROKEN_ACCESS: {
        "owasp_category": "A01:2021 – Broken Access Control",
        "breach_example": "Facebook (2021) — IDOR allowed scraping of 533M user phone numbers.",
        "potential_impact": "Unauthorized data access, privilege escalation, data manipulation.",
        "estimated_loss_range": "$2M – $100M+",
    },
    VulnerabilityCategory.IDOR: {
        "owasp_category": "A01:2021 – Broken Access Control (IDOR)",
        "breach_example": "Instagram (2014) — IDOR exposed private photos of any user by manipulating IDs.",
        "potential_impact": "Mass user data exfiltration by iterating object IDs.",
        "estimated_loss_range": "$1M – $50M+ (class action + regulatory)",
    },
    VulnerabilityCategory.CORS: {
        "owasp_category": "A05:2021 – Security Misconfiguration",
        "breach_example": "Numerous banking APIs (2019–2022) — CORS misconfigs allowed malicious sites to read account data.",
        "potential_impact": "Cross-origin data theft, session token exfiltration, CSRF-like attacks.",
        "estimated_loss_range": "$500K – $20M+",
    },
    VulnerabilityCategory.JWT: {
        "owasp_category": "A07:2021 – Identification and Authentication Failures",
        "breach_example": "Auth0 (2019) — 'alg: none' bypass affected applications using unpatched versions.",
        "potential_impact": "Full authentication bypass, token forgery, account takeover at scale.",
        "estimated_loss_range": "$2M – $200M+",
    },
    VulnerabilityCategory.DEPENDENCY_CVE: {
        "owasp_category": "A06:2021 – Vulnerable and Outdated Components",
        "breach_example": "Equifax (2017) — Unpatched Apache Struts CVE exposed 143M SSNs. Total cost: ~$700M.",
        "potential_impact": "Depends on CVE — may include RCE, data exfiltration, service disruption.",
        "estimated_loss_range": "$1M – $700M+",
    },
    VulnerabilityCategory.RATE_LIMIT: {
        "owasp_category": "A07:2021 – Identification and Authentication Failures",
        "breach_example": "Multiple fintech apps — brute-force attacks on PIN endpoints due to missing rate limits.",
        "potential_impact": "Brute-force credential attacks, account takeover, API abuse, DoS.",
        "estimated_loss_range": "$100K – $10M+",
    },
    VulnerabilityCategory.FILE_UPLOAD: {
        "owasp_category": "A04:2021 – Insecure Design",
        "breach_example": "ImageMagick CVE-2016-3714 (ImageTragick) — file upload RCE in thousands of websites.",
        "potential_impact": "Remote code execution, server takeover, data extraction.",
        "estimated_loss_range": "$500K – $50M+",
    },
    VulnerabilityCategory.SSRF: {
        "owasp_category": "A10:2021 – Server-Side Request Forgery",
        "breach_example": "Capital One (2019) — SSRF against AWS metadata endpoint led to credential theft.",
        "potential_impact": "Cloud metadata theft, internal service scanning, AWS/GCP credential exfiltration.",
        "estimated_loss_range": "$10M – $500M+",
    },
    VulnerabilityCategory.SECURITY_MISCONFIGURATION: {
        "owasp_category": "A05:2021 – Security Misconfiguration",
        "breach_example": "MongoDB (2017) — Default no-auth config exposed 27K databases publicly.",
        "potential_impact": "Unauthorized access, data exposure, service disruption.",
        "estimated_loss_range": "$200K – $50M+",
    },
}

_DEFAULT_IMPACT = {
    "owasp_category": "A05:2021 – Security Misconfiguration",
    "breach_example": "Multiple undisclosed incidents — security misconfigurations routinely exploited in targeted attacks.",
    "potential_impact": "Depends on context — review exploit scenario carefully.",
    "estimated_loss_range": "$50K – $5M+",
}


def _build_exploit_scenario(vuln: NormalizedVulnerability) -> str:
    """Generate a contextual exploit narrative based on vulnerability type."""
    type_lower = vuln.type.lower()
    file_ref = f" in `{vuln.file}`" if vuln.file else ""

    if "sql" in type_lower or "injection" in type_lower:
        return (
            f"An attacker sends a crafted HTTP request with malicious SQL payloads "
            f"to the affected input{file_ref}. The database executes the injected query, "
            f"allowing the attacker to dump the entire database schema and contents."
        )
    elif "xss" in type_lower or "cross-site" in type_lower:
        return (
            f"An attacker injects a malicious script payload into the vulnerable input{file_ref}. "
            f"When a victim navigates to the affected page, their browser executes the script, "
            f"stealing session cookies and sending them to an attacker-controlled server."
        )
    elif "secret" in type_lower or "hardcoded" in type_lower:
        return (
            f"An attacker with read access to the repository{file_ref} extracts the hardcoded "
            f"credentials. These are used to authenticate against the target service, "
            f"granting unauthorized access without triggering normal login defenses."
        )
    elif "jwt" in type_lower:
        return (
            f"An attacker crafts a JWT with a manipulated payload (e.g., admin: true){file_ref}. "
            f"Due to weak or missing signature validation, the server accepts the forged token "
            f"and grants elevated privilege access."
        )
    elif "cors" in type_lower:
        return (
            f"An attacker hosts a malicious website that makes cross-origin requests to the API{file_ref}. "
            f"Due to the permissive CORS policy, the browser includes the victim's cookies, "
            f"and the attacker's site reads the private API response."
        )
    elif "auth" in type_lower or "idor" in type_lower:
        return (
            f"An attacker accesses a sensitive route{file_ref} without authentication, "
            f"or modifies an object ID parameter to access another user's data directly (IDOR)."
        )
    elif "upload" in type_lower:
        return (
            f"An attacker uploads a PHP webshell disguised as an image{file_ref}. "
            f"Without file type validation, the server stores and potentially serves it, "
            f"allowing the attacker to execute arbitrary commands on the server."
        )
    else:
        return (
            f"An attacker exploits the weakness at{file_ref} to gain unauthorized access, "
            f"exfiltrate data, or disrupt service depending on application context."
        )


def enrich_business_impact(
    vulns: List[NormalizedVulnerability],
    job_id: str,
) -> List[NormalizedVulnerability]:
    """
    Enriches each vulnerability with business impact context.
    Only enriches HIGH and CRITICAL findings to keep AI prompts focused.
    """
    log = JobLogger(job_id, "business_impact")
    log.info(f"Enriching business impact for {len(vulns)} findings")

    enriched = 0
    for vuln in vulns:
        # Skip LOW/INFO for business enrichment — keep signal-to-noise clean
        if vuln.exploitability and vuln.exploitability.risk_level in (
            RiskLevel.INFO, RiskLevel.LOW
        ):
            continue

        impact_data = _IMPACT_DB.get(vuln.category, _DEFAULT_IMPACT)

        vuln.business_impact = BusinessImpact(
            owasp_category=vuln.owasp_id or impact_data["owasp_category"],
            breach_example=impact_data["breach_example"],
            potential_impact=impact_data["potential_impact"],
            exploit_scenario=_build_exploit_scenario(vuln),
            estimated_loss_range=impact_data["estimated_loss_range"],
        )
        enriched += 1

    log.info(f"Business impact enrichment complete: {enriched} findings enriched")
    return vulns


def build_ai_prompt_payload(vuln: NormalizedVulnerability) -> Dict[str, Any]:
    """
    Constructs a structured, sanitized JSON payload for the AI layer.
    Raw scanner output is NEVER included — only normalized, structured fields.
    """
    return {
        "vulnerability_id": vuln.id,
        "type": vuln.type,
        "category": vuln.category,
        "title": vuln.title,
        "description": vuln.description,
        "file": vuln.file,
        "line": vuln.line,
        "code_snippet": vuln.code_snippet,
        "severity": vuln.severity,
        "confidence": vuln.confidence,
        "exploitability_score": vuln.exploitability.score if vuln.exploitability else None,
        "risk_level": vuln.exploitability.risk_level if vuln.exploitability else None,
        "owasp_id": vuln.owasp_id,
        "cwe_id": vuln.cwe_id,
        "cve_id": vuln.cve_id,
        "business_impact": vuln.business_impact.dict() if vuln.business_impact else None,
    }
