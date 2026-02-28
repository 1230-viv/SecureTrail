"""
AI Prompt Builder -- SecureTrail (Unified Single-Call Architecture)
Constructs a single comprehensive prompt per vulnerability that combines
root-cause analysis, exploit modeling, educational content, and self-validation
in one AI call.
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from Engines.normalization.schema import NormalizedVulnerability


# =====================================================================
#  SYSTEM PROMPT
# =====================================================================
SYSTEM_PROMPT = (
    "You are a senior application security engineer reviewing a real student project.\n\n"
    "Your job is to generate a technically accurate, context-aware, and educational "
    "vulnerability explanation.\n\n"
    "STRICT RULES:\n"
    "- Base all conclusions ONLY on the provided snippet and description.\n"
    "- Do NOT invent missing code.\n"
    "- Do NOT fabricate real-world breach stories.\n"
    "- If snippet is partial, clearly state limitations.\n"
    "- If vulnerability is dependency-based, distinguish between presence and exploitability.\n"
    "- Be concise but precise.\n"
    "- Secure fixes must directly address the identified root cause.\n"
    "- Return ONLY valid JSON.\n"
    "- No markdown.\n"
    "- No extra commentary.\n\n"
    "Before producing output:\n"
    "1. Determine whether vulnerability is explicit or inferred.\n"
    "2. Confirm that the proposed fix directly addresses the root cause.\n"
    "Do not reveal reasoning."
)


# =====================================================================
#  VULNERABILITY JSON SCHEMA
# =====================================================================
VULN_SCHEMA = {
    "confidence": "HIGH / MEDIUM / LOW",
    "is_explicit_or_inferred": "Explicit / Inferred",
    "code_summary": "Brief summary of visible behavior.",
    "validated_root_cause": "Precise technical cause grounded in evidence.",
    "evidence": "Exact snippet evidence or dependency reference.",
    "realistic_attack_flow": [
        "Step 1",
        "Step 2",
        "Step 3",
    ],
    "technical_impact": "Accurate system-level impact.",
    "project_specific_risk": "Why this matters in this file/project.",
    "secure_fix": "Concise explanation of the correct fix.",
    "secure_code_example": "Complete minimal corrected snippet or upgrade instruction.",
    "defense_in_depth": [
        "Additional protection 1",
        "Additional protection 2",
    ],
    "core_security_principle": "Specific principle involved.",
    "self_check": (
        "One sentence confirming fix directly addresses the root cause."
    ),
}


# =====================================================================
#  EXECUTIVE SUMMARY SCHEMA
# =====================================================================
EXECUTIVE_SUMMARY_SCHEMA = {
    "overall_security_posture": "Explain in simple terms how secure this project currently is.",
    "biggest_risk_area": "Explain which vulnerability type is most dangerous here and why.",
    "what_the_student_should_fix_first": "Prioritized guidance.",
    "learning_recommendations": [
        "Security topic 1 to learn",
        "Security topic 2 to learn",
    ],
    "encouraging_note": "Motivational but realistic note encouraging secure coding.",
}

# Separate system prompt for the executive summary call
SUMMARY_SYSTEM_PROMPT = (
    "You are a senior cybersecurity mentor teaching a computer science student.\n\n"
    "Rules:\n"
    "- Return ONLY valid JSON. No markdown. No text outside the JSON object.\n"
    "- Be clear, structured, and educational."
)


# =====================================================================
#  PROMPT BUILDERS
# =====================================================================

def build_single_vuln_prompt(payload: Dict[str, Any]) -> str:
    """
    Build the unified single-call prompt for one vulnerability.
    Embeds all context (title, severity, code, etc.) and the JSON schema.
    """
    title    = payload.get("title", "Unknown Vulnerability")
    category = payload.get("category", "Other")
    severity = payload.get("severity", "UNKNOWN")
    score    = payload.get("exploitability_score", "N/A")
    filepath = payload.get("file", "unknown")
    line     = payload.get("line", "")
    desc     = payload.get("description", "")
    snippet  = payload.get("code_snippet") or "Not available"
    cwe      = payload.get("cwe_id") or ""
    cve      = payload.get("cve_id") or ""

    id_line = ""
    if cwe:
        id_line += f"CWE: {cwe}\n"
    if cve:
        id_line += f"CVE: {cve}\n"

    tq = chr(39) * 3  # triple single-quote
    return (
        f"VULNERABILITY DETAILS:\n"
        f"Title: {title}\n"
        f"Category: {category}\n"
        f"Severity: {severity}\n"
        f"Risk Score: {score}/10\n"
        f"File Path: {filepath}\n"
        f"{id_line}"
        f"Description: {desc}\n\n"
        f"Code Snippet:\n{tq}\n{snippet}\n{tq}\n\n"
        f"Return STRICT JSON:\n"
        f"{json.dumps(VULN_SCHEMA, indent=2)}"
    )


def build_batch_summary_prompt(
    vulns: List[NormalizedVulnerability],
    repo_name: str,
) -> str:
    """Build a student-friendly executive summary prompt across the whole scan."""
    critical = sum(1 for v in vulns if (v.severity or "").upper() == "CRITICAL")
    high = sum(1 for v in vulns if (v.severity or "").upper() == "HIGH")
    medium = sum(1 for v in vulns if (v.severity or "").upper() == "MEDIUM")
    low = sum(1 for v in vulns if (v.severity or "").upper() == "LOW")

    categories = list({v.category for v in vulns})[:8]
    scores = [v.exploitability.score for v in vulns if v.exploitability]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0.0

    return (
        f"You are generating a summary for a computer science student who just scanned "
        f"their project '{repo_name}'.\n\n"
        f"Scan Summary:\n"
        f"Total Vulnerabilities: {len(vulns)}\n"
        f"Critical: {critical}\n"
        f"High: {high}\n"
        f"Medium: {medium}\n"
        f"Low: {low}\n\n"
        f"Top Categories:\n{', '.join(str(c) for c in categories)}\n\n"
        f"Average Risk Score: {avg_score}\n\n"
        f"Return STRICT JSON in this exact format:\n"
        f"{json.dumps(EXECUTIVE_SUMMARY_SCHEMA, indent=2)}\n\n"
        f"Return ONLY the JSON. No markdown."
    )

