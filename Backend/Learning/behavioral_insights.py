"""
Behavioral Insights Engine — SecureTrail Learning System
=========================================================
Fully DETERMINISTIC. Zero AI dependency.

Maps recurring security categories to real developer habits, diagnosing
*why* an issue keeps appearing rather than just *what* the issue is.

Each rule describes:
    trigger        - category slug or recurring slug that activates this rule
    habit          - the developer habit or systemic gap behind the issue
    pattern_name   - short label for the card title
    recommendation - concrete, actionable fix
    priority       - high / medium / low
    effort         - "5 min" / "1 day" / "1 sprint" etc.
    tags           - helpful categorisation (tooling / process / design / testing)
"""

from __future__ import annotations

from typing import Any

# ─────────────────────────────────────────────────────────────────────────────
# Rule table
# ─────────────────────────────────────────────────────────────────────────────

BEHAVIORAL_RULES: list[dict[str, Any]] = [
    # ── Secrets ──────────────────────────────────────────────────────────────
    {
        "trigger_category": "secret_management",
        "pattern_name":     "Hardcoded Credentials",
        "habit":            "Secrets are typed directly into source files instead of being loaded from environment variables or a secrets manager.",
        "recommendation":   "Install Gitleaks as a pre-commit hook (`pre-commit install`) and move all secrets to a .env file or AWS Secrets Manager. Run `gitleaks detect` in CI to block merges.",
        "priority":         "high",
        "effort":           "1–2 hours",
        "tags":             ["tooling", "process"],
    },
    # ── IDOR ─────────────────────────────────────────────────────────────────
    {
        "trigger_category": "idor",
        "pattern_name":     "Missing Object-Level Authorization",
        "habit":            "Authorization is checked at login/session but not re-validated when accessing individual records, trusting the ID supplied by the caller.",
        "recommendation":   "Add an ownership-check helper (e.g. `get_or_404_owned(Model, id, owner=request.user)`) and call it on every resource fetch. Write a cross-user access integration test for each sensitive endpoint.",
        "priority":         "high",
        "effort":           "1 sprint",
        "tags":             ["design", "testing"],
    },
    # ── Access Control ────────────────────────────────────────────────────────
    {
        "trigger_category": "access_control",
        "pattern_name":     "Decentralised Permission Checks",
        "habit":            "Role and permission checks are scattered across individual view functions instead of being enforced at a central layer that is impossible to forget.",
        "recommendation":   "Implement a centralized `require_permission(role)` decorator or middleware. Annotate every route; use a route registry scan in your test suite to assert no route is unannotated.",
        "priority":         "high",
        "effort":           "1 day",
        "tags":             ["design", "process"],
    },
    # ── Injection ─────────────────────────────────────────────────────────────
    {
        "trigger_category": "injection",
        "pattern_name":     "String Concatenation for Queries",
        "habit":            "SQL or command strings are built by concatenating user-controlled values, bypassing the database's own parameterisation mechanism.",
        "recommendation":   "Enforce ORM usage or parameterised query helpers across the codebase. Add a linter rule (bandit/semgrep) that rejects raw SQL string formatting. Treat any finding as a P0 bug.",
        "priority":         "high",
        "effort":           "1–2 days",
        "tags":             ["tooling", "design"],
    },
    # ── Dependencies ─────────────────────────────────────────────────────────
    {
        "trigger_category": "dependency",
        "pattern_name":     "Manual Dependency Management",
        "habit":            "Dependencies are updated only when developers remember, leaving known CVEs open for extended periods.",
        "recommendation":   "Enable Dependabot or Renovate with a policy file: auto-merge patch updates, review minor/major. Add `pip-audit` or `npm audit --audit-level=high` as a CI gate.",
        "priority":         "medium",
        "effort":           "2–3 hours",
        "tags":             ["tooling", "process"],
    },
    # ── JWT ───────────────────────────────────────────────────────────────────
    {
        "trigger_category": "jwt",
        "pattern_name":     "Fragmented Token Validation",
        "habit":            "JWT decode and validation logic is duplicated across multiple routes or modules, making it easy to miss a check or use the wrong algorithm.",
        "recommendation":   "Centralise all JWT logic in one `auth_utils.py` module and expose a single `validate_token()` function. Enforce `alg: RS256` or `ES256`—never `none`. Write unit tests for tampered tokens.",
        "priority":         "high",
        "effort":           "1 day",
        "tags":             ["design", "testing"],
    },
    # ── CORS ──────────────────────────────────────────────────────────────────
    {
        "trigger_category": "cors",
        "pattern_name":     "Overly Permissive CORS",
        "habit":            "CORS is set to `*` for convenience during development and never tightened before production.",
        "recommendation":   "Define `ALLOWED_ORIGINS` as an environment variable containing only production domains. Add a CI check that asserts CORS is not `*` in non-local environments.",
        "priority":         "medium",
        "effort":           "30 minutes",
        "tags":             ["process", "tooling"],
    },
    # ── Rate Limiting ─────────────────────────────────────────────────────────
    {
        "trigger_category": "rate_limiting",
        "pattern_name":     "Unthrottled Sensitive Endpoints",
        "habit":            "Rate limiting is either absent entirely or applied only globally, leaving login, registration, and password-reset endpoints vulnerable to brute-force attacks.",
        "recommendation":   "Apply per-IP + per-account rate limiting at the sensitive-endpoint level using SlowAPI (FastAPI) or express-rate-limit. Document limits in your OpenAPI spec.",
        "priority":         "high",
        "effort":           "2–4 hours",
        "tags":             ["design", "tooling"],
    },
    # ── XSS ───────────────────────────────────────────────────────────────────
    {
        "trigger_category": "xss",
        "pattern_name":     "Missing Output Encoding",
        "habit":            "User-supplied data is interpolated into HTML or JavaScript without escaping, typically because auto-escaping is disabled or template literals are used carelessly.",
        "recommendation":   "Enable template engine auto-escaping globally. Add a strict Content-Security-Policy header. Conduct a DOMPurify audit on any front-end component that sets `innerHTML`.",
        "priority":         "high",
        "effort":           "1 day",
        "tags":             ["design", "tooling"],
    },
    # ── Secure Headers ────────────────────────────────────────────────────────
    {
        "trigger_category": "secure_headers",
        "pattern_name":     "Security Headers Not Configured",
        "habit":            "HTTP security headers (CSP, HSTS, X-Frame-Options, etc.) are missing because they are never part of the initial setup checklist.",
        "recommendation":   "Add `secure-headers` middleware or a one-time configuration block in your app factory that sets all OWASP-recommended headers. Include a header scan (`mozilla/http-observatory`) in CI.",
        "priority":         "medium",
        "effort":           "1–2 hours",
        "tags":             ["tooling", "process"],
    },
    # ── Cryptography ─────────────────────────────────────────────────────────
    {
        "trigger_category": "cryptography",
        "pattern_name":     "Weak or Deprecated Crypto Primitives",
        "habit":            "MD5, SHA-1, or DES are still used because they were copy-pasted from old examples; proper key sizes and modes are not enforced by any lint rule.",
        "recommendation":   "Adopt a cryptography helper module wrapping modern primitives (AES-256-GCM, SHA-256, bcrypt/argon2). Add a Semgrep rule banning `md5`, `sha1`, `DES` imports.",
        "priority":         "high",
        "effort":           "1 day",
        "tags":             ["design", "tooling"],
    },
    # ── Logging ───────────────────────────────────────────────────────────────
    {
        "trigger_category": "logging",
        "pattern_name":     "Sensitive Data in Logs",
        "habit":            "Debug-level logging captures full request objects or exception traces containing passwords, tokens, or PII without any scrubbing.",
        "recommendation":   "Implement a log sanitiser that strips known sensitive keys. Set production log level to INFO. Use structured logging (structlog / AWS CloudWatch Logs Insights) so sensitive fields can be redacted at the formatter level.",
        "priority":         "medium",
        "effort":           "2–4 hours",
        "tags":             ["process", "design"],
    },
    # ── Session Management ───────────────────────────────────────────────────
    {
        "trigger_category": "session_management",
        "pattern_name":     "Long-Lived or Unrevocable Sessions",
        "habit":            "Sessions or tokens are issued without expiry (or very long TTL) and there is no server-side revocation mechanism.",
        "recommendation":   "Set access token TTL ≤ 15 min and refresh token TTL ≤ 7 days. Implement a token blocklist (Redis SET) for logout and account-disable flows. Rotate signing secrets on a schedule.",
        "priority":         "high",
        "effort":           "1–2 days",
        "tags":             ["design", "process"],
    },
    # ── Input Validation ─────────────────────────────────────────────────────
    {
        "trigger_category": "input_validation",
        "pattern_name":     "Absent or Partial Input Validation",
        "habit":            "Validation is added reactively (after a bug report) rather than being the default starting point for every API endpoint.",
        "recommendation":   "Adopt Pydantic models (FastAPI) or Joi/Zod (Node) as your contract for every request body and query param. Enable strict-mode to reject unknown fields.",
        "priority":         "medium",
        "effort":           "1 sprint",
        "tags":             ["design", "process"],
    },
    # ── Error Handling ────────────────────────────────────────────────────────
    {
        "trigger_category": "error_handling",
        "pattern_name":     "Stack Traces Exposed to Clients",
        "habit":            "Exceptions are propagated without a catch-all handler, leaking internal paths, library versions, and query structure to end users.",
        "recommendation":   "Add a global exception handler that returns a generic error response in production. Log the full trace server-side. Test this path explicitly in your integration test suite.",
        "priority":         "medium",
        "effort":           "2–3 hours",
        "tags":             ["design", "testing"],
    },
]

# Build a fast lookup by trigger_category
_RULE_BY_CATEGORY: dict[str, dict] = {
    r["trigger_category"]: r for r in BEHAVIORAL_RULES
}


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def generate_behavioral_insights(
    categories: dict[str, int],
    recurring: list[dict] | None = None,
) -> list[dict]:
    """
    Return a list of behavioral insight dicts for the categories present.

    Parameters
    ----------
    categories : {category_slug: count} from learning_engine
    recurring  : recurring_categories list from recurring_weakness (optional)

    Returns
    -------
    list[dict] — each with: pattern_name, habit, recommendation, priority,
                              effort, tags, category_slug
    """
    insights: dict[str, dict] = {}

    # Activate rules based on categories found in current scan
    for cat_slug, count in categories.items():
        if count > 0 and cat_slug in _RULE_BY_CATEGORY:
            rule = _RULE_BY_CATEGORY[cat_slug]
            insight = {**rule, "category_slug": cat_slug, "finding_count": count, "is_recurring": False}
            insights[cat_slug] = insight

    # Mark rules that are also in the recurring list
    if recurring:
        for rec in recurring:
            cat_slug = rec.get("category") or ""
            if cat_slug in insights:
                insights[cat_slug]["is_recurring"] = True
                insights[cat_slug]["recurring_streak"] = rec.get("consecutive_streak", 0)
                insights[cat_slug]["recurring_total"] = rec.get("total_appearances", 0)
            elif cat_slug in _RULE_BY_CATEGORY:
                # Category only surfaced due to recurrence (not in this scan directly)
                rule = _RULE_BY_CATEGORY[cat_slug]
                insights[cat_slug] = {
                    **rule,
                    "category_slug":   cat_slug,
                    "finding_count":   0,
                    "is_recurring":    True,
                    "recurring_streak": rec.get("consecutive_streak", 0),
                    "recurring_total":  rec.get("total_appearances", 0),
                }

    # Sort: recurring-high first, then by priority rank, then finding count
    _PRIORITY_RANK = {"high": 3, "medium": 2, "low": 1}
    sorted_insights = sorted(
        insights.values(),
        key=lambda i: (
            i["is_recurring"],
            _PRIORITY_RANK.get(i["priority"], 0),
            i["finding_count"],
        ),
        reverse=True,
    )

    return sorted_insights[:8]  # Top 8 insights max


def get_behavioral_signal_for_ai(insights: list[dict]) -> list[dict]:
    """
    Return a minimal version of insights suitable for injecting into the AI prompt
    context block (keeps prompt size controlled).
    """
    return [
        {
            "pattern":        i["pattern_name"],
            "habit":          i["habit"],
            "recommendation": i["recommendation"],
            "is_recurring":   i["is_recurring"],
        }
        for i in insights[:5]  # Top 5 for AI context
    ]
