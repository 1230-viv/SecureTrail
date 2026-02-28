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


# =====================================================================
#  EXECUTIVE PDF REPORT BUILDER
# =====================================================================

def _risk_level_from_counts(critical: int, high: int, medium: int, total: int) -> str:
    if critical > 0:
        return "Critical Risk"
    if high >= 10 or (high > 0 and total > 50):
        return "High Risk"
    if high > 0 or medium >= 10:
        return "Moderate Risk"
    return "Low Risk"


def _risk_rationale(critical: int, high: int, medium: int, low: int, info: int) -> str:
    parts = []
    if critical > 0:
        parts.append(f"{critical} critical-severity finding(s) requiring immediate remediation")
    if high > 0:
        parts.append(f"{high} high-severity finding(s) with significant exploitation potential")
    if medium > 0:
        parts.append(f"{medium} medium-severity finding(s) warranting short-term attention")
    if low > 0:
        parts.append(f"{low} low-severity finding(s) suitable for planned remediation")
    if not parts:
        return "No exploitable vulnerabilities were identified during this scan."
    return "The overall risk classification is driven by: " + "; ".join(parts) + "."


def build_markdown_report(result: dict) -> str:
    """
    Generate a professional, executive-level security scan report in Markdown.
    Takes the full ScanReport dict (from DB or job_manager) and returns a
    UTF-8 Markdown string suitable for PDF conversion.
    """
    from datetime import datetime, timezone

    # ── Metadata ────────────────────────────────────────────────────
    repo_name   = result.get("repository_name", "Unknown Repository")
    job_id      = result.get("job_id", "N/A")
    raw_ts      = result.get("scan_timestamp", "")
    try:
        scan_date = datetime.fromisoformat(str(raw_ts)).strftime("%d %B %Y at %H:%M UTC")
    except Exception:
        scan_date = str(raw_ts) or datetime.now(timezone.utc).strftime("%d %B %Y at %H:%M UTC")

    vulns     = result.get("vulnerabilities", []) or []
    critical  = result.get("critical_count",  0) or 0
    high      = result.get("high_count",      0) or 0
    medium    = result.get("medium_count",    0) or 0
    low       = result.get("low_count",       0) or 0
    info      = result.get("info_count",      0) or 0
    total     = result.get("total_vulnerabilities", len(vulns)) or len(vulns)

    risk_label    = _risk_level_from_counts(critical, high, medium, total)
    risk_rationale = _risk_rationale(critical, high, medium, low, info)

    # ── Category breakdown ──────────────────────────────────────────
    from collections import Counter
    cat_counts: Counter = Counter()
    file_counts: Counter = Counter()
    for v in vulns:
        cat = v.get("category") or "Other"
        cat_counts[cat] += 1
        fp  = v.get("file") or v.get("file_path") or ""
        if fp:
            file_counts[fp.split("/")[-1]] += 1

    top_cats  = cat_counts.most_common(8)
    top_files = file_counts.most_common(5)

    # ── Top critical/high findings ──────────────────────────────────
    priority_vulns = [
        v for v in vulns
        if (v.get("severity") or "").upper() in ("CRITICAL", "HIGH")
    ][:10]

    # ── Scanner results ─────────────────────────────────────────────
    scanner_results = result.get("scanner_results", {}) or {}
    scanners_used   = [s for s, d in scanner_results.items() if d and d.get("total_findings", 0) > 0]

    # ── Affected files ───────────────────────────────────────────────
    top_files_md = ""
    if top_files:
        top_files_md = "\n".join(f"- `{f}` — {c} finding(s)" for f, c in top_files)
    else:
        top_files_md = "- No file-level data available."

    # ── Category distribution ────────────────────────────────────────
    if top_cats:
        cat_md = "\n".join(f"| {cat} | {cnt} |" for cat, cnt in top_cats)
    else:
        cat_md = "| No findings | 0 |"

    # ── Key findings narrative ────────────────────────────────────────
    key_findings_lines = []
    for cat, cnt in top_cats[:5]:
        pct = round(cnt / total * 100) if total else 0
        key_findings_lines.append(f"- **{cat}**: {cnt} instance(s) ({pct}% of total findings)")
    if not key_findings_lines:
        key_findings_lines = ["- No actionable findings identified."]

    # ── Priority findings table ───────────────────────────────────────
    if priority_vulns:
        pv_rows = "\n".join(
            f"| {v.get('severity','').upper()} | {v.get('title','Unknown')[:60]} "
            f"| `{(v.get('file') or v.get('file_path') or 'N/A').split('/')[-1]}`"
            f":{v.get('line', '?')} |"
            for v in priority_vulns
        )
        priority_table = (
            "| Severity | Title | Location |\n"
            "|----------|-------|----------|\n"
            + pv_rows
        )
    else:
        priority_table = "_No critical or high-severity findings identified._"

    # ── Recommendations ───────────────────────────────────────────────
    immediate_recs = []
    short_term_recs = []
    long_term_recs = []

    for cat, _ in top_cats[:3]:
        cat_lower = cat.lower()
        if "inject" in cat_lower or "secret" in cat_lower or "credential" in cat_lower:
            immediate_recs.append(f"Remediate all **{cat}** findings — rotate any exposed credentials immediately.")
        elif "auth" in cat_lower or "jwt" in cat_lower or "access" in cat_lower:
            immediate_recs.append(f"Audit and harden **{cat}** implementations across all affected endpoints.")
        elif "depend" in cat_lower or "cve" in cat_lower:
            immediate_recs.append(f"Upgrade vulnerable dependencies identified under **{cat}**; review release advisories.")

    if high > 0 and not immediate_recs:
        immediate_recs.append(f"Address all {high} high-severity finding(s) within the current sprint cycle.")

    short_term_recs = [
        f"Remediate all {medium} medium-severity findings within 30 days.",
        "Integrate static analysis (SAST) into the CI/CD pipeline to prevent regression.",
        "Conduct a manual code review focused on authentication and input validation logic.",
    ] if medium > 0 else [
        "Integrate automated security scanning into the CI/CD pipeline.",
        "Establish a recurring vulnerability assessment cadence (minimum quarterly).",
    ]

    long_term_recs = [
        "Adopt a Secure Development Lifecycle (SDL) framework across the engineering team.",
        "Implement runtime security monitoring and anomaly detection in production.",
        "Schedule annual penetration testing by a qualified third-party assessor.",
        "Develop and maintain a formal Vulnerability Management Policy.",
    ]

    immediate_md  = "\n".join(f"- {r}" for r in immediate_recs) if immediate_recs else "- No immediate actions required."
    short_term_md = "\n".join(f"- {r}" for r in short_term_recs)
    long_term_md  = "\n".join(f"- {r}" for r in long_term_recs)

    # ── Business impact ───────────────────────────────────────────────
    impact_items = []
    if critical > 0 or high > 0:
        impact_items.append(
            "**Data Breach Risk**: The presence of critical/high findings, "
            "particularly authentication and injection vulnerabilities, increases the "
            "likelihood of unauthorized data access or exfiltration."
        )
    if cat_counts.get("CORS Misconfiguration", 0) > 0 or cat_counts.get("Broken Access Control", 0) > 0:
        impact_items.append(
            "**Compliance Exposure**: Cross-origin misconfigurations and access control gaps "
            "may constitute violations under OWASP Top 10, PCI-DSS, and GDPR data protection requirements."
        )
    if cat_counts.get("Vulnerable Components", 0) > 0 or cat_counts.get("Dependency Vulnerability (CVE)", 0) > 0:
        impact_items.append(
            "**Supply-Chain Risk**: Third-party dependencies with known CVEs represent an "
            "externally exploitable attack surface that is often targeted by automated scanners."
        )
    if total > 0:
        impact_items.append(
            "**Service Disruption**: Exploitation of unmitigated findings could result in "
            "degraded service availability, including potential denial-of-service conditions."
        )
        impact_items.append(
            "**Reputational Damage**: A security incident stemming from preventable vulnerabilities "
            "may erode customer trust and trigger regulatory scrutiny."
        )
    if not impact_items:
        impact_items = [
            "No significant business impact identified. The repository demonstrates a strong security posture.",
            "Continue to maintain proactive security practices to preserve this status.",
        ]

    impact_md = "\n".join(f"- {i}" for i in impact_items)

    # ── Scanners used ─────────────────────────────────────────────────
    scanners_md = ", ".join(s.capitalize() for s in scanners_used) if scanners_used else "Multiple scanners"

    # ── Assemble report ───────────────────────────────────────────────
    report = f"""# Security Scan Summary Report

---

**Repository:** {repo_name}
**Scan Date:** {scan_date}
**Job Reference:** `{job_id[:16]}`
**Scanners Used:** {scanners_md}
**Report Classification:** Confidential — Internal Distribution Only

---

## 1. Executive Summary

A security assessment of the repository **{repo_name}** was conducted on {scan_date}
using the SecureTrail automated scanning platform. The scan analysed the codebase using
{scanners_md} and identified a total of **{total} findings** across five severity tiers.

The repository's overall security posture is classified as **{risk_label}**.
{risk_rationale}

{"Immediate remediation of critical and high-severity findings is strongly recommended prior to any production deployment or release." if (critical + high) > 0 else "No critical or high-severity vulnerabilities were detected. The repository is considered suitable for deployment subject to ongoing monitoring and the resolution of medium/low findings."}

---

## 2. Risk Assessment

### Severity Distribution

| Severity | Count | Percentage |
|----------|-------|------------|
| Critical | {critical} | {round(critical/total*100) if total else 0}% |
| High | {high} | {round(high/total*100) if total else 0}% |
| Medium | {medium} | {round(medium/total*100) if total else 0}% |
| Low | {low} | {round(low/total*100) if total else 0}% |
| Informational | {info} | {round(info/total*100) if total else 0}% |
| **Total** | **{total}** | **100%** |

### Overall Risk Classification: {risk_label.upper()}

{risk_rationale}

{"**Exploitation likelihood is elevated.** Critical and high vulnerabilities typically have well-documented exploit techniques and are actively targeted in automated attack campaigns." if (critical + high) > 0 else "The absence of critical and high findings significantly reduces the immediate exploitation risk. Medium-severity issues should nevertheless be treated with urgency to prevent future escalation."}

---

## 3. Key Findings

### Vulnerability Categories

| Category | Findings |
|----------|---------|
{cat_md}

### Summary

{chr(10).join(key_findings_lines)}

### Priority Findings (Critical and High)

{priority_table}

---

## 4. Business Impact Analysis

{impact_md}

---

## 5. Recommendations

### Immediate Actions (Critical and High Severity)

{immediate_md}

### Short-Term Improvements (30–60 Days)

{short_term_md}

### Long-Term Security Enhancements

{long_term_md}

---

## 6. Remediation Roadmap

### Priority 1 — Critical Fixes (Resolve Within 24–72 Hours)

{"Resolve all " + str(critical) + " critical-severity finding(s) identified in this scan. These represent the highest exploitability risk and must be treated as blocking issues." if critical > 0 else "No critical-severity findings require immediate attention."}

### Priority 2 — High-Severity Issues (Resolve Within Current Sprint)

{"Address all " + str(high) + " high-severity finding(s). Assign dedicated engineering time within the current development sprint. Track each issue to completion in the project backlog." if high > 0 else "No high-severity findings identified."}

### Priority 3 — Medium and Optimisation (30-Day Window)

{"Schedule remediation of all " + str(medium) + " medium-severity findings. These may not be immediately exploitable but represent technical debt that reduces the overall security posture over time." if medium > 0 else "No medium-severity findings identified."}

### Most Affected Files

{top_files_md}

### Monitoring Recommendations

- Configure automated scanning on every pull request and main-branch merge.
- Establish severity-based alerting thresholds: any critical finding blocks merge.
- Review dependency manifests (`requirements.txt`, `package.json`, etc.) weekly using an SCA tool.
- Retain scan reports for a minimum of 12 months for compliance audit purposes.

---

## 7. Conclusion

The security assessment of **{repo_name}** has yielded **{total} findings**, with the
repository classified at **{risk_label}** overall.
{"The presence of critical or high-severity vulnerabilities necessitates prioritised remediation before this codebase is exposed to production traffic or external users." if (critical + high) > 0 else "The absence of critical and high findings is a positive indicator. However, the identified medium and lower-severity issues should be addressed to maintain compliance and reduce long-term risk."}

Engineering teams are advised to adopt the remediation roadmap outlined in Section 6.
Long-term security maturity requires both reactive remediation and proactive integration of security
practices into the development lifecycle, including automated scanning, developer security training,
and regular third-party assessments.

---

_Report generated by SecureTrail Automated Security Platform._
_Scan Reference: `{job_id[:16]}` | {scan_date}_
"""
    return report.strip()


# =====================================================================
#  HYBRID REPORT — AI NARRATIVE PROMPT
# =====================================================================

REPORT_SYSTEM_PROMPT = (
    "You are a senior cybersecurity analyst writing a professional security report "
    "for enterprise stakeholders (CTO, Security Lead, Compliance Auditor).\n\n"
    "STRICT RULES:\n"
    "- Return ONLY valid JSON. No markdown. No text outside the JSON object.\n"
    "- Base all analysis on the provided scan data. Do NOT invent findings.\n"
    "- Use formal, precise enterprise language. No casual tone.\n"
    "- Each section should be 2-4 concise paragraphs in plain prose (no sub-bullets inside JSON strings).\n"
    "- Use \\n\\n to separate paragraphs within each JSON string value."
)


def build_ai_report_prompt(result: dict) -> str:
    """
    Build the user-facing message sent to Bedrock for the narrative sections of the report.
    Asks the model to produce only the three AI-authored sections as structured JSON.
    """
    from collections import Counter

    repo_name   = result.get("repository_name", "Unknown Repository")
    vulns       = result.get("vulnerabilities", []) or []
    critical    = result.get("critical_count",  0) or 0
    high        = result.get("high_count",      0) or 0
    medium      = result.get("medium_count",    0) or 0
    low         = result.get("low_count",       0) or 0
    info        = result.get("info_count",      0) or 0
    total       = result.get("total_vulnerabilities", len(vulns)) or len(vulns)

    cat_counts: Counter = Counter(
        (v.get("category") or "Other") for v in vulns
    )
    top_cats = cat_counts.most_common(8)

    priority_vulns = [
        f"- [{v.get('severity','').upper()}] {v.get('title','Unknown')} "
        f"in {(v.get('file') or v.get('file_path') or 'N/A').split('/')[-1]}"
        for v in vulns
        if (v.get("severity") or "").upper() in ("CRITICAL", "HIGH")
    ][:12]

    risk = _risk_level_from_counts(critical, high, medium, total)
    cat_summary = ", ".join(f"{c} ({n})" for c, n in top_cats[:6])
    priority_block = "\n".join(priority_vulns) if priority_vulns else "None identified."

    ai_schema = {
        "executive_summary": (
            "2-4 paragraph executive overview of the security posture of the repository. "
            "Reference the actual counts and risk level. Suitable for non-technical stakeholders."
        ),
        "key_findings_analysis": (
            "2-3 paragraph analysis of the most significant vulnerability categories found, "
            "patterns of concern, and any critical/high findings that require priority attention."
        ),
        "business_impact": (
            "2-3 paragraph analysis of the realistic business risks: data breach potential, "
            "compliance exposure, service disruption, and reputational risk based on the actual findings."
        ),
    }

    return (
        f"Generate a professional security report narrative for the following scan results.\n\n"
        f"Repository: {repo_name}\n"
        f"Overall Risk Level: {risk}\n"
        f"Total Findings: {total}\n"
        f"Critical: {critical} | High: {high} | Medium: {medium} | Low: {low} | Info: {info}\n\n"
        f"Top Vulnerability Categories:\n{cat_summary}\n\n"
        f"Critical and High Priority Findings:\n{priority_block}\n\n"
        f"Return STRICT JSON in exactly this format:\n"
        f"{json.dumps(ai_schema, indent=2)}\n\n"
        f"Return ONLY the JSON object. No markdown. No preamble."
    )


def build_hybrid_markdown_report(result: dict, ai_narratives: dict) -> str:
    """
    Assemble the full report using AI-generated prose for narrative sections
    (Executive Summary, Key Findings, Business Impact) and the deterministic
    template for all data-driven sections (tables, roadmap, recommendations).
    """
    from datetime import datetime, timezone
    from collections import Counter

    # ── Metadata ────────────────────────────────────────────────────
    repo_name   = result.get("repository_name", "Unknown Repository")
    job_id      = result.get("job_id", "N/A")
    raw_ts      = result.get("scan_timestamp", "")
    try:
        scan_date = datetime.fromisoformat(str(raw_ts)).strftime("%d %B %Y at %H:%M UTC")
    except Exception:
        scan_date = str(raw_ts) or datetime.now(timezone.utc).strftime("%d %B %Y at %H:%M UTC")

    vulns     = result.get("vulnerabilities", []) or []
    critical  = result.get("critical_count",  0) or 0
    high      = result.get("high_count",      0) or 0
    medium    = result.get("medium_count",    0) or 0
    low       = result.get("low_count",       0) or 0
    info      = result.get("info_count",      0) or 0
    total     = result.get("total_vulnerabilities", len(vulns)) or len(vulns)

    risk_label     = _risk_level_from_counts(critical, high, medium, total)
    risk_rationale = _risk_rationale(critical, high, medium, low, info)

    cat_counts: Counter = Counter()
    file_counts: Counter = Counter()
    for v in vulns:
        cat_counts[v.get("category") or "Other"] += 1
        fp = v.get("file") or v.get("file_path") or ""
        if fp:
            file_counts[fp.split("/")[-1]] += 1

    top_cats  = cat_counts.most_common(8)
    top_files = file_counts.most_common(5)

    # ── Scanner results ─────────────────────────────────────────────
    scanner_results = result.get("scanner_results", {}) or {}
    scanners_used   = [s for s, d in scanner_results.items() if d and d.get("total_findings", 0) > 0]
    scanners_md     = ", ".join(s.capitalize() for s in scanners_used) if scanners_used else "Multiple scanners"

    # ── AI narrative sections (with fallback if key missing) ─────────
    exec_summary = ai_narratives.get("executive_summary", "").strip()
    key_findings = ai_narratives.get("key_findings_analysis", "").strip()
    biz_impact   = ai_narratives.get("business_impact", "").strip()

    # ── Category table ────────────────────────────────────────────────
    cat_md = "\n".join(f"| {cat} | {cnt} |" for cat, cnt in top_cats) if top_cats else "| No findings | 0 |"

    # ── Priority findings table ───────────────────────────────────────
    priority_vulns = [
        v for v in vulns
        if (v.get("severity") or "").upper() in ("CRITICAL", "HIGH")
    ][:10]

    if priority_vulns:
        pv_rows = "\n".join(
            f"| {v.get('severity','').upper()} | {v.get('title','Unknown')[:60]} "
            f"| `{(v.get('file') or v.get('file_path') or 'N/A').split('/')[-1]}`"
            f":{v.get('line', '?')} |"
            for v in priority_vulns
        )
        priority_table = (
            "| Severity | Title | Location |\n"
            "|----------|-------|----------|\n"
            + pv_rows
        )
    else:
        priority_table = "_No critical or high-severity findings identified._"

    # ── Recommendations ───────────────────────────────────────────────
    immediate_recs = []
    for cat, _ in top_cats[:3]:
        cat_lower = cat.lower()
        if "inject" in cat_lower or "secret" in cat_lower or "credential" in cat_lower:
            immediate_recs.append(f"Remediate all **{cat}** findings and rotate any exposed credentials immediately.")
        elif "auth" in cat_lower or "jwt" in cat_lower or "access" in cat_lower:
            immediate_recs.append(f"Audit and harden **{cat}** implementations across all affected endpoints.")
        elif "depend" in cat_lower or "cve" in cat_lower:
            immediate_recs.append(f"Upgrade vulnerable dependencies identified under **{cat}**; review release advisories.")
    if not immediate_recs and (critical + high) > 0:
        immediate_recs.append(f"Address all {critical + high} critical/high-severity finding(s) before next release.")

    short_term_recs = (
        [
            f"Remediate all {medium} medium-severity findings within 30 days.",
            "Integrate SAST tooling into the CI/CD pipeline to prevent regression.",
            "Conduct a manual code review focused on authentication and input validation.",
        ] if medium > 0 else [
            "Integrate automated security scanning into the CI/CD pipeline.",
            "Establish a recurring vulnerability assessment cadence (minimum quarterly).",
        ]
    )
    long_term_recs = [
        "Adopt a Secure Development Lifecycle (SDL) framework across the engineering team.",
        "Implement runtime security monitoring and anomaly detection in production.",
        "Schedule annual penetration testing by a qualified third-party assessor.",
        "Develop and maintain a formal Vulnerability Management Policy.",
    ]

    immediate_md  = "\n".join(f"- {r}" for r in immediate_recs) if immediate_recs else "- No immediate actions required."
    short_term_md = "\n".join(f"- {r}" for r in short_term_recs)
    long_term_md  = "\n".join(f"- {r}" for r in long_term_recs)

    # ── Affected files ────────────────────────────────────────────────
    top_files_md = (
        "\n".join(f"- `{f}` — {c} finding(s)" for f, c in top_files)
        if top_files else "- No file-level data available."
    )

    report = f"""# Security Scan Summary Report

---

**Repository:** {repo_name}
**Scan Date:** {scan_date}
**Job Reference:** `{job_id[:16]}`
**Scanners Used:** {scanners_md}
**Report Classification:** Confidential — Internal Distribution Only

> *Narrative sections of this report were authored by an AI security analyst (AWS Bedrock).
> All numerical data is derived directly from scan results.*

---

## 1. Executive Summary

{exec_summary}

---

## 2. Risk Assessment

### Severity Distribution

| Severity | Count | Percentage |
|----------|-------|------------|
| Critical | {critical} | {round(critical/total*100) if total else 0}% |
| High | {high} | {round(high/total*100) if total else 0}% |
| Medium | {medium} | {round(medium/total*100) if total else 0}% |
| Low | {low} | {round(low/total*100) if total else 0}% |
| Informational | {info} | {round(info/total*100) if total else 0}% |
| **Total** | **{total}** | **100%** |

### Overall Risk Classification: {risk_label.upper()}

{risk_rationale}

---

## 3. Key Findings

### Vulnerability Category Breakdown

| Category | Findings |
|----------|---------|
{cat_md}

### Analysis

{key_findings}

### Priority Findings (Critical and High)

{priority_table}

---

## 4. Business Impact Analysis

{biz_impact}

---

## 5. Recommendations

### Immediate Actions (Critical and High Severity)

{immediate_md}

### Short-Term Improvements (30–60 Days)

{short_term_md}

### Long-Term Security Enhancements

{long_term_md}

---

## 6. Remediation Roadmap

### Priority 1 — Critical Fixes (Resolve Within 24–72 Hours)

{"Resolve all " + str(critical) + " critical-severity finding(s). These represent the highest exploitability risk and must be treated as blocking issues." if critical > 0 else "No critical-severity findings require immediate attention."}

### Priority 2 — High-Severity Issues (Resolve Within Current Sprint)

{"Address all " + str(high) + " high-severity finding(s). Assign dedicated engineering time within the current sprint and track each issue to completion." if high > 0 else "No high-severity findings identified."}

### Priority 3 — Medium and Optimisation (30-Day Window)

{"Schedule remediation of all " + str(medium) + " medium-severity findings. These may not be immediately exploitable but represent technical debt that degrades security posture over time." if medium > 0 else "No medium-severity findings identified."}

### Most Affected Files

{top_files_md}

### Monitoring Recommendations

- Configure automated scanning on every pull request and main-branch merge.
- Establish severity-based alerting: any critical finding blocks merge.
- Review dependency manifests weekly using an SCA tool.
- Retain scan reports for a minimum of 12 months for compliance audit purposes.

---

## 7. Conclusion

The security assessment of **{repo_name}** has identified **{total} findings** with an overall
classification of **{risk_label}**.
{" Engineering teams must prioritise critical and high findings before any production deployment." if (critical + high) > 0 else " The absence of critical and high findings is a positive indicator; medium and lower findings should be addressed to maintain compliance and reduce long-term risk."}

Adoption of the remediation roadmap outlined in Section 6, combined with integration of automated
security tooling into the development pipeline, will materially reduce the organisation's attack
surface and improve long-term security maturity.

---

_Report generated by SecureTrail Automated Security Platform (AI-enhanced)._
_Scan Reference: `{job_id[:16]}` | {scan_date}_
"""
    return report.strip()
