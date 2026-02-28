"""
AI Mentor Module — SecureTrail Learning System v3
==================================================
Integrates with AWS Bedrock (Amazon Nova Pro) to produce personalised,
longitudinal security mentoring insights for every scan.

v3 changes:
  - Structured JSON context input (project_name, findings enriched with
    file/line/code_snippet/CWE/CVSS/is_recurring, historical_summary)
  - New output schema: deep_dive items include secure_example_before,
    secure_example_after, learning_takeaway; risk_momentum_explanation field
  - temperature=0.2, max_tokens=3000 for focused, deterministic output
  - Safe educational language only (no "exploit", "attacker", "attack",
    "penetration" — uses misuse risk / unauthorized access / security weakness)
  - Enriched finding fingerprints in cache key
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
    extract_categories_from_result,
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
_MAX_CODE_CHARS    = 300                # truncate code snippets
_AI_MAX_TOKENS     = 3000              # v3: focused output
_AI_TEMPERATURE    = 0.2               # v3: deterministic but natural

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


# ── Deterministic fallback ────────────────────────────────────────────────────
def _build_fallback(
    top_findings:       list[dict],
    health_score:       int = 0,
    prev_score:         int | None = None,
    recurring_patterns: list[dict] | None = None,
    behavioral_hints:   list[dict] | None = None,
    maturity_level:     str = "beginner",
    risk_momentum:      str = "stable",
) -> dict:
    """
    Rich, deterministic mentorship response using the static category_knowledge
    library.  Returns the SAME schema structure as the AI path.
    """
    recurring_patterns = recurring_patterns or []
    behavioral_hints   = behavioral_hints   or []
    priority_roadmap: list[dict] = []
    deep_dive: list[dict] = []

    score_delta = (health_score - prev_score) if prev_score is not None else None
    trend_word  = (
        "improving" if (score_delta or 0) > 5
        else "worsening" if (score_delta or 0) < -5
        else "stable"
    )

    for rank, finding in enumerate(top_findings, 1):
        cat       = classify_finding(finding)
        knowledge = get_knowledge(cat)
        vid       = finding.get("rule_id") or finding.get("id") or f"finding-{rank}"
        sev       = (finding.get("severity") or "info").lower()
        file_path = (finding.get("file") or finding.get("path") or "").replace("\\", "/")
        short_path = "/".join(file_path.split("/")[-3:]) if file_path else "unknown location"
        line_no    = finding.get("line") or finding.get("start_line") or "?"

        priority_roadmap.append({
            "rank":              rank,
            "category":          cat,
            "reason":            f"Severity: {sev}. {knowledge['plain_explanation'][:150]}",
            "action":            (knowledge.get("checklist") or ["Follow secure coding practices"])[0],
            "estimated_time":    "1–4 hours",
            "score_improvement": {"critical": 15, "high": 8, "medium": 3, "low": 1}.get(sev, 0),
        })

        deep_dive.append({
            "finding_id":           vid,
            "what_happened":        knowledge["plain_explanation"],
            "why_it_matters":       knowledge["why_it_matters"],
            "business_impact":      f"This {sev}-severity {knowledge['label']} weakness in {short_path} (line {line_no}) could allow unauthorized access or data exposure if left unaddressed.",
            "secure_example_before": f"# Insecure pattern detected at {short_path}:{line_no}\n# See finding {vid} for details",
            "secure_example_after":  knowledge["secure_pattern"],
            "learning_takeaway":     (
                f"Fix this {sev}-severity {knowledge['label']} issue using the secure pattern above. "
                "Reference: " + ", ".join(knowledge.get("cwe_refs", []))
            ),
        })

    # Build behavioural insights from hints
    bi_list = [
        {
            "pattern":        h.get("pattern_name", h.get("pattern", "")),
            "habit":          h.get("habit", ""),
            "recommendation": h.get("recommendation", ""),
        }
        for h in behavioral_hints[:4]
    ]

    # Build recurring patterns summary
    rp_list = [
        {
            "category":              r.get("category", ""),
            "observation":           r.get("message", ""),
            "root_cause_hypothesis": r.get("suggestion", ""),
        }
        for r in recurring_patterns[:3]
    ]

    # Learning summary
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
        "Each deep-dive shows you the exact security weakness and a concrete fix."
    )

    # Risk momentum explanation
    momentum_map = {
        "increasing":  "Your risk profile is increasing — new or recurring high-severity issues are introducing more exposure. Prioritise immediate remediation.",
        "decreasing":  "Your risk profile is improving — resolved findings have reduced the overall exposure surface. Keep this momentum going.",
        "stable":      "Your risk profile is stable. No significant new security weaknesses were introduced since the last scan.",
    }

    return {
        "learning_summary":    headline,
        "behavioral_insights": bi_list,
        "recurring_patterns":  rp_list,
        "priority_roadmap":    priority_roadmap,
        "exploit_simulations": [],  # removed from v3 AI; kept for API compat
        "deep_dive":           deep_dive,
        "maturity_explanation": {
            "current_level":  maturity_level,
            "reasons":        ["Determined by your current health score and finding distribution"],
            "to_advance":     ["Resolve critical and high findings to raise your score"],
            "encouragement":  "Every fix counts. Keep scanning regularly to track your progress.",
        },
        "risk_momentum_explanation": momentum_map.get(risk_momentum, momentum_map["stable"]),
        "source": "deterministic",
    }


# ── Prompt builder (v3) ───────────────────────────────────────────────────────
def _build_prompt(
    top_findings:        list[dict],
    health_score:        int,
    prev_score:          int | None,
    category_counts:     dict[str, int],
    sev_counts:          dict[str, int],
    recurring_signals:   list[dict],
    behavioral_signals:  list[dict],
    maturity_level:      str,
    risk_momentum:       str = "stable",
    historical_summary:  dict | None = None,
    project_name:        str = "",
) -> str:
    """
    Compose the v3 structured JSON prompt for Nova Pro.
    Uses safe educational language — no 'exploit', 'attacker', 'attack steps',
    'penetration', or 'weaponize' vocabulary.
    """
    # ── Enrich findings with file/line/code/CWE/recurring data ────────────────
    enriched_findings = []
    for i, f in enumerate(top_findings):
        cat      = classify_finding(f)
        knowledge = get_knowledge(cat)
        sev       = (f.get("severity") or "info").lower()
        file_path = (f.get("file") or f.get("path") or "").replace("\\", "/")
        short_path = "/".join(file_path.split("/")[-3:]) if file_path else ""
        line_no   = f.get("line") or f.get("start_line") or ""
        code_raw  = f.get("code") or f.get("code_snippet") or f.get("lines") or ""
        code_snip = str(code_raw)[:_MAX_CODE_CHARS] if code_raw else ""
        cwe_list  = knowledge.get("cwe_refs", [])
        # Check if this category is recurring
        is_recurring_cat = any(r.get("category") == cat for r in recurring_signals)

        enriched_findings.append({
            "id":          f.get("rule_id") or f.get("check_id") or f.get("id") or f"finding-{i+1}",
            "category":    cat,
            "severity":    sev,
            "file":        short_path,
            "line":        str(line_no),
            "code_snippet": code_snip,
            "cwe":         cwe_list[0] if cwe_list else "",
            "is_recurring": is_recurring_cat,
            "message":     (f.get("message") or f.get("description") or "")[:_MAX_MSG_CHARS],
        })

    # ── Historical summary block ───────────────────────────────────────────────
    hist = historical_summary or {}
    hist_block = {
        "previous_health_score":  prev_score,
        "score_delta":            (health_score - prev_score) if prev_score is not None else None,
        "risk_momentum":          risk_momentum,
        "resolved_categories":    hist.get("resolved_categories", []),
        "new_categories":         hist.get("new_categories", []),
        "recurring_categories":   hist.get("recurring_categories", []),
    }

    # ── Behavioural signals block ─────────────────────────────────────────────
    beh_block = [
        {"pattern": b.get("pattern_name", b.get("pattern", "")), "habit": b.get("habit", "")}
        for b in behavioral_signals[:4]
    ]

    # ── Full structured context JSON ──────────────────────────────────────────
    context = {
        "project_name":      project_name or "your repository",
        "current_health_score": health_score,
        "maturity_level":    maturity_level,
        "severity_counts":   {
            "critical": sev_counts.get("critical", 0),
            "high":     sev_counts.get("high", 0),
            "medium":   sev_counts.get("medium", 0),
            "low":      sev_counts.get("low", 0),
        },
        "findings":          enriched_findings,
        "historical_summary": hist_block,
        "behavioral_signals": beh_block,
    }
    context_json = json.dumps(context, indent=2)

    # ── Output schema ──────────────────────────────────────────────────────────
    schema = """{
  "learning_summary": "<2-3 sentences: personal assessment of THIS developer's security posture and what to focus on. Use 'you'/'your'. Mention score and trend. No offensive terminology.>",
  "behavioral_insights": [
    {
      "pattern":        "<short label, e.g. 'Hardcoded Secrets'>",
      "habit":          "<the developer habit or systemic gap causing this pattern>",
      "recommendation": "<specific concrete action they can take today>"
    }
  ],
  "recurring_patterns": [
    {
      "category":               "<category slug>",
      "observation":            "<what keeps appearing across scans>",
      "root_cause_hypothesis":  "<WHY this pattern persists — systemic guess>"
    }
  ],
  "priority_roadmap": [
    {
      "rank":              1,
      "category":          "<category slug>",
      "reason":            "<why this is #1 priority right now, referencing severity and file if known>",
      "action":            "<the single most important next step>",
      "estimated_time":    "<e.g. '2 hours' or '1 day'>",
      "score_improvement": <integer points gained if this category is fully resolved>
    }
  ],
  "deep_dive": [
    {
      "finding_id":            "<id from findings input>",
      "what_happened":         "<plain explanation of the security weakness and why it exists in this code>",
      "why_it_matters":        "<the security consequence if this weakness is present>",
      "business_impact":       "<1-sentence business risk if unresolved — use: data exposure, unauthorized access, service disruption>",
      "secure_example_before": "<short pseudocode or pattern showing the insecure pattern>",
      "secure_example_after":  "<short pseudocode or pattern showing the correct, secure replacement>",
      "learning_takeaway":     "<1-sentence memorable educational lesson the developer should internalise>"
    }
  ],
  "maturity_explanation": {
    "current_level":  "<must match the maturity_level in the input context>",
    "reasons":        ["<reason 1 why the developer is at this level>", "<reason 2>"],
    "to_advance":     ["<concrete action 1 to reach next level>", "<concrete action 2>"],
    "encouragement":  "<1 sentence of genuine encouragement personalised to where they are>"
  },
  "risk_momentum_explanation": "<1-2 sentences explaining whether risk is increasing, decreasing, or stable, and why, based on the historical_summary data>"
}"""

    return f"""You are a senior application security educator embedded in SecureTrail, a developer security learning platform.

Your role: Help developers understand their security weaknesses and learn to write more secure code.
Speak directly as "you" / "your". Be encouraging, precise, and constructive.
Use ONLY educational, professional language. Do NOT use the words: exploit, attacker, attack steps, penetration, weaponize.
Instead use: misuse risk, unauthorized access, exposure risk, unintended access path, security weakness.

━━━ SCAN CONTEXT (JSON) ━━━
{context_json}

━━━ YOUR TASK ━━━
Analyse the JSON context above and respond with ONLY a valid JSON object matching this exact schema.
No markdown, no preamble, no explanations outside the JSON:

{schema}

Rules:
- learning_summary must reference the actual score ({health_score}) and trend (risk_momentum: {risk_momentum})
- deep_dive: one entry per finding in the input (maintain same id)
- priority_roadmap: exactly {min(len(top_findings), 5)} entries, rank #1 = highest priority
- behavioral_insights: 2-4 entries derived from behavioral_signals and category distribution
- recurring_patterns: include only if historical_summary shows recurring categories; empty array otherwise
- maturity_explanation.current_level must be exactly: "{maturity_level}"
- score_improvement in roadmap must equal the linear pts gained: critical=15, high=8, medium=3, low=1
- All language must be educational, developer-friendly, and free of offensive security terminology
- Output raw JSON only — it will be parsed directly"""


# ── Bedrock integration ───────────────────────────────────────────────────────
def _call_bedrock_claude(prompt: str) -> dict:
    """
    Invoke Claude Sonnet via `invoke_claude()` in Engines.ai.bedrock_client.
    Returns parsed and validated dict.
    """
    from Engines.ai.bedrock_client import invoke_claude  # lazy import

    system_prompt = (
        "You are a senior application security educator embedded in a developer learning platform. "
        "Your role is to help developers understand, learn from, and fix security weaknesses discovered by static analysis. "
        "You respond with raw JSON only — no markdown, no extra text, no code fences."
    )

    response_text = invoke_claude(
        system_prompt=system_prompt,
        user_message=prompt,
        temperature=_AI_TEMPERATURE,
        max_tokens=_AI_MAX_TOKENS,
    )

    # Strip any accidental markdown fences
    cleaned = response_text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        start = 1
        end   = len(lines) - 1 if lines[-1].strip() == "```" else len(lines)
        cleaned = "\n".join(lines[start:end])

    # If the model wrapped JSON in preamble text, extract the outermost JSON object
    if cleaned and cleaned[0] not in ('{', '['):
        import re as _re
        m = _re.search(r'\{.*\}', cleaned, _re.DOTALL)
        if m:
            cleaned = m.group(0)
        else:
            raise ValueError(f"Response is not JSON (first 200 chars): {cleaned[:200]!r}")

    if not cleaned:
        raise ValueError("Bedrock returned empty response text")

    parsed: dict = json.loads(cleaned)

    # ── Schema validation ──────────────────────────────────────────────────
    required_keys = {
        "learning_summary", "behavioral_insights", "recurring_patterns",
        "priority_roadmap", "deep_dive", "maturity_explanation",
        "risk_momentum_explanation",
    }
    missing = required_keys - set(parsed.keys())
    if missing:
        raise ValueError(f"AI response missing keys: {missing}")

    # Ensure lists are lists
    for list_key in ("behavioral_insights", "recurring_patterns", "priority_roadmap", "deep_dive"):
        if not isinstance(parsed.get(list_key), list):
            parsed[list_key] = []

    if not isinstance(parsed.get("maturity_explanation"), dict):
        parsed["maturity_explanation"] = {}

    # Normalise deep_dive items to v3 schema (backward compat with partial responses)
    for item in parsed.get("deep_dive", []):
        item.setdefault("finding_id",            item.pop("vuln_id", ""))
        item.setdefault("why_it_matters",         item.pop("business_impact", ""))
        item.setdefault("secure_example_before",  item.pop("secure_pattern", ""))
        item.setdefault("secure_example_after",   "")
        item.setdefault("learning_takeaway",       item.pop("takeaway", ""))
        item.setdefault("business_impact",         "")

    # exploit_simulations not requested from AI — kept in response for API compat
    parsed.setdefault("exploit_simulations", [])
    if not isinstance(parsed.get("risk_momentum_explanation"), str):
        parsed["risk_momentum_explanation"] = ""
    parsed["source"] = "ai"
    return parsed


# ── Public API ────────────────────────────────────────────────────────────────
def get_ai_insights(
    job_id:              str,
    result_json:         dict | None,
    previous_result_json: dict | None   = None,
    recurring_patterns:  list[dict]     = None,
    behavioral_hints:    list[dict]     = None,
    health_score:        int            = 0,
    score_delta:         int | None     = None,
    force_refresh:       bool           = False,
    risk_momentum:       str            = "stable",
    historical_summary:  dict | None    = None,
    project_name:        str            = "",
) -> dict:
    """
    Return v3 AI mentor insights for a scan result.

    Parameters
    ----------
    job_id               : scan job UUID (logging only)
    result_json          : current scan result JSON
    previous_result_json : prior scan result JSON (for delta context)
    recurring_patterns   : output of recurring_weakness.get_recurring_weakness_report()
    behavioral_hints     : output of behavioral_insights.generate_behavioral_insights()
    health_score         : computed from learning_engine.compute_health_score()
    score_delta          : health_score - prev_health_score
    force_refresh        : bypass cache
    risk_momentum        : "increasing" | "decreasing" | "stable" from historical_comparison
    historical_summary   : {resolved_categories, new_categories, recurring_categories}
    project_name         : repository/project name for personalised output

    Returns
    -------
    dict with full v3 schema + 'source' + 'cached' fields
    """
    recurring_patterns = recurring_patterns or []
    behavioral_hints   = behavioral_hints   or []

    findings = _get_findings(result_json)
    _sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    top_findings = sorted(
        findings,
        key=lambda f: _sev_order.get((f.get("severity") or "info").lower(), 5),
    )[:_TOP_N_FINDINGS]

    if not top_findings:
        return {
            "learning_summary":   "No vulnerabilities found — great work! Keep running scans regularly.",
            "behavioral_insights": [],
            "recurring_patterns": [],
            "priority_roadmap":   [],
            "exploit_simulations": [],
            "deep_dive":          [],
            "maturity_explanation": {
                "current_level":  "hardened",
                "reasons":        ["No vulnerabilities detected in this scan"],
                "to_advance":     ["Maintain clean scans and conduct regular threat modelling"],
                "encouragement":  "Outstanding — you're setting the gold standard for secure development!",
            },
            "risk_momentum_explanation": "Your risk profile is at its lowest — no security weaknesses were detected.",
            "source": "clean",
            "cached": False,
        }

    # ── Derived context ────────────────────────────────────────────────────────
    sev_counts      = extract_severity_counts(result_json or {})
    category_counts = extract_categories_from_result(result_json or {})

    if not health_score:
        health_score = compute_health_score(result_json or {}, sev_counts)

    prev_score: int | None = None
    if previous_result_json:
        prev_sev  = extract_severity_counts(previous_result_json)
        prev_score = compute_health_score(previous_result_json, prev_sev)
    elif score_delta is not None:
        prev_score = health_score - score_delta

    # Determine maturity level string
    from Learning.maturity_model import get_maturity_level
    maturity_level = get_maturity_level(health_score).get("id", "beginner")

    # ── Cache key ──────────────────────────────────────────────────────────────
    cache_key = _context_hash(top_findings, health_score, prev_score or 0)

    if not force_refresh:
        cached = _read_cache(cache_key)
        if cached:
            logger.debug("Cache hit for job %s (key=%s)", job_id, cache_key)
            return {**cached, "cached": True}

    # ── AI disabled  ───────────────────────────────────────────────────────────
    if not AI_ENABLED:
        logger.debug("AI disabled — deterministic fallback for job %s", job_id)
        result = _build_fallback(
            top_findings, health_score, prev_score,
            recurring_patterns, behavioral_hints, maturity_level, risk_momentum,
        )
        _write_cache(cache_key, result)
        return {**result, "cached": False}

    # ── Bedrock call ───────────────────────────────────────────────────────────
    try:
        prompt = _build_prompt(
            top_findings        = top_findings,
            health_score        = health_score,
            prev_score          = prev_score,
            category_counts     = category_counts,
            sev_counts          = sev_counts,
            recurring_signals   = recurring_patterns,
            behavioral_signals  = behavioral_hints,
            maturity_level      = maturity_level,
            risk_momentum       = risk_momentum,
            historical_summary  = historical_summary,
            project_name        = project_name,
        )
        result = _call_bedrock_claude(prompt)
        _write_cache(cache_key, result)
        logger.info("Nova Pro insights generated for job %s (cache_key=%s)", job_id, cache_key)
        return {**result, "cached": False}

    except Exception as exc:
        logger.warning("AI call failed for job %s (%s) — deterministic fallback", job_id, exc)
        result = _build_fallback(
            top_findings, health_score, prev_score,
            recurring_patterns, behavioral_hints, maturity_level, risk_momentum,
        )
        result["ai_error"] = str(exc)
        # Do NOT cache error results — next request will retry Bedrock
        return {**result, "cached": False}
