"""
AI Response Validator — SecureTrail
====================================
Validates and sanitises all Bedrock AI output before it reaches the API layer.

Responsibilities:
  1. Strip markdown fencing from JSON responses
  2. Parse and validate JSON structure against an expected schema
  3. Reject / redact any forbidden language (exploit, attack payload, etc.)
  4. Retry once on parse failure; fall back to deterministic skeleton on second failure
  5. Log Bedrock token usage for every call

All prompts must go through ``safe_ai_call()`` — never call invoke_claude/invoke_chat directly
from the Learning layer.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any, Callable

from Utils.logger import get_logger

logger = get_logger("response_validator")

# ── Prompt version stamp ──────────────────────────────────────────────────────
PROMPT_VERSION = "v3.1"

# ── Forbidden phrases in AI output (case-insensitive) ────────────────────────
# Any response containing these is redacted to the fallback.
_FORBIDDEN_PATTERNS: list[re.Pattern] = [
    re.compile(r"\bexploit\b", re.I),
    re.compile(r"\battack[_\s]?(step|payload|vector|path|surface|chain)\b", re.I),
    re.compile(r"\bsql\s+injection\s+(payload|string|example)\b", re.I),
    re.compile(r"\bpayload\s+(for|to)\s+(bypass|inject|steal|extract)\b", re.I),
    re.compile(r"\bpenetration\s+test(ing)?\s+(step|technique|method)\b", re.I),
    re.compile(r"\b(steal|exfiltrate)\s+(token|credential|secret|password|data)\b", re.I),
    re.compile(r"\bbypass\s+(auth|authentication|2fa|mfa|rate.?limit)\b", re.I),
    re.compile(r"\bproof[\s-]of[\s-]concept\s+(code|exploit|poc)\b", re.I),
    re.compile(r"\b0day\b|\bzero.?day\s+(exploit|vulnerability)\b", re.I),
]

# Words that are fine in educational context but must not appear as procedural steps
_EDUCATIONAL_CONTEXT_WORDS = {
    "injection", "traversal", "forgery", "overflow", "deserialization",
    "privilege", "escalation",
}


def _contains_forbidden(text: str) -> tuple[bool, str]:
    """Returns (True, matched_phrase) if the text contains forbidden language."""
    for pattern in _FORBIDDEN_PATTERNS:
        m = pattern.search(text)
        if m:
            return True, m.group(0)
    return False, ""


def _strip_markdown_json(raw: str) -> str:
    """Remove ```json ... ``` or ``` ... ``` wrappers."""
    raw = raw.strip()
    # Remove ```json ... ``` or ```JSON ... ``` fences
    raw = re.sub(r"^```(?:json|JSON)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    # Remove trailing commas before } or ] (common model mistake)
    raw = re.sub(r",\s*([}\]])", r"\1", raw)
    return raw.strip()


def _extract_first_json_object(raw: str) -> str:
    """
    If the model prefixed its JSON with prose, find the first { or [ and
    return everything from there to the matching close bracket.
    """
    for i, ch in enumerate(raw):
        if ch in ("{", "["):
            # Try to find the matching close
            depth = 0
            close = "}" if ch == "{" else "]"
            for j in range(i, len(raw)):
                if raw[j] == ch:
                    depth += 1
                elif raw[j] == close:
                    depth -= 1
                    if depth == 0:
                        return raw[i : j + 1]
            return raw[i:]
    return raw


def parse_json_response(raw: str) -> dict | list | None:
    """
    Attempt to parse a JSON string from a raw Bedrock response.
    Returns the Python object or None on failure.
    """
    cleaned = _strip_markdown_json(raw)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract first JSON block from mixed prose+json
        extracted = _extract_first_json_object(cleaned)
        try:
            return json.loads(extracted)
        except json.JSONDecodeError:
            return None


def validate_ai_response(
    raw: str,
    required_keys: list[str] | None = None,
    fallback: dict | None = None,
) -> dict:
    """
    Full validation pipeline:
      1. Forbidden language check
      2. JSON parse
      3. Required-key check
      4. Return parsed dict or ``fallback``

    Parameters
    ----------
    raw          : raw string from Bedrock
    required_keys: keys that MUST exist in the top-level dict
    fallback     : what to return if validation fails

    Returns
    -------
    dict — parsed (and possibly censored) response, or ``fallback`` on failure.
    """
    fb = fallback or {}

    if not raw or not raw.strip():
        logger.warning("AI returned empty response — using fallback")
        return {**fb, "_source": "fallback", "_reason": "empty_response"}

    # Forbidden language gate
    is_forbidden, phrase = _contains_forbidden(raw)
    if is_forbidden:
        logger.warning("AI response contained forbidden phrase '%s' — using fallback", phrase)
        return {**fb, "_source": "fallback", "_reason": f"forbidden_phrase:{phrase}"}

    parsed = parse_json_response(raw)
    if parsed is None:
        logger.warning("AI response failed JSON parse — using fallback. Raw snippet: %.120s", raw)
        return {**fb, "_source": "fallback", "_reason": "json_parse_failed"}

    if not isinstance(parsed, dict):
        logger.warning("AI response parsed to non-dict (%s) — using fallback", type(parsed))
        return {**fb, "_source": "fallback", "_reason": "not_a_dict"}

    if required_keys:
        missing = [k for k in required_keys if k not in parsed]
        if missing:
            logger.warning(
                "AI response missing required keys %s — using fallback", missing
            )
            return {**fb, "_source": "fallback", "_reason": f"missing_keys:{missing}"}

    parsed["_source"] = "ai"
    parsed["_prompt_version"] = PROMPT_VERSION
    return parsed


# ── Token usage logger ────────────────────────────────────────────────────────

def log_token_usage(
    call_type: str,
    model_id: str,
    input_tokens: int,
    output_tokens: int,
    latency_ms: float,
) -> None:
    """Log Bedrock token usage in structured format for billing / monitoring."""
    total = input_tokens + output_tokens
    logger.info(
        "BEDROCK_USAGE call_type=%s model=%s input_tokens=%d output_tokens=%d "
        "total_tokens=%d latency_ms=%.0f",
        call_type,
        model_id,
        input_tokens,
        output_tokens,
        total,
        latency_ms,
    )


# ── Safe AI call wrapper ───────────────────────────────────────────────────────

def safe_ai_call(
    *,
    call_fn: Callable[[], str],
    required_keys: list[str] | None = None,
    fallback: dict | None = None,
    call_type: str = "generic",
) -> dict:
    """
    Execute ``call_fn()`` (a zero-argument callable that returns raw AI text),
    validate the result, and retry once on parse failure.

    Parameters
    ----------
    call_fn       : lambda / partial that calls invoke_claude or invoke_chat
    required_keys : expected top-level keys in the JSON response
    fallback      : what to return if both attempts fail
    call_type     : label for logging (e.g. "fix_verify", "insights")

    Returns
    -------
    dict — validated response or fallback dict
    """
    fb = fallback or {}
    attempts = 0
    last_raw = ""
    t_start = time.monotonic()

    for attempt in range(2):
        attempts += 1
        try:
            raw = call_fn()
            last_raw = raw
            result = validate_ai_response(raw, required_keys=required_keys, fallback=fb)
            if result.get("_source") == "ai":
                elapsed = (time.monotonic() - t_start) * 1000
                logger.info(
                    "safe_ai_call OK type=%s attempts=%d latency_ms=%.0f",
                    call_type,
                    attempts,
                    elapsed,
                )
                return result
            if attempt == 0:
                logger.info("safe_ai_call attempt 1 failed (%s), retrying…", result.get("_reason"))
        except Exception as exc:
            logger.warning("safe_ai_call attempt %d exception: %s", attempt + 1, exc)

    elapsed = (time.monotonic() - t_start) * 1000
    logger.warning(
        "safe_ai_call FALLBACK type=%s attempts=%d latency_ms=%.0f snippet=%.80s",
        call_type,
        attempts,
        elapsed,
        last_raw,
    )
    return {**fb, "_source": "fallback", "_reason": "max_retries_exhausted"}
