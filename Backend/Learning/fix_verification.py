"""
Fix Verification Engine — SecureTrail Learning System v3
=========================================================
Makes the learning system interactive: developer submits a code fix;
this module evaluates it deterministically and optionally via Bedrock.

Evaluation pipeline:
  1. Lightweight static analysis (AST parse + pattern regexes)
  2. Security-pattern matching (does the fix use known safe patterns?)
  3. Optional Bedrock call: structured JSON evaluation
  4. Compute improvement_score deterministically (AI score is advisory only)

Output schema (always):
  {
    "is_secure":         bool,
    "improvement_score": int (0–100),
    "missing_checks":    list[str],
    "explanation":       str,
    "next_step":         str,
    "static_flags":      list[str],   # deterministic findings
    "ai_evaluation":     dict | None, # Bedrock output (or None if AI disabled)
    "xp_awarded":        int,
    "lifecycle_state":   "verified" | "fix_attempted",
  }

XP awarded for passing:
  critical: 30 XP   high: 20 XP   medium: 10 XP   low: 5 XP
"""

from __future__ import annotations

import ast
import re
import os
from typing import Any

from Utils.logger import get_logger

logger = get_logger("fix_verification")

AI_ENABLED: bool = os.getenv("AI_ENABLED", "false").lower() == "true"

# ── XP rewards for verified fixes ────────────────────────────────────────────
VERIFY_XP: dict[str, int] = {
    "critical": 30,
    "high":     20,
    "medium":   10,
    "low":       5,
    "info":      2,
}

# ── Static bad-pattern regexes (indicate the fix is NOT complete) ────────────
_BAD_PATTERNS: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"f[\"'].*\{.*\}.*[\"']\s*\+\s*|[\"']\s*%\s*|\.format\(.*\)", re.I),
        "String interpolation into SQL/command — use parameterised queries",
    ),
    (
        re.compile(r"os\.system\(|subprocess\.call\(.*shell=True", re.I),
        "Shell=True or os.system() is unsafe — use subprocess with a list",
    ),
    (
        re.compile(r"password\s*=\s*[\"'][^\"']{3,}[\"']", re.I),
        "Hardcoded password literal in code",
    ),
    (
        re.compile(r"secret[_\s]*key\s*=\s*[\"'][^\"']{3,}[\"']", re.I),
        "Hardcoded secret key in code",
    ),
    (
        re.compile(r"verify\s*=\s*False", re.I),
        "TLS verification disabled (verify=False)",
    ),
    (
        re.compile(r"algorithms\s*=\s*\[\s*[\"']none[\"']\s*\]", re.I),
        "JWT algorithm 'none' is insecure",
    ),
    (
        re.compile(r"md5|sha1\s*\(", re.I),
        "Weak hash algorithm (MD5/SHA-1) — use SHA-256 or bcrypt",
    ),
    (
        re.compile(r"innerHTML\s*=(?!=)", re.I),
        "Direct innerHTML assignment — use textContent or DOMPurify",
    ),
    (
        re.compile(r"eval\s*\(", re.I),
        "eval() is unsafe — avoid dynamic code execution",
    ),
    (
        re.compile(r"allow_origins\s*=\s*\[?\s*[\"']\s*\*\s*[\"']", re.I),
        "CORS wildcard (*) — restrict to explicit domains",
    ),
]

# ── Category → good-pattern signals (presence awards bonus) ─────────────────
_GOOD_PATTERNS: dict[str, list[tuple[re.Pattern, str]]] = {
    "injection": [
        (re.compile(r"paramstyle|%s|:param|execute\s*\(\s*.*,\s*\[|\?", re.I), "Parameterised query"),
        (re.compile(r"orm\.|session\.|Model\.objects\.", re.I), "ORM usage"),
    ],
    "secret_management": [
        (re.compile(r"os\.getenv|os\.environ|environ\.get|settings\.\w+secret", re.I), "Environment variable lookup"),
        (re.compile(r"SecretsManager|boto3.*secretsmanager|vault\.read", re.I), "Secrets manager"),
    ],
    "access_control": [
        (re.compile(r"@login_required|@permission_required|Depends\(.*current_user", re.I), "Auth decorator / dependency"),
        (re.compile(r"if\s+.*user.*\.id\s*!=|owner_id\s*==|assert.*owner", re.I), "Ownership assertion"),
    ],
    "idor": [
        (re.compile(r"if\s+.*user.*\.id\s*!=|owner_id\s*==|get_or_404.*owner|assert.*owner", re.I), "Ownership check"),
    ],
    "jwt": [
        (re.compile(r"algorithms\s*=\s*\[.*RS256|ES256|HS256", re.I), "Explicit algorithm list"),
        (re.compile(r"options\s*=\s*\{.*verify_exp.*True", re.I), "Expiry verification"),
    ],
    "xss": [
        (re.compile(r"DOMPurify\.sanitize|textContent\s*=|escape\(|html\.escape", re.I), "Output encoding / sanitisation"),
        (re.compile(r"Content-Security-Policy|CSP", re.I), "CSP header"),
    ],
    "dependency": [
        (re.compile(r"pip-audit|safety check|npm audit|snyk test", re.I), "Automated dependency audit"),
    ],
    "cors": [
        (re.compile(r"ALLOWED_ORIGINS|allow_origins=\[.*https://", re.I), "Explicit allowed origins"),
    ],
    "cryptography": [
        (re.compile(r"bcrypt|argon2|pbkdf2_hmac|SHA-?256|SHA-?512", re.I), "Strong hash / crypto"),
    ],
}

# ── Score thresholds ──────────────────────────────────────────────────────────
_PASS_THRESHOLD = 60   # improvement_score >= 60 → lifecycle: verified


def _parse_ast_safe(code: str) -> tuple[bool, str]:
    """Returns (is_valid_python, error_message)."""
    try:
        ast.parse(code)
        return True, ""
    except SyntaxError as exc:
        return False, f"Syntax error at line {exc.lineno}: {exc.msg}"
    except Exception as exc:
        return False, str(exc)


def static_evaluate(
    code: str,
    category: str,
    severity: str = "medium",
) -> dict[str, Any]:
    """
    Deterministic static evaluation of submitted fix code.

    Returns a sub-dict used downstream in the full evaluation.
    """
    flags: list[str] = []
    bonus_signals: list[str] = []

    # AST validity (Python only — skip for JS/other)
    looks_python = bool(re.search(r"\bdef \w+|\bclass \w+|\bimport \w+|\bfrom \w+", code))
    if looks_python:
        valid_ast, ast_msg = _parse_ast_safe(code)
        if not valid_ast:
            flags.append(f"Code does not parse: {ast_msg}")

    # Bad patterns
    for pattern, description in _BAD_PATTERNS:
        if pattern.search(code):
            flags.append(description)

    # Good patterns for the specific category
    for pat, signal in _GOOD_PATTERNS.get(category, []):
        if pat.search(code):
            bonus_signals.append(signal)

    # Base score: start at 80, subtract 10 per flag, add 5 per good signal
    base_score = 80
    base_score -= len(flags) * 10
    base_score += len(bonus_signals) * 5
    base_score = max(0, min(100, base_score))

    is_secure = bool(not flags and base_score >= _PASS_THRESHOLD)

    return {
        "static_flags":   flags,
        "bonus_signals":  bonus_signals,
        "static_score":   base_score,
        "is_secure_static": is_secure,
    }


def _ai_evaluate_fix(
    code: str,
    category: str,
    label: str,
    severity: str,
    original_issue: str,
    repo_name: str,
) -> dict | None:
    """
    Call Bedrock to evaluate the submitted fix.
    Returns parsed dict or None on failure.
    """
    if not AI_ENABLED:
        return None

    from Engines.ai.bedrock_client import invoke_chat
    from Engines.ai.response_validator import safe_ai_call

    FALLBACK = {
        "is_secure": False,
        "improvement_score": 60,
        "missing_checks": [],
        "explanation": "AI evaluation unavailable — static analysis passed.",
        "next_step": "Review the checklist for this vulnerability category.",
    }

    system = (
        "You are a senior application security code reviewer for SecureTrail. "
        "Your job is to evaluate whether a developer's submitted code fix correctly "
        "addresses a security vulnerability. "
        "Respond ONLY with a valid JSON object — no markdown, no prose before or after. "
        "Be constructive, encouraging, and strictly educational. "
        "Never include procedural misuse instructions, payloads, or step-by-step "
        "bypass techniques. Use professional language only."
    )

    prompt = (
        f"A developer has submitted a code fix for a [{severity.upper()}] severity "
        f"'{label}' ({category}) vulnerability in repository '{repo_name}'.\n\n"
        f"Original issue description:\n{original_issue[:300]}\n\n"
        f"Submitted fix code:\n```\n{code[:1200]}\n```\n\n"
        f"Evaluate the submitted code and respond with this exact JSON structure:\n"
        f'{{\n'
        f'  "is_secure": <true or false>,\n'
        f'  "improvement_score": <integer 0-100>,\n'
        f'  "missing_checks": ["<specific missing check>", ...],\n'
        f'  "explanation": "<2-3 sentence educational explanation>",\n'
        f'  "next_step": "<single concrete next action for the developer>"\n'
        f'}}\n\n'
        f"Rules:\n"
        f"- improvement_score of 80+ means the fix is solid\n"
        f"- Only list real missing checks specific to {label}\n"
        f"- Explanation must be encouraging and educational\n"
        f"- Never include exploit instructions or bypass techniques\n"
        f"- Never mention 'attacker' — say 'unauthorised actor' instead"
    )

    result = safe_ai_call(
        call_fn=lambda: invoke_chat(
            [{"role": "user", "content": prompt}],
            system_prompt=system,
            temperature=0.2,
            max_tokens=600,
        ),
        required_keys=["is_secure", "improvement_score", "explanation", "next_step"],
        fallback=FALLBACK,
        call_type="fix_verify",
    )
    return result


def evaluate_fix(
    code: str,
    category: str,
    label: str,
    severity: str,
    original_issue: str,
    repo_name: str,
) -> dict[str, Any]:
    """
    Full fix evaluation pipeline.

    Parameters
    ----------
    code           : developer-submitted code snippet
    category       : vulnerability category slug (e.g. "injection")
    label          : human-readable label (e.g. "SQL Injection")
    severity       : critical / high / medium / low / info
    original_issue : the finding description / message
    repo_name      : repository name (for context in AI prompt)

    Returns
    -------
    Structured evaluation dict (see module docstring).
    """
    code = code.strip()
    if len(code) < 5:
        return {
            "is_secure": False,
            "improvement_score": 0,
            "missing_checks": ["Submitted code is too short to evaluate"],
            "explanation": "Please submit the full function or block that addresses the vulnerability.",
            "next_step": "Submit the relevant code section — at minimum the function containing the fix.",
            "static_flags":   [],
            "ai_evaluation":  None,
            "xp_awarded":     0,
            "lifecycle_state": "fix_attempted",
        }

    static = static_evaluate(code, category, severity)
    ai_eval = _ai_evaluate_fix(code, category, label, severity, original_issue, repo_name)

    # ── Merge scores: static (60%) + AI (40%) when AI available ──────────────
    static_score = static["static_score"]
    if ai_eval and ai_eval.get("_source") == "ai":
        ai_score = max(0, min(100, int(ai_eval.get("improvement_score", static_score))))
        improvement_score = round(static_score * 0.6 + ai_score * 0.4)
        missing_checks = ai_eval.get("missing_checks", [])
        explanation    = ai_eval.get("explanation", "")
        next_step      = ai_eval.get("next_step", "")
        is_secure      = bool(ai_eval.get("is_secure", False)) and not static["static_flags"]
    else:
        improvement_score = static_score
        missing_checks    = static["static_flags"]
        explanation       = (
            "Static analysis complete. "
            + ("No security issues detected in the submitted code." if not static["static_flags"]
               else f"Found {len(static['static_flags'])} potential issue(s) to address.")
        )
        next_step  = static["bonus_signals"][0] if static["bonus_signals"] else "Review the category checklist."
        is_secure  = static["is_secure_static"]

    # Enforce: only mark verified if score passes threshold and no static flags
    if is_secure and improvement_score >= _PASS_THRESHOLD and not static["static_flags"]:
        lifecycle_state = "verified"
        xp_awarded = VERIFY_XP.get(severity.lower(), 5)
    else:
        lifecycle_state = "fix_attempted"
        xp_awarded = 0

    return {
        "is_secure":         is_secure,
        "improvement_score": improvement_score,
        "missing_checks":    missing_checks,
        "explanation":       explanation,
        "next_step":         next_step,
        "static_flags":      static["static_flags"],
        "ai_evaluation":     ai_eval,
        "xp_awarded":        xp_awarded,
        "lifecycle_state":   lifecycle_state,
    }
