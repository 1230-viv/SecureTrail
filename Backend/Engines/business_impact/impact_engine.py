"""
Business Impact Engine — SecureTrail
Translates technical vulnerability findings into business-language intelligence
using AI (Llama 4 Maverick via AWS Bedrock) to generate unique, contextual impact
assessments for every vulnerability based on its specific file, code, type, and severity.

  - AI-generated breach examples (real incidents, unique per vulnerability)
  - AI-generated potential impact tailored to specific code location
  - AI-generated exploit scenario for the exact code found
  - AI-generated estimated loss range based on context
  - Static OWASP category mapping retained (deterministic)
  - Full static fallback if AI is unavailable
"""

from __future__ import annotations

import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, List, Optional

from Engines.normalization.schema import (
    BusinessImpact,
    NormalizedVulnerability,
    RiskLevel,
    VulnerabilityCategory,
)
from Utils.logger import JobLogger

# ──────────────────────────────────────────────────────────────────────────────
# AI availability flag — mirrors explanation_engine pattern
# ──────────────────────────────────────────────────────────────────────────────
AI_ENABLED = os.getenv("AI_ENABLED", "true").lower() not in ("false", "0", "no")

# ──────────────────────────────────────────────────────────────────────────────
# Deterministic lookups (OWASP category + fallback loss range)
# These are NOT shown to users — they are only used when AI is unavailable.
# ──────────────────────────────────────────────────────────────────────────────

_OWASP_MAP: Dict[VulnerabilityCategory, str] = {
    VulnerabilityCategory.INJECTION:                "A03:2021 – Injection",
    VulnerabilityCategory.XSS:                      "A03:2021 – Injection (XSS)",
    VulnerabilityCategory.SECRET_EXPOSURE:           "A07:2021 – Identification and Authentication Failures",
    VulnerabilityCategory.BROKEN_AUTH:               "A07:2021 – Identification and Authentication Failures",
    VulnerabilityCategory.SENSITIVE_EXPOSURE:        "A02:2021 – Cryptographic Failures",
    VulnerabilityCategory.BROKEN_ACCESS:             "A01:2021 – Broken Access Control",
    VulnerabilityCategory.IDOR:                      "A01:2021 – Broken Access Control (IDOR)",
    VulnerabilityCategory.CORS:                      "A05:2021 – Security Misconfiguration",
    VulnerabilityCategory.JWT:                       "A07:2021 – Identification and Authentication Failures",
    VulnerabilityCategory.DEPENDENCY_CVE:            "A06:2021 – Vulnerable and Outdated Components",
    VulnerabilityCategory.RATE_LIMIT:                "A07:2021 – Identification and Authentication Failures",
    VulnerabilityCategory.FILE_UPLOAD:               "A04:2021 – Insecure Design",
    VulnerabilityCategory.SSRF:                      "A10:2021 – Server-Side Request Forgery",
    VulnerabilityCategory.SECURITY_MISCONFIGURATION: "A05:2021 – Security Misconfiguration",
}

_LOSS_FALLBACK: Dict[VulnerabilityCategory, str] = {
    VulnerabilityCategory.INJECTION:                "$1M – $500M+",
    VulnerabilityCategory.XSS:                      "$500K – $50M+",
    VulnerabilityCategory.SECRET_EXPOSURE:           "$500K – $100M+",
    VulnerabilityCategory.BROKEN_AUTH:               "$1M – $1B+",
    VulnerabilityCategory.SENSITIVE_EXPOSURE:        "$10M – $500M+",
    VulnerabilityCategory.BROKEN_ACCESS:             "$2M – $100M+",
    VulnerabilityCategory.IDOR:                      "$1M – $50M+",
    VulnerabilityCategory.CORS:                      "$500K – $20M+",
    VulnerabilityCategory.JWT:                       "$2M – $200M+",
    VulnerabilityCategory.DEPENDENCY_CVE:            "$1M – $700M+",
    VulnerabilityCategory.RATE_LIMIT:                "$100K – $10M+",
    VulnerabilityCategory.FILE_UPLOAD:               "$500K – $50M+",
    VulnerabilityCategory.SSRF:                      "$10M – $500M+",
    VulnerabilityCategory.SECURITY_MISCONFIGURATION: "$200K – $50M+",
}

# Static fallback content — only used when AI is disabled or fails
_STATIC_FALLBACK: Dict[VulnerabilityCategory, Dict[str, str]] = {
    VulnerabilityCategory.INJECTION: {
        "breach_example": "Heartland Payment Systems (2008) — SQL injection exposed 130M credit cards. Cost: $145M in settlements.",
        "potential_impact": "Full database compromise, data exfiltration, authentication bypass, lateral movement.",
    },
    VulnerabilityCategory.XSS: {
        "breach_example": "British Airways (2018) — XSS used to skim 500K customer payment cards. £20M ICO fine.",
        "potential_impact": "Session hijacking, credential theft, phishing customers, defacement, malware injection.",
    },
    VulnerabilityCategory.SECRET_EXPOSURE: {
        "breach_example": "Uber (2022) — HackerOne API key exposed in code gave full access to internal tools.",
        "potential_impact": "Full service compromise, cloud infrastructure takeover, data exfiltration, lateral movement.",
    },
    VulnerabilityCategory.BROKEN_AUTH: {
        "breach_example": "Yahoo (2013/2014) — Auth bypass contributed to breach of 3B accounts. $350M deal reduction.",
        "potential_impact": "Unauthorized access, account takeover, privilege escalation.",
    },
    VulnerabilityCategory.SENSITIVE_EXPOSURE: {
        "breach_example": "Capital One (2019) — Misconfigured WAF exposed 100M SSNs and bank accounts. $80M fine.",
        "potential_impact": "PII/PHI exposure, GDPR/HIPAA violations, identity theft liability.",
    },
    VulnerabilityCategory.BROKEN_ACCESS: {
        "breach_example": "Facebook (2021) — IDOR allowed scraping of 533M user phone numbers.",
        "potential_impact": "Unauthorized data access, privilege escalation, data manipulation.",
    },
    VulnerabilityCategory.IDOR: {
        "breach_example": "Instagram (2014) — IDOR exposed private photos of any user by manipulating IDs.",
        "potential_impact": "Mass user data exfiltration by iterating object IDs.",
    },
    VulnerabilityCategory.CORS: {
        "breach_example": "Multiple banking APIs (2019–2022) — CORS misconfigs allowed cross-origin account data reads.",
        "potential_impact": "Cross-origin data theft, session token exfiltration, CSRF-like attacks.",
    },
    VulnerabilityCategory.JWT: {
        "breach_example": "Auth0 (2019) — 'alg: none' bypass affected applications using unpatched SDK versions.",
        "potential_impact": "Full authentication bypass, token forgery, account takeover at scale.",
    },
    VulnerabilityCategory.DEPENDENCY_CVE: {
        "breach_example": "Equifax (2017) — Unpatched Apache Struts CVE exposed 143M SSNs. Total cost: ~$700M.",
        "potential_impact": "Depends on CVE — may include RCE, data exfiltration, service disruption.",
    },
    VulnerabilityCategory.RATE_LIMIT: {
        "breach_example": "Multiple fintech apps — brute-force attacks on PIN endpoints due to missing rate limits.",
        "potential_impact": "Brute-force credential attacks, account takeover, API abuse, DoS.",
    },
    VulnerabilityCategory.FILE_UPLOAD: {
        "breach_example": "ImageMagick CVE-2016-3714 (ImageTragick) — file upload RCE in thousands of websites.",
        "potential_impact": "Remote code execution, server takeover, data extraction.",
    },
    VulnerabilityCategory.SSRF: {
        "breach_example": "Capital One (2019) — SSRF against AWS metadata endpoint led to IAM credential theft.",
        "potential_impact": "Cloud metadata theft, internal service scanning, AWS/GCP credential exfiltration.",
    },
    VulnerabilityCategory.SECURITY_MISCONFIGURATION: {
        "breach_example": "MongoDB (2017) — Default no-auth config exposed 27K databases publicly.",
        "potential_impact": "Unauthorized access, data exposure, service disruption.",
    },
}

_DEFAULT_STATIC_FALLBACK = {
    "breach_example": "Multiple undisclosed incidents — security misconfigurations routinely exploited in targeted attacks.",
    "potential_impact": "Depends on context — review exploit scenario carefully.",
}

# ──────────────────────────────────────────────────────────────────────────────
# AI prompt
# ──────────────────────────────────────────────────────────────────────────────

_AI_SYSTEM_PROMPT = (
    "You are a cybersecurity business risk analyst specializing in translating technical "
    "vulnerabilities into executive-level business impact assessments. "
    "You have deep knowledge of real-world data breaches from 2015 to present.\n\n"
    "Given a specific vulnerability found in source code, return a JSON object with exactly "
    "these four fields:\n"
    "- breach_example: A specific real-world breach (2015-2025) that directly involved this "
    "exact vulnerability type. Include: company name, year, what data/systems were compromised, "
    "and quantified financial cost. IMPORTANT: You will be called separately for every "
    "vulnerability in the codebase. Each call MUST cite a DIFFERENT real breach — never repeat "
    "the same company or incident across calls. Draw from the full range of documented incidents: "
    "SolarWinds, LastPass, Okta, Twilio, CircleCI, Slack, Uber, Twitter, T-Mobile, Rockstar, "
    "Revolut, Samsung, Optus, Medibank, Reddit, GitHub, Dropbox, Cloudflare, Zoom, Shopify, "
    "GitLab, Stack Overflow, Mailchimp, Cisco, Atlassian, Toyota, Roblox, Discord, Duolingo, "
    "23andMe, Lyric, Snowflake, Ticketmaster, AT&T, National Public Data, Trello, and others. "
    "Choose the breach most contextually relevant to the file path, code type, and framework.\n"
    "- potential_impact: 2-3 sentences of concrete business risk specific to THIS finding. "
    "Reference the actual file path and vulnerability type. Include regulatory, financial, "
    "and reputational dimensions relevant to the code's apparent purpose.\n"
    "- exploit_scenario: A 3-4 sentence step-by-step attack narrative for THIS specific code "
    "location. Name the exact file, describe what the attacker does, what they gain, and the "
    "blast radius. Make it concrete — not generic.\n"
    "- estimated_loss_range: Realistic financial exposure range (e.g. '$2M – $50M+') based on "
    "the vulnerability type, severity, and apparent application context.\n\n"
    "Respond with ONLY valid JSON. No markdown fences. No explanation. No preamble."
)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _safe_json_parse(text: str) -> Optional[Dict[str, Any]]:
    """Extract and parse JSON from AI response, handling markdown fences."""
    if not text:
        return None
    text = text.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        lines_ = text.splitlines()
        text = "\n".join(ln for ln in lines_ if not ln.strip().startswith("```"))
        text = text.strip()

    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: extract first JSON object from prose
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return None


def _build_user_prompt(vuln: NormalizedVulnerability) -> str:
    """Build the per-vulnerability prompt with all available context."""
    snippet = (vuln.code_snippet or "").strip()
    if snippet:
        # Cap at 20 lines to stay within token budget
        lines = snippet.splitlines()
        if len(lines) > 20:
            snippet = "\n".join(lines[:20]) + "\n... (truncated)"

    parts = [
        f"Vulnerability type: {vuln.type}",
        f"Title: {vuln.title or 'N/A'}",
        f"File: {vuln.file or 'unknown'}",
        f"Line: {vuln.line or 'unknown'}",
        f"Severity: {vuln.severity}",
        f"Category: {vuln.category}",
        f"CWE: {vuln.cwe_id or 'N/A'}",
        f"CVE: {vuln.cve_id or 'N/A'}",
        f"OWASP ID: {vuln.owasp_id or 'N/A'}",
        f"Description: {(vuln.description or 'N/A')[:300]}",
    ]
    if snippet:
        parts.append(f"Code snippet:\n```\n{snippet}\n```")

    # Include a unique token so the AI treats each call as distinct and varies its breach examples
    unique_token = vuln.id[-8:] if vuln.id else "00000000"
    parts.append(
        f"\nUnique finding ID (for variation): {unique_token}"
    )
    parts.append(
        "\nGenerate a unique, context-specific business impact assessment for "
        "this exact vulnerability. The breach_example MUST be a different real documented "
        "incident from the ones used for other findings — do not repeat the same company "
        "or year. Pick a breach that is specifically relevant to the file path, endpoint "
        "type, and framework visible in the context above."
    )
    return "\n".join(parts)


def _apply_static_fallback(vuln: NormalizedVulnerability) -> None:
    """Apply static fallback when AI is unavailable or fails."""
    fb = _STATIC_FALLBACK.get(vuln.category, _DEFAULT_STATIC_FALLBACK)
    file_ref = f" in `{vuln.file}`" if vuln.file else ""
    vuln.business_impact = BusinessImpact(
        owasp_category=vuln.owasp_id or _OWASP_MAP.get(
            vuln.category, "A05:2021 – Security Misconfiguration"
        ),
        breach_example=fb["breach_example"],
        potential_impact=fb["potential_impact"],
        exploit_scenario=(
            f"An attacker exploits the {vuln.type} weakness{file_ref} "
            f"to gain unauthorized access, exfiltrate data, or disrupt service."
        ),
        estimated_loss_range=_LOSS_FALLBACK.get(vuln.category, "$50K – $5M+"),
    )


def _generate_ai_impact(vuln: NormalizedVulnerability) -> Dict[str, Any]:
    """
    Calls AI to generate contextual business impact for a single vulnerability.
    Returns a parsed dict with keys: breach_example, potential_impact,
    exploit_scenario, estimated_loss_range.
    Raises on failure — caller handles fallback.
    """
    from Engines.ai.bedrock_client import invoke_claude  # lazy import

    user_prompt = _build_user_prompt(vuln)
    raw = invoke_claude(
        system_prompt=_AI_SYSTEM_PROMPT,
        user_message=user_prompt,
        temperature=0.92,   # high variation so each finding gets a distinct breach example
        max_tokens=600,
    )
    data = _safe_json_parse(raw)
    if not data:
        raise ValueError(f"AI returned unparseable response: {raw[:200]!r}")

    # Normalize all values to plain strings — AI sometimes returns nested objects
    # for fields like breach_example: {"company": ..., "year": ...} which causes
    # Pydantic ValidationError on BusinessImpact(breach_example: str)
    def _to_str(val: Any) -> str:
        if val is None:
            return ""
        if isinstance(val, str):
            return val
        if isinstance(val, dict):
            # Flatten structured breach_example into readable sentence
            company = val.get("company", "")
            year    = val.get("year", "")
            desc    = (
                val.get("data_compromised")
                or val.get("description")
                or val.get("details")
                or val.get("impact")
                or ""
            )
            cost    = val.get("financial_cost") or val.get("cost") or ""
            parts   = [p for p in [f"{company} ({year})" if company else "", desc, f"Cost: {cost}" if cost else ""] if p]
            return " \u2014 ".join(parts) if parts else str(val)
        if isinstance(val, list):
            return " ".join(str(x) for x in val)
        return str(val)

    return {
        "breach_example":    _to_str(data.get("breach_example")),
        "potential_impact":  _to_str(data.get("potential_impact")),
        "exploit_scenario":  _to_str(data.get("exploit_scenario")),
        "estimated_loss_range": _to_str(data.get("estimated_loss_range")),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Public API
# ──────────────────────────────────────────────────────────────────────────────

def enrich_business_impact_static(
    vulns: List[NormalizedVulnerability],
    job_id: str,
) -> List[NormalizedVulnerability]:
    """
    Fast synchronous enrichment using static fallback data only — no AI calls.
    Used at the end of the main scan pipeline so the report is available
    immediately. AI-generated content is filled in later by the background task.
    """
    log = JobLogger(job_id, "business_impact")
    count = 0
    for vuln in vulns:
        if vuln.exploitability and vuln.exploitability.risk_level in (RiskLevel.INFO,):
            continue
        _apply_static_fallback(vuln)
        count += 1
    log.info(f"Static business impact applied to {count} findings (AI will enrich in background)")
    return vulns


def enrich_business_impact(
    vulns: List[NormalizedVulnerability],
    job_id: str,
) -> List[NormalizedVulnerability]:
    """
    Enriches each vulnerability with AI-generated business impact context.
    Skips only INFO-level findings. All other risk levels (LOW through CRITICAL)
    receive AI-generated assessments — including rate-limit and dependency CVE
    findings that sometimes score LOW.

    Each vulnerability receives a unique AI-generated assessment based on its
    specific file, code snippet, type, and severity — not a generic template.
    Falls back to static data gracefully if AI is unavailable.
    """
    from Engines.ai.bedrock_client import BedrockPermanentError  # lazy import

    log = JobLogger(job_id, "business_impact")

    targets = [
        v for v in vulns
        if not (
            v.exploitability
            and v.exploitability.risk_level in (RiskLevel.INFO,)
        )
    ]

    if not targets:
        log.info("No MEDIUM/HIGH/CRITICAL findings to enrich")
        return vulns

    if not AI_ENABLED:
        log.info(f"AI disabled — applying static fallback for {len(targets)} findings")
        for vuln in targets:
            _apply_static_fallback(vuln)
        return vulns

    log.info(
        f"Generating AI business impact for {len(targets)} findings "
        f"(max 4 concurrent calls)"
    )

    circuit_open = False  # set True on permanent Bedrock error to skip remaining AI calls
    enriched = 0
    fallback_count = 0

    with ThreadPoolExecutor(max_workers=4) as pool:
        future_to_vuln = {
            pool.submit(_generate_ai_impact, v): v
            for v in targets
        }

        for future in as_completed(future_to_vuln):
            vuln = future_to_vuln[future]

            if circuit_open:
                _apply_static_fallback(vuln)
                fallback_count += 1
                continue

            try:
                data = future.result()
                owasp = (
                    vuln.owasp_id
                    or _OWASP_MAP.get(vuln.category, "A05:2021 – Security Misconfiguration")
                )
                fallback_fb = _STATIC_FALLBACK.get(vuln.category, _DEFAULT_STATIC_FALLBACK)

                vuln.business_impact = BusinessImpact(
                    owasp_category=owasp,
                    breach_example=data.get("breach_example") or fallback_fb["breach_example"],
                    potential_impact=data.get("potential_impact") or fallback_fb["potential_impact"],
                    exploit_scenario=data.get("exploit_scenario") or (
                        f"An attacker exploits the {vuln.type} weakness in "
                        f"`{vuln.file or 'unknown'}` to gain unauthorized access."
                    ),
                    estimated_loss_range=(
                        data.get("estimated_loss_range")
                        or _LOSS_FALLBACK.get(vuln.category, "$50K – $5M+")
                    ),
                )
                enriched += 1

            except BedrockPermanentError as e:
                log.error(f"Permanent Bedrock error — opening circuit breaker: {e}")
                circuit_open = True
                _apply_static_fallback(vuln)
                fallback_count += 1

            except Exception as e:
                log.warning(
                    f"AI impact failed for {vuln.id[:8]} ({vuln.type}) — "
                    f"using static fallback: {e}"
                )
                _apply_static_fallback(vuln)
                fallback_count += 1

    log.info(
        f"Business impact enrichment complete: "
        f"{enriched} AI-generated, {fallback_count} static fallback"
    )
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
