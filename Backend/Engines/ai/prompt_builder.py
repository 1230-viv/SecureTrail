"""
AI Prompt Builder — SecureTrail
Constructs structured, context-rich prompts for AWS Bedrock (Claude).
Only normalized, sanitized vulnerability data is sent — never raw scanner output.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from Engines.normalization.schema import NormalizedVulnerability

SYSTEM_PROMPT = """You are SecureTrail AI, an expert application security engineer embedded in a 
DevSecOps platform. You analyze structured vulnerability reports and provide:
1. Precise root cause explanations
2. Realistic exploit scenarios
3. Minimal, production-safe patch suggestions
4. Secure coding best practices

RULES:
- Always respond with valid JSON matching the exact schema requested.
- Be precise and actionable, not generic.
- Patches must be minimal — do not refactor unrelated code.
- Reference specific lines/patterns from the vulnerability context when available.
- Do not hallucinate CVE numbers or package versions. If unsure, say "verify latest version".
- If the vulnerability is in a dependency, suggest the upgrade path.
"""

VULNERABILITY_ANALYSIS_SCHEMA = {
    "root_cause": "Concise technical explanation of WHY the vulnerability exists",
    "exploit_scenario": "Step-by-step how an attacker would exploit this in the context described",
    "minimal_patch": "The smallest code change that fully remediates the issue",
    "secure_practice": "Best practice to prevent this class of vulnerability in future",
    "references": ["OWASP link", "CWE link", "Language/framework security docs link"]
}


def build_single_vuln_prompt(payload: Dict[str, Any]) -> str:
    """
    Build the user-turn message for a single vulnerability analysis.
    """
    return f"""Analyze this security vulnerability and respond ONLY with a JSON object matching 
exactly this schema: {json.dumps(VULNERABILITY_ANALYSIS_SCHEMA, indent=2)}

Vulnerability details:
{json.dumps(payload, indent=2, default=str)}

Respond with ONLY the JSON object. No markdown, no prose outside the JSON."""


def build_batch_summary_prompt(
    vulns: List[NormalizedVulnerability],
    repo_name: str,
) -> str:
    """
    Build a prompt for an executive risk summary across the whole scan.
    """
    critical = sum(1 for v in vulns if v.exploitability and v.exploitability.score >= 9.0)
    high = sum(1 for v in vulns if v.exploitability and 7.0 <= v.exploitability.score < 9.0)
    categories = list({v.category for v in vulns})[:8]

    schema = {
        "executive_summary": "2-3 sentence non-technical risk summary for a CTO/CISO",
        "top_3_priorities": [
            {"priority": 1, "action": "Specific remediation action", "risk_reduction": "impact if fixed"}
        ],
        "overall_risk_rating": "CRITICAL | HIGH | MEDIUM | LOW",
        "estimated_remediation_effort": "e.g. '2–3 developer days'",
        "compliance_flags": ["GDPR", "SOC2", "PCI-DSS flags if applicable"]
    }

    return f"""Generate an executive security risk summary for repository '{repo_name}'.

Scan statistics:
- Critical findings: {critical}
- High findings: {high}  
- Total findings: {len(vulns)}
- Vulnerability categories: {', '.join(str(c) for c in categories)}

Respond ONLY with a JSON object matching exactly this schema:
{json.dumps(schema, indent=2)}

Respond with ONLY the JSON. No markdown."""
