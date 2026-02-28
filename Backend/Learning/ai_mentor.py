"""
AI Mentor Module — SecureTrail Learning System
===============================================
Integrates with AWS Bedrock Claude Sonnet to produce AI-powered, personalised
learning insights for every scan.

New in v2:
  - Full structured prompt: scan_summary, category distribution, previous scan
    delta, recurring patterns, behavioural signals, maturity context
  - Complete 7-key JSON schema: learning_summary, behavioral_insights,
    recurring_patterns, priority_roadmap, exploit_simulations, deep_dive,
    maturity_explanation
  - Exploit simulation for top 3 critical/high findings
  - 4096 max_tokens, temperature 0.15 for deterministic yet natural output
  - Tight schema validation — falls back gracefully on any schema mismatch
  - Caching keyed on full context hash (not just findings)
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
_TOP_N_EXPLOITS    = 3                  # findings that get full exploit simulation
_MAX_MSG_CHARS     = 300                # truncate finding messages
_AI_MAX_TOKENS     = int(os.getenv("BEDROCK_MAX_TOKENS", "4096"))
_AI_TEMPERATURE    = 0.15

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
) -> dict:
    """
    Rich, deterministic mentorship response using the static category_knowledge
    library.  Returns the SAME schema structure as the AI path.
    """
    recurring_patterns = recurring_patterns or []
    behavioral_hints   = behavioral_hints   or []
    priority_roadmap: list[dict] = []
    exploit_simulations: list[dict] = []
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
        vid       = finding.get("rule_id") or finding.get("id") or "unknown"
        sev       = (finding.get("severity") or "info").lower()

        priority_roadmap.append({
            "rank":     rank,
            "category": cat,
            "reason":   f"Severity: {sev}. {knowledge['plain_explanation'][:150]}",
            "action":   (knowledge.get("checklist") or ["Follow secure coding practices"])[0],
        })

        if rank <= _TOP_N_EXPLOITS:
            exploit_simulations.append({
                "vuln_id":          vid,
                "attacker_goal":    f"Exploit {knowledge['label']} vulnerability in your application",
                "attack_steps":     knowledge.get("attacker_path") or [
                    "Attacker identifies the vulnerable endpoint",
                    "Crafts a malicious payload targeting this weakness",
                    "Exfiltrates data or escalates privileges",
                ],
                "realistic_impact": knowledge["why_it_matters"],
                "estimated_damage": "Potential data exposure, service disruption, or account compromise",
            })

        deep_dive.append({
            "vuln_id":        vid,
            "what_happened":  knowledge["plain_explanation"],
            "business_impact": knowledge["why_it_matters"],
            "secure_pattern": knowledge["secure_pattern"],
            "takeaway": (
                f"Fix this {sev}-severity {knowledge['label']} issue by following "
                "the provided checklist. See: " + ", ".join(knowledge.get("cwe_refs", []))
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
            "category":             r.get("category", ""),
            "observation":          r.get("message", ""),
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
        "Each deep-dive shows you the exact exploit path and a concrete fix."
    )

    return {
        "learning_summary":   headline,
        "behavioral_insights": bi_list,
        "recurring_patterns": rp_list,
        "priority_roadmap":   priority_roadmap,
        "exploit_simulations": exploit_simulations,
        "deep_dive":          deep_dive,
        "maturity_explanation": {
            "current_level":  maturity_level,
            "reasons":        ["Determined by your current health score and finding distribution"],
            "to_advance":     ["Resolve critical and high findings to raise your score"],
            "encouragement":  "Every fix counts. Keep scanning regularly to track your progress.",
        },
        "source": "deterministic",
    }


# ── Prompt builder ────────────────────────────────────────────────────────────
def _build_prompt(
    top_findings:        list[dict],
    health_score:        int,
    prev_score:          int | None,
    category_counts:     dict[str, int],
    sev_counts:          dict[str, int],
    recurring_signals:   list[dict],
    behavioral_signals:  list[dict],
    maturity_level:      str,
) -> str:
    """Compose the full structured prompt for Claude Sonnet."""
    score_delta  = (health_score - prev_score) if prev_score is not None else None
    trend_phrase = (
        f"improved by {score_delta} points from {prev_score}" if (score_delta or 0) > 0
        else f"declined by {abs(score_delta or 0)} points from {prev_score}"  if (score_delta or 0) < 0
        else f"unchanged from previous scan ({prev_score})" if prev_score is not None
        else "first scan (no comparison available)"
    )

    # Findings block — top 5 for analysis
    findings_block = json.dumps(
        [
            {
                "rank":     i + 1,
                "id":       f.get("rule_id") or f.get("id") or "unknown",
                "title":    f.get("title") or f.get("rule_id") or "Unknown finding",
                "severity": (f.get("severity") or "info").lower(),
                "category": classify_finding(f),
                "message":  (f.get("message") or f.get("description") or "")[:_MAX_MSG_CHARS],
                "file":     "/".join(
                    ((f.get("file") or f.get("path") or "").replace("\\","/").split("/"))[-3:]
                ),
            }
            for i, f in enumerate(top_findings)
        ],
        indent=2,
    )

    cat_top = sorted(category_counts.items(), key=lambda x: x[1], reverse=True)[:6]
    cat_block = ", ".join(f"{cat}:{cnt}" for cat, cnt in cat_top)

    rec_block = json.dumps(
        [{"category": r.get("category"), "message": r.get("message"), "streak": r.get("consecutive_streak", 0)}
         for r in recurring_signals[:3]],
        indent=2,
    ) if recurring_signals else "[]"

    beh_block = json.dumps(
        [{"pattern": b.get("pattern_name", b.get("pattern", "")), "habit": b.get("habit")}
         for b in behavioral_signals[:4]],
        indent=2,
    ) if behavioral_signals else "[]"

    schema = """{
  "learning_summary": "<2-3 sentences: personal assessment of THIS developer's security posture, score context, and what to focus on. Use 'you' / 'your' voice. Mention the score and trend.>",
  "behavioral_insights": [
    {
      "pattern":        "<short pattern label>",
      "habit":          "<the developer habit or gap causing this>",
      "recommendation": "<specific, concrete action they can take today>"
    }
  ],
  "recurring_patterns": [
    {
      "category":               "<slug>",
      "observation":            "<what keeps happening>",
      "root_cause_hypothesis":  "<WHY this pattern persists — systemic guess>"
    }
  ],
  "priority_roadmap": [
    {
      "rank":     1,
      "category": "<slug>",
      "reason":   "<why this is #1 priority right now>",
      "action":   "<the exact next thing to do>"
    }
  ],
  "deep_dive": [
    {
      "vuln_id":         "<rule_id from findings>",
      "what_happened":   "<plain explanation of the security flaw and why it exists>",
      "business_impact": "<1-sentence business risk if this is not fixed>",
      "secure_pattern":  "<concrete code pattern or configuration change that fixes it>",
      "takeaway":        "<1-sentence memorable educational lesson>"
    }
  ],
  "maturity_explanation": {
    "current_level":  "<level id>",
    "reasons":        ["<reason 1 why developer is at this level>", "<reason 2>"],
    "to_advance":     ["<action 1 to reach next level>", "<action 2>"],
    "encouragement":  "<1 motivating sentence personalised to where they are>"
  }
}"""

    return f"""You are an expert application security educator and developer coach embedded in SecureTrail, a developer security learning platform.

Your role is to help developers understand their security weaknesses and learn how to write more secure code. Speak directly to the developer using "you" and "your". Be encouraging but precise. Use clear, educational, developer-friendly language.

━━━ SCAN CONTEXT ━━━
Health Score    : {health_score}/100  ({trend_phrase})
Severity Counts : critical={sev_counts.get('critical',0)} high={sev_counts.get('high',0)} medium={sev_counts.get('medium',0)} low={sev_counts.get('low',0)}
Category Distribution : {cat_block}
Current Maturity Level: {maturity_level}

━━━ TOP {len(top_findings)} SECURITY FINDINGS ━━━
{findings_block}

━━━ RECURRING PATTERNS (from scan history) ━━━
{rec_block}

━━━ BEHAVIOURAL SIGNALS (deterministic pre-analysis) ━━━
{beh_block}

━━━ YOUR TASK ━━━
Respond with ONLY a valid JSON object matching this exact schema — no markdown, no preamble, no explanations outside the JSON:

{schema}

Rules:
- learning_summary: must reference the actual score ({health_score}) and trend
- deep_dive: include one entry per finding, in rank order
- priority_roadmap: exactly {min(len(top_findings), 5)} entries, ranked #1 most critical first
- behavioral_insights: 2-4 entries based on category distribution and behavioural signals; derive from categories if no signals provided
- recurring_patterns: include only if there are actual recurring signals; use empty array otherwise
- maturity_explanation.current_level must be exactly: "{maturity_level}"
- All text must be educational, developer-friendly and actionable
- Raw JSON only — the response will be parsed directly by JSON.parse()"""


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

    # exploit_simulations is built deterministically — not requested from AI
    parsed.setdefault("exploit_simulations", [])
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
) -> dict:
    """
    Return AI mentor insights for a scan result.

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

    Returns
    -------
    dict with full v2 schema + 'source' + 'cached' fields
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
                "current_level":  "secure_architect",
                "reasons":        ["No vulnerabilities detected in this scan"],
                "to_advance":     ["Maintain clean scans and conduct regular threat modelling"],
                "encouragement":  "Outstanding — you're setting the gold standard for secure development!",
            },
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
            recurring_patterns, behavioral_hints, maturity_level,
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
        )
        result = _call_bedrock_claude(prompt)
        _write_cache(cache_key, result)
        logger.info("Claude Sonnet insights generated for job %s (cache_key=%s)", job_id, cache_key)
        return {**result, "cached": False}

    except Exception as exc:
        logger.warning("AI call failed for job %s (%s) — deterministic fallback", job_id, exc)
        result = _build_fallback(
            top_findings, health_score, prev_score,
            recurring_patterns, behavioral_hints, maturity_level,
        )
        result["ai_error"] = str(exc)
        # Do NOT cache error results — next request will retry Bedrock
        return {**result, "cached": False}
