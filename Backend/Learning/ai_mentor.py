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

# ── v4 coach system prompt ────────────────────────────────────────────────────
_COACH_SYSTEM_PROMPT = (
    "You are the SecureTrail AI Coach. Act as a senior security mentor reviewing a developer's code: "
    "concise, constructive, and focused on teaching. Speak directly to the developer using 'you' and "
    "'your code'. Your primary job is to teach — explain the exact mistake in the provided code, why it "
    "is insecure, the real risk, and provide a copy-paste ready secure fix in the same language. "
    "Do NOT output generic textbook definitions or category-level guidance. Always tie your explanation "
    "to the specific file/line/snippet given.\n\n"

    "Tone & safety rules:\n"
    "• Be educational and encouraging — act like a code-review comment from a senior engineer.\n"
    "• Avoid offensive or exploit language. Do NOT use the words: 'exploit', 'attack steps', "
    "'weaponize', 'penetration'. Use safe alternatives: 'unauthorized access', 'exposure risk', "
    "'misuse risk', 'unintended access'.\n"
    "• If the snippet is incomplete, you MAY infer reasonable surrounding context — but set "
    "'inferred': true and explain the inference briefly in 'why_this_is_insecure' or "
    "'secure_code_fix.notes'.\n"
    "• Keep answers concise and practical — focused on immediate developer action and learning.\n\n"

    "Primary objective (for each finding):\n"
    "1. Identify the exact issue in the provided snippet.\n"
    "2. Explain why that code is insecure (logic/flow reason — non-actionable).\n"
    "3. Describe the likely security impact (business/developer-relevant).\n"
    "4. Show the insecure code snippet as provided; if truncated mark inference.\n"
    "5. Provide a complete, working secure code fix in the same language and style (copy-paste ready).\n"
    "6. Explain why the fix is secure (what changed, why it prevents the issue).\n"
    "7. Give one short memorable secure-coding lesson the developer should keep.\n\n"

    "Behavioral & quality rules:\n"
    "• If given N findings, produce exactly N separate objects (no grouping).\n"
    "• Keep coach_explanation 1–2 sentences; other explanation fields short (1–3 sentences).\n"
    "• secure_code_fix.code must be runnable code (no pseudocode) unless impossible — then supply a "
    "minimal clear pseudo-fix and set inferred:true with full notes on what is missing.\n"
    "• Language fidelity: produce fixes in the same language/style as the insecure snippet (use file "
    "extension to infer language if snippet is missing).\n"
    "• Be deterministic and conservative (temperature ≈ 0.2).\n"
    "• Do NOT alter or mention gamification/XP fields.\n"
    "• If a snippet references functions/objects not shown, use the same naming and explain in notes "
    "that these are assumed to exist.\n\n"

    "Fallback behavior: if you cannot offer a secure runnable fix due to missing critical context, "
    "return the schema with secure_code_fix.code = minimal explicit pseudo-fix (clearly marked), "
    "secure_code_fix.notes = what is missing and exact actions the developer must take, inferred = true.\n\n"

    "STRICT OUTPUT CONTRACT — return ONLY valid JSON (raw array, no markdown, no code fences, no "
    "preamble). Every field in the schema is required; use empty string for optional absent text. "
    "Schema per finding:\n"
    '{"vulnerability":"<short name>","severity":"<CRITICAL|HIGH|MEDIUM|LOW>","file":"<repo-relative path>",'
    '"line":"<line or range>","endpoint":"<endpoint or empty>","cwe":"<CWE id or empty>",'
    '"coach_explanation":"<1-2 sentence mentor summary using you/your code>",'
    '"what_is_wrong":"<exact mistake in the code>","why_this_is_insecure":"<logic/flow reason; mention inference if any>",'
    '"security_impact":"<business/technical risk>","insecure_code_example":"<exact vulnerable snippet; add SNIPPET_TRUNCATED and set inferred:true if truncated>",'
    '"secure_code_fix":{"code":"<complete corrected code, same language, paste-ready>","notes":"<imports/config notes or inference notes>"},'
    '"why_the_fix_is_secure":"<what changed and why it prevents the issue>",'
    '"secure_coding_lesson":"<single short memorable sentence>","inferred":<true|false>}'
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

        coach_findings.append({
            "vulnerability":        knowledge.get("label", cat),
            "severity":             sev.upper(),
            "file":                 short_path,
            "line":                 str(line_no),
            "endpoint":             endpoint,
            "cwe":                  cwe_list[0] if cwe_list else "",
            "coach_explanation": (
                f"Your code has a {sev}-severity {knowledge.get('label', cat)} weakness at "
                f"{short_path} (line {line_no}). "
                f"{knowledge['plain_explanation'][:180]}"
            ),
            "what_is_wrong": (
                f"{'[RECURRING] ' if is_recurring else ''}"
                f"{knowledge['plain_explanation'][:220]}"
            ),
            "why_this_is_insecure": knowledge["why_it_matters"],
            "security_impact": (
                f"This {sev}-severity weakness in {short_path} (line {line_no}) "
                f"could allow {knowledge.get('impact_summary', 'unauthorized access or data exposure')} "
                f"if left unaddressed. Resolving it improves your score by {sev_pts} points."
            ),
            "insecure_code_example": code_snip or f"# Insecure pattern detected at {short_path}:{line_no}\n# See finding {vid} for details",
            "secure_code_fix": {
                "code":  knowledge["secure_pattern"],
                "notes": (
                    "Replace the flagged pattern with the secure version above. "
                    + (f"References: {', '.join(cwe_list)}" if cwe_list else "")
                ),
            },
            "why_the_fix_is_secure": (
                f"The secure pattern eliminates the {knowledge.get('label', cat)} weakness "
                "by enforcing proper validation and safe API usage, removing the unintended access path."
            ),
            "secure_coding_lesson": (knowledge.get("checklist") or ["Follow secure coding practices"])[0],
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


# ── Coach prompt builder (v4) ─────────────────────────────────────────────────
def _build_coach_prompt(
    top_findings:       list[dict],
    project_name:       str = "",
    recurring_patterns: list[dict] | None = None,
) -> str:
    """
    Build the v4 per-finding coach prompt.

    Sends an array of enriched finding objects and a strict output schema.
    The model must return a JSON array — one coach object per finding in the input.
    """
    recurring_patterns = recurring_patterns or []

    # ── Enrich each finding with file/line/code/CWE/vuln_type/recurring ───────
    input_findings: list[dict] = []
    for i, f in enumerate(top_findings):
        cat       = classify_finding(f)
        knowledge = get_knowledge(cat)
        sev       = (f.get("severity") or "info").lower()
        file_path = (f.get("file") or f.get("path") or "").replace("\\", "/")
        short_path = "/".join(file_path.split("/")[-3:]) if file_path else ""
        line_no   = f.get("line") or f.get("start_line") or ""
        code_raw  = f.get("code") or f.get("code_snippet") or f.get("lines") or ""
        code_snip = str(code_raw)[:_MAX_CODE_CHARS] if code_raw else ""
        cwe_list  = knowledge.get("cwe_refs", [])
        endpoint  = f.get("endpoint") or f.get("check_id") or ""
        is_rec    = any(r.get("category") == cat for r in recurring_patterns)

        input_findings.append({
            "project_name":      project_name or "your repository",
            "file":              short_path,
            "line":              line_no,
            "severity":          sev.upper(),
            "vulnerability_type": knowledge.get("label", cat),
            "endpoint":          endpoint,
            "cwe":               cwe_list[0] if cwe_list else "",
            "message": (f.get("message") or f.get("description") or "")[:_MAX_MSG_CHARS],
            "code_snippet":      code_snip,
            "is_recurring":      is_rec,
        })

    input_json = json.dumps(input_findings, indent=2)
    n = len(input_findings)

    # ── Output schema (one entry per finding) ─────────────────────────────────
    schema = """[
  {
    "vulnerability": "<short vulnerability name>",
    "severity": "<CRITICAL|HIGH|MEDIUM|LOW>",
    "file": "<path from input>",
    "line": "<line number or range from input>",
    "endpoint": "<endpoint from input, or empty string if not applicable>",
    "cwe": "<CWE id from input, or empty string>",
    "coach_explanation": "<1-2 sentence mentor summary — speak directly to the developer using 'you'/'your code', referencing the specific file and line>",
    "what_is_wrong": "<1-2 sentences identifying the exact mistake in the developer's code — specific, not generic>",
    "why_this_is_insecure": "<1-3 sentences: explain the logic/flow reason this code is insecure; reference the code_snippet if present>",
    "security_impact": "<1-2 sentences: business/technical risk if this weakness is unaddressed — use: unauthorized access, exposure risk, misuse risk, unintended access>",
    "insecure_code_example": "<the exact code_snippet from input, or infer a minimal example if snippet missing; set inferred=true if inferred>",
    "secure_code_fix": {
      "code": "<complete corrected code block in the same language — copy-paste ready, not pseudocode>",
      "notes": "<any required imports, config changes, or assumptions made>"
    },
    "why_the_fix_is_secure": "<1-2 sentences: what changed and why it prevents the weakness>",
    "secure_coding_lesson": "<one short memorable sentence the developer should remember>",
    "inferred": <true if you inferred missing context from the snippet, false if exact snippet was provided>
  }
]"""

    return f"""You are the SecureTrail AI Coach — a senior security mentor reviewing a developer's code.

PRIMARY OBJECTIVE: For each finding below, produce a focused coaching response that:
1) identifies the exact mistake in the developer's code
2) explains why that specific code is insecure (logic/flow reason)
3) describes the likely security impact (business/developer-relevant)
4) shows the insecure code snippet (as provided or inferred)
5) provides an actionable secure code fix in the SAME language (real, copy-paste ready)
6) explains why the fix is secure (what changed, why it prevents the issue)
7) gives one short secure-coding lesson the developer should remember

RULES:
- Speak directly to the developer: use "you" and "your code"
- Do NOT produce generic textbook definitions — tie every explanation to the provided code_snippet
- NEVER use: exploit, weaponize, attack steps, penetration — use instead: unauthorized access, exposure risk, misuse risk, unintended access
- secure_code_fix.code must be real working code in the same language (inferred from file extension or snippet)
- If code_snippet is missing or truncated, infer context from file/vulnerability_type and set inferred=true
- Return exactly {n} entries in the array — one per finding, in the same order as the input
- Output raw JSON array only — no markdown, no preamble, no code fences

━━━ FINDINGS INPUT ({n} items) ━━━
{input_json}

━━━ YOUR TASK ━━━
Return ONLY a valid JSON array of exactly {n} objects matching this schema:
{schema}"""


# ── Bedrock integration (v4 — returns list[dict]) ────────────────────────────
def _call_bedrock_coach(prompt: str, expected_count: int) -> list[dict]:
    """
    Invoke the configured Bedrock model via bedrock_client.invoke_claude().
    Parses the expected JSON array response (one coach object per finding).
    Validates each item against the v4 coach schema.
    Returns a validated list[dict].
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

    # ── Extract outermost JSON array ──────────────────────────────────────────
    if cleaned and cleaned[0] not in ("[", "{"):
        import re as _re
        m = _re.search(r"\[.*\]", cleaned, _re.DOTALL)
        if m:
            cleaned = m.group(0)
        else:
            raise ValueError(f"Response is not a JSON array (first 200 chars): {cleaned[:200]!r}")

    if not cleaned:
        raise ValueError("Bedrock returned empty response text")

    parsed = json.loads(cleaned)

    # ── Handle case where model returned a single object instead of array ─────
    if isinstance(parsed, dict):
        # Could be a single-item array wrapped in an object, or just one item
        if "coach_findings" in parsed:
            parsed = parsed["coach_findings"]
        else:
            parsed = [parsed]

    if not isinstance(parsed, list):
        raise ValueError(f"Expected JSON array, got {type(parsed).__name__}")

    # ── Validate + normalize each coach item ──────────────────────────────────
    required_item_keys = {
        "vulnerability", "severity", "file", "line",
        "coach_explanation", "what_is_wrong", "why_this_is_insecure",
        "security_impact", "insecure_code_example", "secure_code_fix",
        "why_the_fix_is_secure", "secure_coding_lesson",
    }

    normalized: list[dict] = []
    for idx, item in enumerate(parsed):
        if not isinstance(item, dict):
            logger.warning("Coach item %d is not a dict — skipping", idx)
            continue

        # Fill missing required keys with safe defaults
        missing = required_item_keys - set(item.keys())
        if missing:
            logger.warning("Coach item %d missing keys: %s — defaulting", idx, missing)
        for k in missing:
            item[k] = "" if k != "secure_code_fix" else {"code": "", "notes": ""}

        # Ensure secure_code_fix is a dict
        if not isinstance(item.get("secure_code_fix"), dict):
            item["secure_code_fix"] = {"code": str(item.get("secure_code_fix", "")), "notes": ""}
        item["secure_code_fix"].setdefault("code",  "")
        item["secure_code_fix"].setdefault("notes", "")

        item.setdefault("endpoint", "")
        item.setdefault("cwe",      "")
        item.setdefault("inferred", False)

        normalized.append(item)

    # If model returned fewer items than expected, pad with None markers
    # (get_ai_insights will fall back to deterministic for missing indices)
    if len(normalized) < expected_count:
        logger.warning(
            "Coach response has %d items, expected %d — padding with None",
            len(normalized), expected_count,
        )
        normalized.extend([None] * (expected_count - len(normalized)))  # type: ignore[list-item]

    return normalized


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
        try:
            prompt = _build_coach_prompt(
                top_findings       = top_findings,
                project_name       = project_name,
                recurring_patterns = recurring_patterns,
            )
            coach_findings = _call_bedrock_coach(prompt, expected_count=len(top_findings))

            # Replace any None-padded slots with deterministic fallback
            fallback_all = _build_coach_fallback(top_findings, recurring_patterns)
            coach_findings = [
                cf if cf is not None else fallback_all[i]
                for i, cf in enumerate(coach_findings)
            ]
            source = "ai"
            logger.info("Coach insights generated by AI for job %s (cache_key=%s)", job_id, cache_key)

        except Exception as exc:
            logger.warning("AI call failed for job %s (%s) — deterministic coach fallback", job_id, exc)
            coach_findings = _build_coach_fallback(top_findings, recurring_patterns)
            ai_error       = str(exc)

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
