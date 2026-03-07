"""
AI Mentor Module — SecureTrail Learning System v4
==================================================
Integrates with AWS Bedrock to produce per-finding coach responses + overview.

v4 changes (coach-first architecture):
  - New per-finding coach prompt: exact code mistake → why insecure → security
    impact → insecure_code_example → secure_code_fix (copy-paste ready) →
    why_the_fix_is_secure → secure_coding_lesson
  - AI generates an array of N coach objects (one per top finding)
  - Overview fields (learning_summary, behavioral_insights, recurring_patterns,
    priority_roadmap, maturity_explanation, risk_momentum_explanation) computed
    deterministically — reliable, zero AI dependency for aggregate context
  - coach_findings[] added to response for rich frontend deep-dive cards
  - deep_dive[] mapped from coach_findings for backward compat with frontend
  - temperature=0.2, max_tokens=3500 for focused, deterministic output
  - Safe educational language only (no "exploit", "attacker", "attack",
    "penetration" — uses misuse risk / unauthorized access / security weakness)
  - Caching by SHA-256(finding fingerprints + score delta), 24h TTL
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

from Learning.category_knowledge import classify_finding, get_knowledge
from Learning.learning_engine import (
    _get_findings,
    extract_severity_counts,
    compute_health_score,
)

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
AI_ENABLED: bool = os.getenv("AI_ENABLED", "false").lower() == "true"
_CACHE_DIR         = Path(__file__).parent / ".ai_cache"
_CACHE_TTL_SECONDS = 60 * 60 * 24       # 24 hours
_TOP_N_FINDINGS    = 5                  # findings sent to AI
_MAX_MSG_CHARS     = 200                # truncate finding messages
_MAX_CODE_CHARS    = 400                # truncate code snippets (v4: slightly larger for fix context)
_AI_MAX_TOKENS     = 3500              # v4: per-finding coach needs more tokens for code fixes
_AI_TEMPERATURE    = 0.2               # low temp: consistent, non-creative (structured JSON)

# ── v4 coach system prompt — per-finding code reviewer ───────────────────────
_COACH_SYSTEM_PROMPT = (
    "You are the SecureTrail AI Security Coach.\n"
    "Your job is to act like a senior security engineer reviewing a developer's code.\n"
    "You must behave like a mentor that teaches developers what they did wrong and how to fix it.\n\n"

    "IMPORTANT RULES:\n"
    "You will receive ONLY ONE vulnerability finding at a time.\n"
    "Your job is to analyze that specific finding and generate a coaching explanation.\n"
    "Do NOT explain vulnerability categories.\n"
    "Do NOT provide a generic explanation of IDOR, SQL Injection, Dependency issues, or any category.\n"
    "Instead you must explain:\n"
    "  • What is wrong in THIS specific file and line\n"
    "  • Why THIS code is insecure\n"
    "  • What the real security impact is\n"
    "  • How to fix THIS specific code\n"
    "  • Why the fix works\n"
    "  • What secure coding lesson the developer should learn\n\n"

    "Tone:\n"
    "Speak directly to the developer using 'you' and 'your code'.\n"
    "Your tone should be like a senior developer reviewing a pull request.\n"
    "Be educational and constructive.\n"
    "Never group vulnerabilities together.\n"
    "Every vulnerability must be treated as its own coaching explanation.\n\n"

    "Safety language:\n"
    "Do NOT use: exploit, attack steps, weaponize, penetration.\n"
    "Instead use: unauthorized access, exposure risk, misuse risk, unintended access.\n\n"

    "Code fix rules:\n"
    "• secure_code_fix.code MUST be real working code in the same language as the snippet.\n"
    "• Use the same function/variable names as the insecure snippet.\n"
    "• Never produce pseudocode unless critical context is truly missing — then set inferred=true.\n"
    "• If the snippet is truncated or incomplete, infer minimal context and set inferred=true.\n\n"

    "STRICT OUTPUT — return ONLY a single valid JSON object (no array, no markdown, no preamble).\n"
    "Use empty string \"\" for any field that does not apply. All fields required.\n"
    'Schema: {"vulnerability":"<short issue title>","severity":"<CRITICAL|HIGH|MEDIUM|LOW>",'
    '"file":"<repo-relative path>","line":"<line or range>","endpoint":"<endpoint or empty>",'
    '"cwe":"<CWE id or empty>","coach_explanation":"<1-2 sentences using you/your code, referencing this specific file and line>",'
    '"what_is_wrong":"<exact mistake in THIS code — not a generic category description>",'
    '"why_this_is_insecure":"<logic/flow reason tied directly to the snippet>",'
    '"security_impact":"<real risk to the application or business — use safe language>",'
    '"insecure_code_example":"<exact vulnerable snippet from the finding; if missing infer and set inferred:true>",'
    '"secure_code_fix":{"code":"<complete corrected code, paste-ready, same language, same function names>",'
    '"notes":"<required imports/config or inference notes>"},'
    '"why_the_fix_is_secure":"<what changed and why it prevents the issue>",'
    '"secure_coding_lesson":"<one short memorable principle for this specific issue>","inferred":<true|false>}'
)

# In-memory cache: {cache_key: (timestamp, response_dict)}
_MEM_CACHE: dict[str, tuple[float, dict]] = {}


# ── Cache helpers ─────────────────────────────────────────────────────────────
def _context_hash(top_findings: list[dict], health_score: int, prev_score: int) -> str:
    """Deterministic cache key from finding fingerprints + score delta."""
    fingerprints = sorted(
        f"{f.get('rule_id', '')}:{(f.get('severity') or 'info').lower()}"
        for f in top_findings
    )
    payload = ("|".join(fingerprints) + f"@{health_score}-{prev_score}").encode()
    return hashlib.sha256(payload).hexdigest()[:32]


def _read_cache(cache_key: str) -> dict | None:
    now = time.time()
    if cache_key in _MEM_CACHE:
        ts, data = _MEM_CACHE[cache_key]
        if now - ts < _CACHE_TTL_SECONDS:
            return data
        del _MEM_CACHE[cache_key]
    cache_file = _CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        try:
            raw  = json.loads(cache_file.read_text())
            if now - raw.get("_ts", 0) < _CACHE_TTL_SECONDS:
                data = {k: v for k, v in raw.items() if k != "_ts"}
                _MEM_CACHE[cache_key] = (now, data)
                return data
        except Exception:
            pass
    return None


def _write_cache(cache_key: str, data: dict) -> None:
    _MEM_CACHE[cache_key] = (time.time(), data)
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        (_CACHE_DIR / f"{cache_key}.json").write_text(
            json.dumps({**data, "_ts": time.time()}, indent=2)
        )
    except Exception as exc:
        logger.warning("Could not write AI cache: %s", exc)


# ── Deterministic per-finding coach fallback ─────────────────────────────────
def _build_coach_fallback(
    top_findings:       list[dict],
    recurring_patterns: list[dict] | None = None,
) -> list[dict]:
    """
    Produce deterministic per-finding coach objects following the v4 coach schema.
    Returns a list with one entry per finding — identical structure to the AI path.
    Used when AI is disabled or Bedrock call fails.
    """
    recurring_patterns = recurring_patterns or []
    coach_findings: list[dict] = []

    for i, finding in enumerate(top_findings, 1):
        cat      = classify_finding(finding)
        knowledge = get_knowledge(cat)
        vid      = finding.get("rule_id") or finding.get("check_id") or finding.get("id") or f"finding-{i}"
        sev      = (finding.get("severity") or "info").lower()
        file_path = (finding.get("file") or finding.get("path") or "").replace("\\", "/")
        short_path = "/".join(file_path.split("/")[-3:]) if file_path else "unknown location"
        line_no  = finding.get("line") or finding.get("start_line") or "?"
        code_raw = finding.get("code") or finding.get("code_snippet") or finding.get("lines") or ""
        code_snip = str(code_raw)[:_MAX_CODE_CHARS] if code_raw else ""
        cwe_list = knowledge.get("cwe_refs", [])
        endpoint = finding.get("endpoint") or finding.get("check_id") or ""
        is_recurring = any(r.get("category") == cat for r in recurring_patterns)

        sev_pts = {"critical": 15, "high": 8, "medium": 3, "low": 1}.get(sev, 0)

        label = knowledge.get("label", cat)
        plain = knowledge.get("plain_explanation", "")
        why_matters = knowledge.get("why_it_matters", "")
        secure_pat = knowledge.get("secure_pattern", "")
        impact_sum = knowledge.get("impact_summary", "unauthorized access or data exposure")

        coach_findings.append({
            "vulnerability":        label,
            "severity":             sev.upper(),
            "file":                 short_path,
            "line":                 str(line_no),
            "endpoint":             endpoint,
            "cwe":                  cwe_list[0] if cwe_list else "",
            "coach_explanation": (
                f"In your code at {short_path} (line {line_no}), you have a "
                f"{sev}-severity {label} issue. {plain[:160]}"
            ),
            "what_is_wrong": (
                f"{'[RECURRING] ' if is_recurring else ''}"
                f"Your code at {short_path}:{line_no} {plain[:200]}"
            ),
            "why_this_is_insecure": (
                f"Your code is insecure because {why_matters[:250]}"
                if why_matters else
                f"This pattern in your code creates an exposure risk that could lead to {impact_sum}."
            ),
            "security_impact": (
                f"If this {sev}-severity issue in {short_path} (line {line_no}) is misused, "
                f"it could lead to {impact_sum}. "
                f"Fixing it improves your security score by {sev_pts} points."
            ),
            "insecure_code_example": code_snip or f"# Insecure pattern detected at {short_path}:{line_no}\n# See finding {vid} for details",
            "secure_code_fix": {
                "code":  secure_pat,
                "notes": (
                    "Replace your current code at the flagged location with the secure version above. "
                    + (f"References: {', '.join(cwe_list)}" if cwe_list else "")
                ),
            },
            "why_the_fix_is_secure": (
                f"The corrected implementation eliminates the {label} weakness in your code "
                f"by enforcing proper validation and safe API usage, preventing "
                f"the unintended access path that existed before."
            ),
            "secure_coding_lesson": (
                f"Remember: {(knowledge.get('checklist') or ['Always validate and sanitize user input before processing'])[0]}"
            ),
            "inferred": not bool(code_snip),
        })

    return coach_findings


# ── Deterministic overview fields ─────────────────────────────────────────────
def _build_overview_deterministic(
    top_findings:       list[dict],
    health_score:       int = 0,
    prev_score:         int | None = None,
    behavioral_hints:   list[dict] | None = None,
    recurring_patterns: list[dict] | None = None,
    maturity_level:     str = "beginner",
    risk_momentum:      str = "stable",
) -> dict:
    """
    Deterministic overview fields (learning_summary, behavioral_insights,
    recurring_patterns, priority_roadmap, maturity_explanation,
    risk_momentum_explanation).  These are computed from rule-based logic and
    the category_knowledge library — no AI required.
    """
    recurring_patterns = recurring_patterns or []
    behavioral_hints   = behavioral_hints   or []

    score_delta = (health_score - prev_score) if prev_score is not None else None
    trend_word  = (
        "improving" if (score_delta or 0) > 5
        else "worsening" if (score_delta or 0) < -5
        else "stable"
    )

    # ── Priority roadmap ──────────────────────────────────────────────────────
    priority_roadmap: list[dict] = []
    for rank, finding in enumerate(top_findings, 1):
        cat      = classify_finding(finding)
        knowledge = get_knowledge(cat)
        sev      = (finding.get("severity") or "info").lower()
        priority_roadmap.append({
            "rank":              rank,
            "category":          cat,
            "reason":            f"Severity: {sev}. {knowledge['plain_explanation'][:150]}",
            "action":            (knowledge.get("checklist") or ["Follow secure coding practices"])[0],
            "estimated_time":    "1–4 hours",
            "score_improvement": {"critical": 15, "high": 8, "medium": 3, "low": 1}.get(sev, 0),
        })

    # ── Behavioral insights ───────────────────────────────────────────────────
    bi_list = [
        {
            "pattern":        h.get("pattern_name", h.get("pattern", "")),
            "habit":          h.get("habit", ""),
            "recommendation": h.get("recommendation", ""),
        }
        for h in behavioral_hints[:4]
    ]

    # ── Recurring patterns ────────────────────────────────────────────────────
    rp_list = [
        {
            "category":              r.get("category", ""),
            "observation":           r.get("message", ""),
            "root_cause_hypothesis": r.get("suggestion", ""),
        }
        for r in recurring_patterns[:3]
    ]

    # ── Learning summary headline ─────────────────────────────────────────────
    delta_phrase = ""
    if score_delta is not None:
        if score_delta > 0:
            delta_phrase = f" Your security score improved by {score_delta} points this scan."
        elif score_delta < 0:
            delta_phrase = f" Your score dropped by {abs(score_delta)} points — prioritise these fixes."

    headline = (
        f"Your repository is at {health_score}/100 security health ({trend_word})."
        f"{delta_phrase} "
        f"Focus on the {len(top_findings)} top findings below. "
        "Each coach card shows you the exact weakness and a copy-paste secure fix."
    )

    # ── Risk momentum ─────────────────────────────────────────────────────────
    momentum_map = {
        "increasing": "Your risk profile is increasing — new or recurring high-severity issues are introducing more exposure. Prioritise immediate remediation.",
        "decreasing": "Your risk profile is improving — resolved findings have reduced the overall exposure surface. Keep this momentum going.",
        "stable":     "Your risk profile is stable. No significant new security weaknesses were introduced since the last scan.",
    }

    return {
        "learning_summary":          headline,
        "behavioral_insights":       bi_list,
        "recurring_patterns":        rp_list,
        "priority_roadmap":          priority_roadmap,
        "maturity_explanation": {
            "current_level":  maturity_level,
            "reasons":        ["Determined by your current health score and finding distribution"],
            "to_advance":     ["Resolve critical and high findings to raise your score"],
            "encouragement":  "Every fix counts. Keep scanning regularly to track your progress.",
        },
        "risk_momentum_explanation": momentum_map.get(risk_momentum, momentum_map["stable"]),
    }


# ── Coach prompt builder (v4 — single finding) ───────────────────────────────
def _build_coach_prompt(
    finding:            dict,
    project_name:       str = "",
    recurring_patterns: list[dict] | None = None,
    index:              int = 0,
) -> str:
    """
    Build a per-finding coach prompt for a SINGLE vulnerability.
    The model returns ONE JSON object (not an array) — one focused coaching
    session per finding, eliminating cross-finding contamination.
    """
    recurring_patterns = recurring_patterns or []

    cat       = classify_finding(finding)
    knowledge = get_knowledge(cat)
    sev       = (finding.get("severity") or "info").lower()
    file_path = (finding.get("file") or finding.get("path") or "").replace("\\", "/")
    short_path = "/".join(file_path.split("/")[-3:]) if file_path else ""
    line_no   = finding.get("line") or finding.get("start_line") or ""
    code_raw  = finding.get("code") or finding.get("code_snippet") or finding.get("lines") or ""
    code_snip = str(code_raw)[:_MAX_CODE_CHARS] if code_raw else ""
    cwe_list  = knowledge.get("cwe_refs", [])
    endpoint  = finding.get("endpoint") or finding.get("check_id") or ""
    is_rec    = any(r.get("category") == cat for r in recurring_patterns)
    message   = (finding.get("message") or finding.get("description") or "")[:_MAX_MSG_CHARS]

    input_obj = {
        "project_name":       project_name or "your repository",
        "file":               short_path,
        "line":               str(line_no),
        "severity":           sev.upper(),
        "vulnerability_type": knowledge.get("label", cat),
        "endpoint":           endpoint,
        "cwe":                cwe_list[0] if cwe_list else "",
        "message":            message,
        "code_snippet":       code_snip,
        "is_recurring":       is_rec,
    }
    input_json = json.dumps(input_obj, indent=2)

    code_note = (
        f"The vulnerable snippet is shown in code_snippet. "
        "Tie every explanation directly to that specific code."
        if code_snip
        else
        "No code snippet was captured for this finding. "
        "Infer the most likely insecure pattern from the file path, vulnerability_type, and message. "
        "Set inferred=true in your response."
    )

    return f"""You are the SecureTrail AI Security Coach — a senior application security
engineer reviewing a developer's code and teaching them to write secure code.

You are coaching on Issue #{index + 1} for {project_name or 'this project'}.
This is ONE specific vulnerability. Do not reference any other findings.
Treat this as a private mentor session with the developer who wrote this code.

THIS IS THE ONLY VULNERABILITY YOU ARE COACHING:
{input_json}

YOUR TASK — analyze this specific finding and produce a clear coaching explanation:
1. What the developer did wrong in this specific code (file and line above).
2. Why the code is insecure (logic/flow reason tied to the snippet).
3. The potential security impact (use: unauthorized access, exposure risk, misuse risk).
4. The insecure code pattern from code_snippet above.
5. A corrected secure implementation — real working code, copy-paste ready,
   same language, same function/variable names, same code style.
6. Why the corrected implementation is secure — what changed and why it prevents the issue.
7. A secure coding lesson the developer should remember for this type of issue.

{code_note}

STRICT RULES:
- Speak directly to the developer: use "you" and "your code" throughout
- Do NOT explain vulnerability categories in general
- Everything must reference THIS specific file, line, and code pattern
- Avoid: exploit, weaponize, attack steps, penetration
- secure_code_fix.code must be working code in the same language as the file
- Use the same variable and function names from the original snippet
- Be clear and educational — teach the developer, not just describe the problem
- Focus on practical secure coding guidance, not long theoretical explanations

Return ONLY a single raw JSON object — no array wrapper, no markdown, no preamble."""


# ── Bedrock integration (v4 — single finding, returns dict) ──────────────────
def _call_bedrock_coach(prompt: str) -> dict:
    """
    Invoke the configured Bedrock model for a SINGLE finding.
    Expects a single JSON object back (not an array).
    Validates and normalises the response against the v4 coach schema.
    Returns a single validated dict.
    """
    from Engines.ai.bedrock_client import invoke_claude  # lazy import

    response_text = invoke_claude(
        system_prompt=_COACH_SYSTEM_PROMPT,
        user_message=prompt,
        temperature=_AI_TEMPERATURE,
        max_tokens=_AI_MAX_TOKENS,
    )

    # ── Clean up any accidental markdown wrapping ─────────────────────────────
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        lines  = cleaned.split("\n")
        start  = 1
        end    = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        cleaned = "\n".join(lines[start:end]).strip()

    if not cleaned:
        raise ValueError("Bedrock returned empty response text")

    # ── Extract the first JSON object or array ────────────────────────────────
    if cleaned[0] not in ("[", "{"):
        import re as _re
        m = _re.search(r"[{\[]", cleaned)
        if m:
            cleaned = cleaned[m.start():]
        else:
            raise ValueError(f"No JSON found in response (first 200 chars): {cleaned[:200]!r}")

    parsed = json.loads(cleaned)

    # ── If model returned an array, take the first element ───────────────────
    if isinstance(parsed, list):
        if not parsed:
            raise ValueError("Model returned an empty array")
        parsed = parsed[0]

    if not isinstance(parsed, dict):
        raise ValueError(f"Expected JSON object, got {type(parsed).__name__}")

    # ── Validate + normalise required fields ─────────────────────────────────
    required_keys = {
        "vulnerability", "severity", "file", "line",
        "coach_explanation", "what_is_wrong", "why_this_is_insecure",
        "security_impact", "insecure_code_example", "secure_code_fix",
        "why_the_fix_is_secure", "secure_coding_lesson",
    }
    missing = required_keys - set(parsed.keys())
    if missing:
        logger.warning("Coach response missing keys: %s — defaulting", missing)
    for k in missing:
        parsed[k] = "" if k != "secure_code_fix" else {"code": "", "notes": ""}

    if not isinstance(parsed.get("secure_code_fix"), dict):
        parsed["secure_code_fix"] = {"code": str(parsed.get("secure_code_fix", "")), "notes": ""}
    parsed["secure_code_fix"].setdefault("code",  "")
    parsed["secure_code_fix"].setdefault("notes", "")
    parsed.setdefault("endpoint", "")
    parsed.setdefault("cwe",      "")
    parsed.setdefault("inferred", False)

    return parsed


# ── Helper: map coach findings → deep_dive (backward compat) ─────────────────
def _map_to_deep_dive(coach_findings: list[dict], top_findings: list[dict]) -> list[dict]:
    """
    Convert v4 per-finding coach objects into the deep_dive list shape that the
    existing frontend LearningCoachPage expects.  Adds v4 bonus fields as well.
    """
    deep_dive: list[dict] = []
    for i, cf in enumerate(coach_findings):
        # If a slot is None (model returned fewer items), fall back deterministically
        if cf is None:
            if i < len(top_findings):
                cf = _build_coach_fallback([top_findings[i]])[0]
            else:
                continue

        raw_finding  = top_findings[i] if i < len(top_findings) else {}
        finding_id   = (
            raw_finding.get("rule_id") or raw_finding.get("check_id")
            or raw_finding.get("id") or f"finding-{i+1}"
        )
        fix          = cf.get("secure_code_fix") or {}

        deep_dive.append({
            # ── v3 / legacy fields (required by frontend) ─────────────────
            "finding_id":            finding_id,
            "file":                  cf.get("file", ""),
            "line":                  str(cf.get("line", "")),
            "severity":              (cf.get("severity") or "info").lower(),
            "what_happened":         (
                f"{cf.get('what_is_wrong', '')} "
                f"{cf.get('why_this_is_insecure', '')}"
            ).strip(),
            "why_it_matters":        cf.get("security_impact", ""),
            "business_impact":       cf.get("security_impact", ""),
            "secure_example_before": cf.get("insecure_code_example", ""),
            "secure_example_after":  fix.get("code", ""),
            "learning_takeaway": (
                f"{cf.get('why_the_fix_is_secure', '')} "
                f"{cf.get('secure_coding_lesson', '')}"
            ).strip(),
            # ── v4 bonus fields ────────────────────────────────────────────
            "coach_explanation":     cf.get("coach_explanation", ""),
            "what_is_wrong":         cf.get("what_is_wrong", ""),
            "why_this_is_insecure":  cf.get("why_this_is_insecure", ""),
            "why_the_fix_is_secure": cf.get("why_the_fix_is_secure", ""),
            "secure_coding_lesson":  cf.get("secure_coding_lesson", ""),
            "secure_code_fix":       fix,
            "endpoint":              cf.get("endpoint", ""),
            "cwe":                   cf.get("cwe", ""),
            "inferred":              cf.get("inferred", False),
        })
    return deep_dive


# ── Public API ────────────────────────────────────────────────────────────────
def get_ai_insights(
    job_id:               str,
    result_json:          dict | None,
    previous_result_json: dict | None  = None,
    recurring_patterns:   list[dict]   = None,
    behavioral_hints:     list[dict]   = None,
    health_score:         int          = 0,
    score_delta:          int | None   = None,
    force_refresh:        bool         = False,
    risk_momentum:        str          = "stable",
    historical_summary:   dict | None  = None,
    project_name:         str          = "",
) -> dict:
    """
    Return v4 AI mentor insights for a scan result.

    Architecture (v4):
    - Overview fields (learning_summary, behavioral_insights, recurring_patterns,
      priority_roadmap, maturity_explanation, risk_momentum_explanation) are
      always computed deterministically.
    - per-finding coach content (coach_findings[], deep_dive[]) is generated by
      the AI when enabled, or by _build_coach_fallback() otherwise.
    - Results are merged, cached, and returned with source/cached metadata.

    Parameters
    ----------
    job_id               : scan job UUID (for logging + cache namespacing)
    result_json          : current scan result JSON
    previous_result_json : prior scan result JSON (delta context for overview)
    recurring_patterns   : from recurring_weakness.get_recurring_weakness_report()
    behavioral_hints     : from behavioral_insights.generate_behavioral_insights()
    health_score         : v3 formula score (0-100)
    score_delta          : health_score - prev_health_score
    force_refresh        : bypass all caches and regenerate
    risk_momentum        : "increasing" | "decreasing" | "stable"
    historical_summary   : {resolved_categories, new_categories, recurring_categories}
    project_name         : repository name for personalised output

    Returns
    -------
    dict with full v4 schema + coach_findings[] + deep_dive[] + source + cached
    """
    recurring_patterns = recurring_patterns or []
    behavioral_hints   = behavioral_hints   or []

    # ── Sort findings by severity and take top N ───────────────────────────────
    findings   = _get_findings(result_json)
    _sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    top_findings = sorted(
        findings,
        key=lambda f: _sev_order.get((f.get("severity") or "info").lower(), 5),
    )[:_TOP_N_FINDINGS]

    # ── Clean-scan fast path ───────────────────────────────────────────────────
    if not top_findings:
        return {
            "learning_summary":   "No vulnerabilities found — great work! Keep running scans regularly.",
            "behavioral_insights": [],
            "recurring_patterns": [],
            "priority_roadmap":   [],
            "exploit_simulations": [],
            "coach_findings":     [],
            "deep_dive":          [],
            "maturity_explanation": {
                "current_level":  "hardened",
                "reasons":        ["No vulnerabilities detected in this scan"],
                "to_advance":     ["Maintain clean scans and conduct regular threat modelling"],
                "encouragement":  "Outstanding — you're setting the gold standard for secure development!",
            },
            "risk_momentum_explanation": "Your risk profile is at its lowest — no security weaknesses were detected.",
            "source":  "clean",
            "cached":  False,
        }

    # ── Derived scalar context ─────────────────────────────────────────────────
    sev_counts = extract_severity_counts(result_json or {})

    if not health_score:
        health_score = compute_health_score(result_json or {}, sev_counts)

    prev_score: int | None = None
    if previous_result_json:
        prev_sev   = extract_severity_counts(previous_result_json)
        prev_score = compute_health_score(previous_result_json, prev_sev)
    elif score_delta is not None:
        prev_score = health_score - score_delta

    from Learning.maturity_model import get_maturity_level
    maturity_level = get_maturity_level(health_score).get("id", "beginner")

    # ── Cache check ────────────────────────────────────────────────────────────
    cache_key = _context_hash(top_findings, health_score, prev_score or 0)
    if not force_refresh:
        cached = _read_cache(cache_key)
        if cached:
            logger.debug("Cache hit for job %s (key=%s)", job_id, cache_key)
            return {**cached, "cached": True}

    # ── Overview — always deterministic ───────────────────────────────────────
    overview = _build_overview_deterministic(
        top_findings       = top_findings,
        health_score       = health_score,
        prev_score         = prev_score,
        behavioral_hints   = behavioral_hints,
        recurring_patterns = recurring_patterns,
        maturity_level     = maturity_level,
        risk_momentum      = risk_momentum,
    )

    # ── Per-finding coach content — AI or deterministic fallback ──────────────
    source = "deterministic"
    ai_error: str | None = None
    coach_findings: list[dict] = []

    if not AI_ENABLED:
        logger.debug("AI disabled — deterministic coach fallback for job %s", job_id)
        coach_findings = _build_coach_fallback(top_findings, recurring_patterns)
    else:
        # ── Per-finding loop: one AI call per finding ─────────────────────────
        # This prevents cross-finding contamination and produces focused,
        # code-specific coaching instead of generic batch output.
        fallback_all    = _build_coach_fallback(top_findings, recurring_patterns)
        ai_errors:  list[str] = []
        ai_success: int = 0

        for i, finding in enumerate(top_findings):
            try:
                prompt = _build_coach_prompt(
                    finding            = finding,
                    project_name       = project_name,
                    recurring_patterns = recurring_patterns,
                    index              = i,
                )
                result_item = _call_bedrock_coach(prompt)
                coach_findings.append(result_item)
                ai_success += 1
                logger.debug("AI coach OK for finding %d/%d (job %s)", i + 1, len(top_findings), job_id)

            except Exception as exc:
                logger.warning(
                    "AI coach failed for finding %d/%d (job %s): %s — using fallback",
                    i + 1, len(top_findings), job_id, exc,
                )
                coach_findings.append(fallback_all[i])
                ai_errors.append(f"finding {i+1}: {exc}")

        if ai_success > 0:
            source = "ai" if ai_success == len(top_findings) else "ai"
            logger.info(
                "Per-finding AI coach complete: %d/%d AI, %d fallback (job %s, cache_key=%s)",
                ai_success, len(top_findings), len(ai_errors), job_id, cache_key,
            )
        else:
            source = "deterministic"

        if ai_errors:
            ai_error = "; ".join(ai_errors)

    # ── Map coach findings → deep_dive (backward compat with frontend) ─────────
    deep_dive = _map_to_deep_dive(coach_findings, top_findings)

    # ── Assemble final response ────────────────────────────────────────────────
    result: dict = {
        **overview,
        "exploit_simulations": [],   # kept for API compat; unused in v4
        "coach_findings":      coach_findings,
        "deep_dive":           deep_dive,
        "source":              source,
    }
    if ai_error:
        result["ai_error"] = ai_error

    # Cache only successful (non-error) results
    if not ai_error:
        _write_cache(cache_key, result)

    return {**result, "cached": False}
