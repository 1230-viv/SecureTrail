"""
Longitudinal AI Reasoning — SecureTrail Learning System v3
===========================================================
Calls Bedrock with context spanning the last 3 scans to produce a
behavioral pattern summary, security drift detection, improvement trajectory,
and 30-day advice.

Architecture constraints:
  - All scoring math stays in Python (deterministic). AI provides TEXT only.
  - Output must be structured JSON (validated by response_validator).
  - Temperature: 0.2 for focused output.
  - No exploit / attack language.
  - Prompt format versioned as LONGITUDINAL_PROMPT_V1.

Expected JSON output schema:
  {
    "behavioral_summary":      str,   (150 words max)
    "security_drift":          str,   ("improving" | "stable" | "degrading")
    "drift_explanation":       str,   (1-2 sentences)
    "top_recurring_habit":     str,   (most entrenched habit name)
    "improvement_trajectory":  str,   (what the developer is getting better at)
    "thirty_day_advice":       list[str],  (3-5 concrete action items)
    "focus_domain":            str,   (skill domain to focus on next)
  }
"""

from __future__ import annotations

import os
from typing import Any

from Utils.logger import get_logger

logger = get_logger("longitudinal_ai")

AI_ENABLED: bool = os.getenv("AI_ENABLED", "false").lower() == "true"
LONGITUDINAL_PROMPT_V = "v1"

# ── Deterministic drift calculation ──────────────────────────────────────────

def _compute_drift(health_scores: list[int]) -> str:
    """Classify security drift from last N health scores."""
    if len(health_scores) < 2:
        return "stable"
    recent = health_scores[-1]
    earlier = health_scores[0]
    delta = recent - earlier
    if delta >= 5:
        return "improving"
    if delta <= -5:
        return "degrading"
    return "stable"


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_longitudinal_prompt(
    scan_summaries: list[dict],
    recurring_categories: list[str],
    resolved_categories: list[str],
    regression_categories: list[str],
    repo_name: str,
    top_habit: str,
) -> str:
    """Build the longitudinal prompt for Bedrock."""
    # Format scan summaries
    scan_lines = []
    for i, s in enumerate(scan_summaries[-3:]):
        health = s.get("health_score", "?")
        cats   = ", ".join(s.get("categories", [])[:5]) or "none"
        date   = s.get("date", f"scan {i+1}")
        scan_lines.append(f"  Scan {i+1} ({date}): health={health}/100, categories=[{cats}]")

    summary_block = "\n".join(scan_lines) or "  No scan history available."
    recurring_str = ", ".join(recurring_categories[:5]) or "none"
    resolved_str  = ", ".join(resolved_categories[:5]) or "none"
    regression_str = ", ".join(regression_categories[:5]) or "none"

    return (
        f"You are a senior security coach analyzing longitudinal scan data for "
        f"the developer working on repository '{repo_name}'.\n\n"
        f"SCAN HISTORY (last 3 scans, oldest to newest):\n{summary_block}\n\n"
        f"RECURRING vulnerability categories (present in multiple scans): {recurring_str}\n"
        f"RECENTLY RESOLVED categories (fixed in latest scan): {resolved_str}\n"
        f"REGRESSION categories (new issues since last scan): {regression_str}\n"
        f"MOST PERSISTENT habit pattern: {top_habit or 'unknown'}\n\n"
        f"Based on this data, generate a coaching report as a single JSON object "
        f"with EXACTLY these keys (no markdown, no extra text):\n"
        f"{{\n"
        f'  "behavioral_summary": "<150 words max: developer\'s security behavior pattern>",\n'
        f'  "security_drift": "<one of: improving | stable | degrading>",\n'
        f'  "drift_explanation": "<1-2 sentences explaining the drift>",\n'
        f'  "top_recurring_habit": "<name of the most persistent security habit to address>",\n'
        f'  "improvement_trajectory": "<what the developer is demonstrably getting better at>",\n'
        f'  "thirty_day_advice": ["<action 1>", "<action 2>", "<action 3>"],\n'
        f'  "focus_domain": "<one of: auth_authz | secrets | api_protection | input_validation | dependency | secure_arch>"\n'
        f"}}\n\n"
        f"Rules:\n"
        f"- Use professional, encouraging language only\n"
        f"- Replace 'attacker' with 'unauthorised actor'\n"
        f"- Replace 'exploit' with 'security weakness'\n"
        f"- Replace 'penetration' with 'security evaluation'\n"
        f"- Never give procedural misuse instructions\n"
        f"- thirty_day_advice must contain 3-5 concrete, implementable actions\n"
        f"- Prompt version: longitudinal-{LONGITUDINAL_PROMPT_V}"
    )


# ── Deterministic fallback ────────────────────────────────────────────────────

def _deterministic_longitudinal(
    scan_summaries: list[dict],
    recurring_categories: list[str],
    resolved_categories: list[str],
    regression_categories: list[str],
    top_habit: str,
) -> dict:
    """Generate a deterministic fallback when AI is unavailable."""
    health_scores = [s.get("health_score", 50) for s in scan_summaries]
    drift = _compute_drift(health_scores)

    if drift == "improving":
        summary = (
            "Your security posture has steadily improved across recent scans. "
            "You are resolving findings faster than new ones appear, which is an excellent trend. "
            f"{'The recurring ' + top_habit + ' pattern remains the primary area to address.' if top_habit else 'Keep up the momentum.'}"
        )
        trajectory = "Resolving findings consistently across scans"
        drift_explanation = (
            f"Health score increased from {health_scores[0]} to {health_scores[-1]}, "
            "indicating net reduction in security technical debt."
        )
    elif drift == "degrading":
        summary = (
            "New security findings are accumulating faster than they are being resolved. "
            f"{'The ' + top_habit + ' pattern is a key contributor.' if top_habit else ''} "
            "Prioritise the highest-severity categories in the roadmap."
        )
        trajectory = "Not yet consistent — focus on one category at a time"
        drift_explanation = (
            f"Health score declined from {health_scores[0]} to {health_scores[-1]}, "
            "suggesting new areas of technical debt are being introduced."
        )
    else:
        summary = (
            "Your security posture is holding steady. "
            f"{'The ' + top_habit + ' pattern has been present across multiple scans.' if top_habit else ''} "
            "A targeted push on the priority roadmap will move the needle."
        )
        trajectory = "Maintaining baseline — ready to improve with focused effort"
        drift_explanation = "Health score is stable. No significant increase or decrease detected."

    advice = []
    if recurring_categories:
        advice.append(f"Address the recurring '{recurring_categories[0]}' category in your next sprint.")
    if regression_categories:
        advice.append(f"Investigate the new '{regression_categories[0]}' findings that appeared in the latest scan.")
    if resolved_categories:
        advice.append(f"Write regression tests to ensure '{resolved_categories[0]}' does not reappear.")
    advice.append("Add a pre-commit hook to catch common issues before they reach CI.")
    advice.append("Schedule a 30-minute security review at the start of each sprint.")

    return {
        "behavioral_summary":     summary,
        "security_drift":         drift,
        "drift_explanation":      drift_explanation,
        "top_recurring_habit":    top_habit or "Review the priority roadmap",
        "improvement_trajectory": trajectory,
        "thirty_day_advice":      advice[:5],
        "focus_domain":           "input_validation",
        "_source":                "deterministic",
    }


# ── Public API ────────────────────────────────────────────────────────────────

def get_longitudinal_analysis(
    scan_summaries: list[dict],
    recurring_categories: list[str],
    resolved_categories: list[str],
    regression_categories: list[str],
    top_habit: str,
    repo_name: str,
) -> dict[str, Any]:
    """
    Generate a longitudinal coaching analysis.

    Parameters
    ----------
    scan_summaries         : list of {"health_score": int, "categories": list, "date": str}
                             OLDEST first, max 3 used
    recurring_categories   : category slugs seen in multiple scans
    resolved_categories    : category slugs fixed in latest scan
    regression_categories  : category slugs that are new since last scan
    top_habit              : name of most-persistent behavioral habit
    repo_name              : repository name

    Returns
    -------
    Structured analysis dict (see module docstring schema).
    """
    deterministic_fallback = _deterministic_longitudinal(
        scan_summaries, recurring_categories,
        resolved_categories, regression_categories, top_habit,
    )

    if not AI_ENABLED:
        return deterministic_fallback

    try:
        from Engines.ai.bedrock_client import invoke_chat
        from Engines.ai.response_validator import safe_ai_call

        system = (
            "You are a senior application security coach embedded in SecureTrail. "
            "Your responses must be valid JSON objects only — no prose, no markdown. "
            "Be encouraging, educational, and strictly professional. "
            "Never include procedural misuse instructions, payload examples, or "
            "step-by-step techniques that could cause harm."
        )

        prompt = _build_longitudinal_prompt(
            scan_summaries, recurring_categories,
            resolved_categories, regression_categories,
            repo_name, top_habit,
        )

        result = safe_ai_call(
            call_fn=lambda: invoke_chat(
                [{"role": "user", "content": prompt}],
                system_prompt=system,
                temperature=0.2,
                max_tokens=1200,
            ),
            required_keys=[
                "behavioral_summary",
                "security_drift",
                "thirty_day_advice",
                "focus_domain",
            ],
            fallback=deterministic_fallback,
            call_type="longitudinal",
        )

        # Validate drift value
        if result.get("security_drift") not in ("improving", "stable", "degrading"):
            result["security_drift"] = _compute_drift(
                [s.get("health_score", 50) for s in scan_summaries]
            )

        # Ensure thirty_day_advice is a list
        tdaa = result.get("thirty_day_advice", [])
        if not isinstance(tdaa, list):
            result["thirty_day_advice"] = deterministic_fallback["thirty_day_advice"]

        return result

    except Exception as exc:
        logger.warning("Longitudinal AI call failed: %s", exc)
        return deterministic_fallback
