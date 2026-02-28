"""
AI Prompt Builder -- SecureTrail (4-Layer Chain Architecture)
Constructs per-layer prompts for the sequential AI analysis chain:
  Layer 1: Technical Root Cause Analyzer
  Layer 2: Security Exploit & Risk Modeler
  Layer 3: Student Mentor Translator
  Layer 4: AI Self-Critic / Quality Reviewer
"""

from __future__ import annotations

import json
from typing import Any, Dict, List

from Engines.normalization.schema import NormalizedVulnerability


# =====================================================================
#  LAYER CONFIGURATION
# =====================================================================
LAYER_CONFIG = {
    "L1": {"temperature": 0.10, "max_tokens": 500},
    "L2": {"temperature": 0.15, "max_tokens": 600},
    "L3": {"temperature": 0.25, "max_tokens": 900},
    "L4": {"temperature": 0.10, "max_tokens": 900},
}


# =====================================================================
#  LAYER 1 -- Technical Root Cause Analyzer
# =====================================================================
L1_SYSTEM_PROMPT = (
    "You are a precise code auditor performing static analysis.\n\n"
    "Your ONLY job is to analyze the provided vulnerability finding and "
    "determine its technical root cause by examining the code snippet.\n\n"
    "Rules:\n"
    "- State ONLY what is provably present in the code.\n"
    "- If the code snippet is missing or insufficient, say so explicitly.\n"
    "- Do NOT speculate about code you cannot see.\n"
    "- Do NOT invent variable names, function names, or behaviors.\n"
    "- Be surgical and precise -- no filler, no padding.\n"
    "- Return ONLY valid JSON. No markdown. No text outside the JSON object."
)

L1_SCHEMA = {
    "code_behavior_summary": "1-2 sentence summary of what the code ACTUALLY does (only what you can see).",
    "explicit_evidence": "Quote or cite the exact code pattern/line that constitutes the vulnerability.",
    "validated_vulnerability_type": "The precise vulnerability classification (e.g. SQL Injection via string concatenation).",
    "root_cause_precise": "Technical root cause in 1-2 sentences. What specific coding mistake creates this vulnerability?",
    "confidence_level": "HIGH / MEDIUM / LOW -- based on how much evidence is visible in the snippet.",
}


# =====================================================================
#  LAYER 2 -- Security Exploit & Risk Modeler
# =====================================================================
L2_SYSTEM_PROMPT = (
    "You are a senior penetration tester and risk analyst.\n\n"
    "You receive a grounded technical analysis (Layer 1) of a vulnerability. "
    "Your job is to model a realistic exploit path and assess impact.\n\n"
    "Rules:\n"
    "- Base your analysis strictly on the Layer 1 findings. Do not invent new evidence.\n"
    "- Attack steps must be realistic and specific to THIS vulnerability.\n"
    "- Do not describe generic attacks. Reference the actual code behavior from Layer 1.\n"
    "- Impact assessment must be proportional to the real exploitability.\n"
    "- IMPORTANT: Distinguish between 'no protection is visible in the snippet' vs "
    "'protection is confirmed absent'. If Layer 1 confidence is LOW or the snippet is "
    "partial, state that the risk is inferred from missing visible protection, not confirmed.\n"
    "- For authentication/credential vulnerabilities: model brute-force attacks AND "
    "credential stuffing attacks as SEPARATE attack flows when both are applicable. "
    "Explain why each vector works differently.\n"
    "- Return ONLY valid JSON. No markdown. No text outside the JSON object."
)

L2_SCHEMA = {
    "realistic_attack_flow": [
        "Step 1: Attacker discovers ...",
        "Step 2: Attacker crafts ...",
        "Step 3: ...",
    ],
    "secondary_attack_flow": "(Optional) If a second distinct attack vector applies (e.g. credential stuffing vs brute-force), describe it here as a list of steps. Otherwise set to null.",
    "evidence_basis": "State whether the risk is based on CONFIRMED absence of protection or INFERRED from missing visible protection in a partial snippet.",
    "technical_impact": "What happens technically if exploited (data leak, RCE, privilege escalation, etc.).",
    "business_impact_realistic": "Real-world business consequence proportional to this specific vulnerability.",
    "severity_justification": "Why this severity rating is appropriate. Reference the evidence and impact.",
}


# =====================================================================
#  LAYER 3 -- Student Mentor Translator
# =====================================================================
L3_SYSTEM_PROMPT = (
    "You are a patient cybersecurity mentor teaching a computer science student.\n\n"
    "You receive a grounded technical analysis (Layer 1) and an exploit model "
    "(Layer 2). Your job is to translate this into clear, educational content.\n\n"
    "Rules:\n"
    "- Use simple but technically correct language.\n"
    "- All explanations must reference the actual code from Layer 1 -- do not generalize.\n"
    "- Secure code examples must be complete, runnable, and directly fix the actual code.\n"
    "- Attack simulation must follow the Layer 2 attack flow, explained step-by-step.\n"
    "- Teach the WHY, not just the WHAT.\n"
    "- Be encouraging but honest about the severity.\n"
    "- IMPORTANT: If the Layer 1 confidence_level is LOW, you MUST clearly explain to the "
    "student that this vulnerability is INFERRED from the absence of visible protection in "
    "the code snippet, not from a confirmed exploit. Use phrasing like: 'Based on the code "
    "we can see, there does not appear to be [protection X]. This does not guarantee the "
    "vulnerability exists, but it means the protection is not visible where expected.'\n"
    "- Secure fixes MUST reflect industry best practices, not minimal implementations. "
    "For example: use bcrypt/argon2 for password hashing (not MD5/SHA), use established "
    "rate-limiting libraries (not hand-rolled counters), use parameterized queries (not "
    "manual escaping). Always show the production-grade approach.\n"
    "- If Layer 2 provides a secondary_attack_flow, include BOTH attack vectors in the "
    "step_by_step_attack_simulation and explain why they differ.\n"
    "- Return ONLY valid JSON. No markdown. No text outside the JSON object."
)

L3_SCHEMA = {
    "clear_student_explanation": "Explain what this vulnerability is and why it matters, in simple terms.",
    "why_this_matters_in_this_file": "Explain specifically why this is dangerous in THIS file/project.",
    "step_by_step_attack_simulation": [
        "Step 1: An attacker would first ...",
        "Step 2: Then they would ...",
        "Step 3: This would result in ...",
    ],
    "secure_fix_steps": [
        "Step 1: ...",
        "Step 2: ...",
    ],
    "secure_code_example": "Complete corrected code that directly fixes the vulnerable code from the snippet.",
    "defense_in_depth": [
        "Additional defense layer 1",
        "Additional defense layer 2",
    ],
    "core_security_principle": "The fundamental security concept this vulnerability teaches (e.g., input validation, least privilege).",
    "common_student_mistake": "A specific mistake students commonly make that leads to this vulnerability.",
    "learning_takeaways": [
        "Key lesson 1",
        "Key lesson 2",
    ],
}


# =====================================================================
#  LAYER 4 -- AI Self-Critic / Quality Reviewer
# =====================================================================
L4_SYSTEM_PROMPT = (
    "You are a strict quality reviewer for AI-generated security analysis.\n\n"
    "You receive a student-facing explanation (Layer 3). Your job is to check it for:\n"
    "1. Hallucinations -- claims not grounded in the original evidence.\n"
    "2. Generic filler -- vague statements that could apply to any vulnerability.\n"
    "3. Incorrect fixes -- secure code examples that would not actually fix the issue.\n"
    "4. Missing context -- important details from the technical analysis that were lost.\n"
    "5. Overly complex language -- explanations a CS student would not understand.\n\n"
    "Rules:\n"
    "- If the Layer 3 output is high quality, return it UNCHANGED with corrections_made=false.\n"
    "- If corrections are needed, return the CORRECTED version of ALL fields with corrections_made=true.\n"
    "- Add a corrections_summary field listing what you fixed and why.\n"
    "- Do NOT add information that was not in the original analysis layers.\n"
    "- Return ONLY valid JSON. No markdown. No text outside the JSON object."
)

L4_SCHEMA = {
    "corrections_made": False,
    "corrections_summary": "List of corrections made, or 'No corrections needed' if output was high quality.",
    "clear_student_explanation": "...",
    "why_this_matters_in_this_file": "...",
    "step_by_step_attack_simulation": ["..."],
    "secure_fix_steps": ["..."],
    "secure_code_example": "...",
    "defense_in_depth": ["..."],
    "core_security_principle": "...",
    "common_student_mistake": "...",
    "learning_takeaways": ["..."],
}


# =====================================================================
#  EXECUTIVE SUMMARY
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

# Keep a generic SYSTEM_PROMPT for the executive summary call
SYSTEM_PROMPT = (
    "You are a senior cybersecurity mentor teaching a computer science student.\n\n"
    "Rules:\n"
    "- Return ONLY valid JSON. No markdown. No text outside the JSON object.\n"
    "- Be clear, structured, and educational."
)


# =====================================================================
#  PROMPT BUILDERS
# =====================================================================

def build_layer1_prompt(payload: Dict[str, Any]) -> str:
    """Layer 1: Feed raw vulnerability data for technical root cause analysis."""
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

    return (
        f"Analyze this vulnerability finding. Examine ONLY what is visible in the code.\n\n"
        f"Vulnerability Details:\n"
        f"Title: {title}\n"
        f"Category: {category}\n"
        f"Severity: {severity}\n"
        f"Risk Score: {score}/10\n"
        f"File: {filepath}\n"
        f"Line: {line}\n"
        f"{id_line}"
        f"Description: {desc}\n\n"
        f"Code Snippet:\n```\n{snippet}\n```\n\n"
        f"Return STRICT JSON matching this schema:\n"
        f"{json.dumps(L1_SCHEMA, indent=2)}"
    )


def build_layer2_prompt(layer1_json: Dict[str, Any]) -> str:
    """Layer 2: Feed Layer 1 output for exploit and risk modeling."""
    return (
        f"Based on this grounded technical analysis, model a realistic exploit path.\n\n"
        f"Layer 1 -- Technical Analysis:\n"
        f"{json.dumps(layer1_json, indent=2)}\n\n"
        f"Return STRICT JSON matching this schema:\n"
        f"{json.dumps(L2_SCHEMA, indent=2)}"
    )


def build_layer3_prompt(
    layer1_json: Dict[str, Any],
    layer2_json: Dict[str, Any],
    payload: Dict[str, Any],
) -> str:
    """Layer 3: Translate L1+L2 into student-friendly educational content."""
    filepath = payload.get("file", "unknown")
    snippet  = payload.get("code_snippet") or "Not available"

    return (
        f"Translate this security analysis into student-friendly educational content.\n\n"
        f"Original File: {filepath}\n"
        f"Original Code:\n```\n{snippet}\n```\n\n"
        f"Layer 1 -- Technical Root Cause:\n"
        f"{json.dumps(layer1_json, indent=2)}\n\n"
        f"Layer 2 -- Exploit & Risk Model:\n"
        f"{json.dumps(layer2_json, indent=2)}\n\n"
        f"Return STRICT JSON matching this schema:\n"
        f"{json.dumps(L3_SCHEMA, indent=2)}"
    )


def build_layer4_prompt(layer3_json: Dict[str, Any]) -> str:
    """Layer 4: Quality-review the Layer 3 student explanation."""
    return (
        f"Review the following student-facing security explanation for quality.\n"
        f"Check for hallucinations, generic filler, incorrect fixes, and clarity.\n\n"
        f"Layer 3 -- Student Explanation to Review:\n"
        f"{json.dumps(layer3_json, indent=2)}\n\n"
        f"If the output is high quality, return it unchanged with corrections_made=false.\n"
        f"If corrections are needed, return the corrected version with corrections_made=true.\n\n"
        f"Return STRICT JSON matching this schema:\n"
        f"{json.dumps(L4_SCHEMA, indent=2)}"
    )


# Legacy compatibility alias
def build_single_vuln_prompt(payload: Dict[str, Any]) -> str:
    """Backward-compatible single-prompt builder (delegates to Layer 1)."""
    return build_layer1_prompt(payload)


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
