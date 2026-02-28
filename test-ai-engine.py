#!/usr/bin/env python3
"""
Integration test — exercises the full AI explanation engine
against a fake vulnerability to verify Bedrock + Llama 3 8B
returns properly structured JSON.

Usage:  conda activate base && python test-ai-engine.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# ── Bootstrap ─────────────────────────────────────────────────────────────────
backend = Path(__file__).parent / "Backend"
sys.path.insert(0, str(backend))

from dotenv import load_dotenv
load_dotenv(backend / ".env")

# Force AI on for this test
os.environ["AI_ENABLED"] = "true"
os.environ["AI_SCORE_THRESHOLD"] = "1.0"   # process everything

from Engines.normalization.schema import (
    AIExplanation,
    Confidence,
    ExploitabilityScore,
    NormalizedVulnerability,
    RiskLevel,
    Severity,
    ScannerSource,
    VulnerabilityCategory,
)
from Engines.ai.explanation_engine import (
    explain_vulnerabilities,
    _fallback_explanation,
    _mask_secrets,
    _trim_snippet,
    _safe_json_parse,
    _validate_and_build,
)


# ── Fake vulnerability fixture ────────────────────────────────────────────────
def _make_vuln() -> NormalizedVulnerability:
    return NormalizedVulnerability(
        type="sql-injection",
        category=VulnerabilityCategory.INJECTION,
        title="SQL Injection in user login query",
        description=(
            "User-supplied input is concatenated directly into a SQL query "
            "without parameterization, allowing an attacker to inject SQL."
        ),
        file="src/controllers/auth.js",
        line=42,
        code_snippet=(
            'const query = "SELECT * FROM users WHERE email = \'" + req.body.email + "\'";\n'
            "db.query(query, (err, rows) => {\n"
            "  if (rows.length) { /* login success */ }\n"
            "});"
        ),
        severity=Severity.CRITICAL,
        confidence=Confidence.HIGH,
        source=ScannerSource.SEMGREP,
        cwe_id="CWE-89",
        owasp_id="A03:2021",
        exploitability=ExploitabilityScore(
            score=9.5,
            risk_level=RiskLevel.CRITICAL,
            factors={"base": 9.0, "category_bonus": 1.5},
            explanation="SQL injection with direct string concatenation.",
        ),
    )


# ── Unit tests ────────────────────────────────────────────────────────────────
def test_mask_secrets():
    print("  [1/5] Secret masking ...", end=" ")
    assert "<REDACTED>" in _mask_secrets("api_key=AKIA1234567890ABCDEF")
    assert "<REDACTED>" in _mask_secrets('password: "super_secret_123"')
    assert "<REDACTED>" in _mask_secrets("Bearer eyJhbGciOiJIUzI1NiJ9.xxx")
    assert "<REDACTED>" in _mask_secrets("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij")
    print("PASS")


def test_trim_snippet():
    print("  [2/5] Snippet trimming ...", end=" ")
    long = "\n".join(f"line {i}" for i in range(50))
    trimmed = _trim_snippet(long)
    assert trimmed.count("\n") <= 21  # 20 lines + "... N more lines"
    assert "more lines" in trimmed
    assert _trim_snippet(None) is None
    assert _trim_snippet("short") == "short"
    print("PASS")


def test_json_parse():
    print("  [3/5] JSON parsing ...", end=" ")
    # Plain JSON
    assert _safe_json_parse('{"a": 1}') == {"a": 1}
    # Fenced JSON
    assert _safe_json_parse('```json\n{"a": 1}\n```') == {"a": 1}
    # JSON with prose around it
    assert _safe_json_parse('Here is the result: {"a": 1} done.') == {"a": 1}
    # Garbage
    assert _safe_json_parse("not json at all") is None
    assert _safe_json_parse("") is None
    print("PASS")


def test_validate_and_build():
    print("  [4/5] Validation ...", end=" ")
    good = {
        "root_cause": "SQL injection via string concatenation",
        "exploit_scenario": "Attacker sends malicious email",
        "step_by_step_exploit": ["Step 1", "Step 2"],
        "secure_fix": "Use parameterized queries",
        "code_patch_example": "db.query('SELECT * FROM users WHERE email = $1', [email])",
        "best_practice": "Always use ORM or prepared statements",
        "references": ["https://owasp.org/A03"],
    }
    result = _validate_and_build(good)
    assert result is not None
    assert result.root_cause == good["root_cause"]
    assert len(result.step_by_step_exploit) == 2
    assert len(result.references) == 1

    # Missing root_cause
    assert _validate_and_build({"exploit_scenario": "x"}) is None
    # Empty root_cause
    assert _validate_and_build({"root_cause": "", "exploit_scenario": "x"}) is None
    # Not a dict
    assert _validate_and_build("string") is None
    print("PASS")


def test_fallback():
    print("  [5/5] Fallback explanation ...", end=" ")
    vuln = _make_vuln()
    fb = _fallback_explanation(vuln)
    assert isinstance(fb, AIExplanation)
    assert fb.root_cause != ""
    assert len(fb.step_by_step_exploit) > 0
    assert len(fb.references) > 0
    print("PASS")


# ── Live Bedrock integration test ─────────────────────────────────────────────
async def test_live_bedrock():
    print("\n  [LIVE] Calling Bedrock with fake SQL injection vuln ...")
    vuln = _make_vuln()

    vulns, summary = await explain_vulnerabilities(
        [vuln], "test-repo", "test-job-001"
    )

    v = vulns[0]
    print(f"\n  Model: {os.getenv('BEDROCK_MODEL_ID')}")
    print(f"  AI Explanation present: {v.ai_explanation is not None}")

    if v.ai_explanation:
        exp = v.ai_explanation
        print(f"\n  root_cause:           {exp.root_cause[:100]}...")
        print(f"  exploit_scenario:     {exp.exploit_scenario[:100]}...")
        print(f"  step_by_step_exploit: {len(exp.step_by_step_exploit)} steps")
        for i, s in enumerate(exp.step_by_step_exploit[:3]):
            print(f"    {i+1}. {s[:80]}")
        print(f"  secure_fix:           {exp.secure_fix[:100]}..." if exp.secure_fix else "  secure_fix: (empty)")
        print(f"  code_patch_example:   {exp.code_patch_example[:100]}..." if exp.code_patch_example else "  code_patch_example: (empty)")
        print(f"  best_practice:        {exp.best_practice[:100]}..." if exp.best_practice else "  best_practice: (empty)")
        print(f"  references:           {exp.references}")
        print("\n  LIVE TEST PASSED")
    else:
        print("\n  WARNING: AI explanation is None — check Bedrock logs above")

    if summary:
        print(f"\n  Executive Summary: {json.dumps(summary, indent=2)[:300]}...")
    else:
        print("\n  Executive summary: None (may be expected if only 1 vuln)")

    return v.ai_explanation is not None


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 65)
    print("  SecureTrail — AI Explanation Engine Integration Test")
    print("=" * 65)

    # Unit tests
    print("\n── Unit Tests ──────────────────────────────────────────────")
    test_mask_secrets()
    test_trim_snippet()
    test_json_parse()
    test_validate_and_build()
    test_fallback()
    print("\n  All unit tests PASSED\n")

    # Live test
    print("── Live Bedrock Test ───────────────────────────────────────")
    success = asyncio.run(test_live_bedrock())

    print("\n" + "=" * 65)
    if success:
        print("  ALL TESTS PASSED — AI Engine is production-ready!")
    else:
        print("  Unit tests passed. Live test returned no explanation.")
        print("  Check Bedrock model access and logs above.")
    print("=" * 65)

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
