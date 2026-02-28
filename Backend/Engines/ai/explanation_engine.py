"""
AI Explanation Engine -- SecureTrail  (Unified Single-Call Architecture)
Production-grade orchestrator for AWS Bedrock (Llama 3 70B Instruct).

Architecture
------------
Each vulnerability is processed through a single comprehensive AI call that
combines root-cause analysis, exploit modeling, educational content, and
self-validation in one prompt.

Features
--------
* Async with configurable concurrency semaphore
* Circuit breaker (3 consecutive Bedrock failures disables AI)
* Strict JSON validation
* Secrets masked before sending to the model
* Code snippets capped at 20 lines
* Per-call latency and success metrics logged
* Never crashes the pipeline -- every error path returns gracefully
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from typing import Any, Dict, List, Optional

from Engines.ai.bedrock_client import invoke_claude, BedrockPermanentError
from Engines.ai.prompt_builder import (
    SYSTEM_PROMPT,
    SUMMARY_SYSTEM_PROMPT,
    build_single_vuln_prompt,
    build_batch_summary_prompt,
)
from Engines.business_impact.impact_engine import build_ai_prompt_payload
from Engines.normalization.schema import (
    AIExplanation,
    NormalizedVulnerability,
    RiskLevel,
)
from Utils.logger import JobLogger

# -- Configuration ---------------------------------------------------------
AI_SCORE_THRESHOLD    = float(os.getenv("AI_SCORE_THRESHOLD", "7.0"))
AI_MAX_CONCURRENT     = int(os.getenv("AI_MAX_CONCURRENT", "3"))
AI_ENABLED            = os.getenv("AI_ENABLED", "false").lower() == "true"
CIRCUIT_BREAKER_LIMIT = 3
MAX_SNIPPET_LINES     = 20
MAX_RETRY             = 1

# Regex patterns for secret masking
_SECRET_PATTERNS = [
    re.compile(
        r'((?:api[_-]?key|secret|password|token|auth|credential|aws_secret)'
        r'["\'\'\s:=]+)\S+',
        re.IGNORECASE,
    ),
    re.compile(r'(AKIA[0-9A-Z]{16})'),
    re.compile(r'(?i)(bearer\s+)\S+'),
    re.compile(r'(ghp_[A-Za-z0-9_]{36})'),
    re.compile(r'(sk-[A-Za-z0-9]{32,})'),
]


# -- Helpers ---------------------------------------------------------------

def _mask_secrets(text: str) -> str:
    """Replace credential-like strings with <REDACTED>."""
    if not text:
        return text
    for pat in _SECRET_PATTERNS:
        text = pat.sub(
            lambda m: m.group(1) + "<REDACTED>" if m.lastindex else "<REDACTED>",
            text,
        )
    return text


def _trim_snippet(snippet: Optional[str]) -> Optional[str]:
    """Keep at most MAX_SNIPPET_LINES of code and mask any secrets."""
    if not snippet:
        return snippet
    lines_ = snippet.splitlines()
    if len(lines_) > MAX_SNIPPET_LINES:
        lines_ = lines_[:MAX_SNIPPET_LINES] + [
            f"... ({len(lines_) - MAX_SNIPPET_LINES} more lines)"
        ]
    return _mask_secrets("\n".join(lines_))


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (1 token ~ 4 chars for English/code)."""
    return max(1, len(text) // 4)


def _to_list(val: Any) -> List[str]:
    """Coerce a value to a list of strings."""
    if isinstance(val, str):
        return [val]
    if isinstance(val, list):
        return [str(s) for s in val]
    return []


# -- Deterministic Fallback ------------------------------------------------

def _fallback_explanation(vuln: NormalizedVulnerability) -> AIExplanation:
    """Deterministic fallback when AI is unavailable or returns junk."""
    cat = vuln.category or "security"
    sev = vuln.severity or "HIGH"
    file_ref = f" in `{vuln.file}`" if vuln.file else ""
    line_ref = f" at line {vuln.line}" if vuln.line else ""

    return AIExplanation(
        # Unified fields
        code_behavior_summary=(
            f"The code{file_ref}{line_ref} contains a pattern flagged as {cat}."
        ),
        confidence_level="LOW",
        validated_root_cause=(
            f"This {cat} vulnerability{file_ref}{line_ref} occurs because "
            f"user-controlled input reaches a sensitive operation without "
            f"proper validation or sanitization."
        ),
        evidence_from_code=(
            f"The code{file_ref}{line_ref} lacks proper input validation or "
            f"security controls for this {cat} pattern."
        ),
        is_inferred_or_explicit="Inferred due to missing visible protection",
        attacker_realistic_path=[
            f"Attacker maps the application and discovers the endpoint{file_ref}.",
            "Studies the request/response pattern to understand the weakness.",
            "Crafts a targeted payload exploiting the vulnerable code path.",
            "Sends the crafted request and gains unauthorized access.",
        ],
        technical_impact=(
            f"If exploited, this {sev} {cat} vulnerability could lead to "
            f"unauthorized data access, privilege escalation, or service disruption."
        ),
        project_specific_risk=(
            f"In your project, this {cat} issue{file_ref} could allow an "
            f"attacker to bypass intended security controls."
        ),
        # Student mode fields
        clear_student_explanation=(
            f"Your code has a {sev}-severity {cat} issue{file_ref}. "
            f"This means there is a gap that could let someone do something "
            f"they should not -- like accessing data without permission."
        ),
        step_by_step_attack_simulation=[
            f"An attacker discovers the {cat} weakness{file_ref}.",
            "They craft a malicious input targeting this code path.",
            "They send the crafted request to the application.",
            "The application processes it without proper validation.",
            "The attacker gains unauthorized access or data.",
        ],
        secure_fix_steps=[
            "Add input validation and sanitization at the entry point.",
            "Implement proper authentication/authorization middleware.",
            f"Review OWASP guidelines for {cat} remediation.",
        ],
        secure_code_example="// Review OWASP guidelines for a language-specific secure code example.",
        defense_in_depth=[
            "Add input validation and sanitization at all entry points.",
            "Implement proper authentication and authorization middleware.",
            "Add security logging and monitoring for suspicious activity.",
        ],
        core_security_principle=(
            "Defense in Depth -- never rely on a single security control. "
            "Validate inputs, sanitize outputs, and enforce least privilege at every layer."
        ),
        learning_takeaways=[
            "Always validate and sanitize user input before processing.",
            "Use security linting tools in your IDE and CI/CD pipeline.",
            "Follow the OWASP Top 10 as a checklist for every project.",
        ],
        self_validation_check=(
            "This is a deterministic fallback; AI analysis was not available."
        ),
        # Professional mode
        root_cause=(
            f"This {sev} {cat} vulnerability{file_ref} occurs when "
            f"user-controlled input is processed without proper validation."
        ),
        exploit_scenario=(
            f"An attacker exploits the {cat} weakness{file_ref} by crafting "
            f"a malicious payload to gain unauthorized access."
        ),
        step_by_step_exploit=[
            f"Discover the {cat} vulnerability{file_ref}.",
            "Craft a malicious input targeting the vulnerable code.",
            "Send payload and observe application behavior.",
            "Achieve unauthorized access or data exfiltration.",
        ],
        secure_fix=(
            f"Apply input validation, output encoding, and least-privilege "
            f"access controls per OWASP guidelines for {cat}."
        ),
        code_patch_example="// Consult OWASP guidelines for a language-specific patch.",
        best_practice=(
            "Adopt secure-by-default frameworks, enforce code review for "
            "security-sensitive changes, and integrate SAST/DAST in CI/CD."
        ),
        minimal_patch="See secure_fix above.",
        secure_practice="See best_practice above.",
        references=[
            "https://owasp.org/www-project-top-ten/",
            f"https://cwe.mitre.org/data/definitions/{vuln.cwe_id or '1000'}.html",
        ],
    )


# -- AI Response Mapping ---------------------------------------------------

def _build_from_ai(
    data: Dict[str, Any],
    vuln: NormalizedVulnerability,
) -> Optional[AIExplanation]:
    """
    Map the unified AI JSON response to an AIExplanation object.
    Supports both the new strict schema (confidence, code_summary, evidence,
    secure_fix, self_check) and the legacy schema for backward compatibility.
    Returns None if the response is generic filler.
    """
    if not data:
        return None

    # Extract fields — new schema keys first, fall back to legacy
    confidence = str(
        data.get("confidence") or data.get("confidence_level") or ""
    )
    code_summary = str(
        data.get("code_summary") or data.get("code_behavior_summary") or ""
    )
    root_cause = str(data.get("validated_root_cause", ""))
    evidence = str(
        data.get("evidence")
        or data.get("evidence_from_snippet")
        or data.get("evidence_from_code")
        or ""
    )
    is_inferred = str(
        data.get("is_explicit_or_inferred")
        or data.get("is_inferred_or_explicit")
        or ""
    )
    attack_flow = _to_list(data.get("realistic_attack_flow", []))
    tech_impact = str(data.get("technical_impact", ""))
    project_risk = str(data.get("project_specific_risk", ""))
    secure_fix = str(
        data.get("secure_fix") or ""
    )
    # Also support legacy list format
    fix_steps = _to_list(data.get("secure_fix_steps", []))
    if not fix_steps and secure_fix:
        fix_steps = [secure_fix]
    secure_code = str(data.get("secure_code_example", ""))
    defense = _to_list(data.get("defense_in_depth", []))
    principle = str(data.get("core_security_principle", ""))
    takeaways = _to_list(data.get("learning_takeaways", []))
    self_check = str(
        data.get("self_check") or data.get("self_validation_check") or ""
    )

    # Quality check: reject if root cause is generic filler
    _GENERIC_PHRASES = [
        "this type of vulnerability",
        "in real-world attacks",
        "can cause significant disruption",
    ]
    for phrase in _GENERIC_PHRASES:
        if phrase.lower() in root_cause.lower():
            return None

    # Cross-map to professional fields
    pro_root = root_cause or code_summary
    pro_fix = secure_fix or ("; ".join(fix_steps) if fix_steps else "")

    try:
        return AIExplanation(
            # Unified fields
            code_behavior_summary=code_summary,
            confidence_level=confidence,
            validated_root_cause=root_cause,
            evidence_from_code=evidence,
            is_inferred_or_explicit=is_inferred,
            attacker_realistic_path=attack_flow,
            technical_impact=tech_impact,
            project_specific_risk=project_risk,
            # Student mode
            clear_student_explanation=code_summary,
            step_by_step_attack_simulation=attack_flow,
            secure_fix_steps=fix_steps,
            secure_code_example=secure_code,
            defense_in_depth=defense,
            core_security_principle=principle,
            learning_takeaways=takeaways,
            self_validation_check=self_check,
            # Professional mode (cross-mapped)
            root_cause=pro_root,
            exploit_scenario=tech_impact,
            step_by_step_exploit=attack_flow,
            secure_fix=pro_fix,
            code_patch_example=secure_code,
            best_practice=principle,
            minimal_patch=pro_fix,
            secure_practice=principle,
            references=[
                "https://owasp.org/www-project-top-ten/",
                f"https://cwe.mitre.org/data/definitions/{vuln.cwe_id or '1000'}.html",
            ],
        )
    except Exception:
        return None


# -- JSON Parsing ----------------------------------------------------------

def _safe_json_parse(text: str) -> Optional[Dict[str, Any]]:
    """Extract and parse JSON from text, handling markdown fences and prose."""
    if not text:
        return None
    text = text.strip()

    # Strip markdown code fences
    if text.startswith("```"):
        lines_ = text.splitlines()
        text = "\n".join(l for l in lines_ if not l.strip().startswith("```"))

    # Direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Fallback: extract first JSON object
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end])
        except json.JSONDecodeError:
            pass

    return None


def _sanitize_payload(vuln: NormalizedVulnerability) -> Dict[str, Any]:
    """Build AI payload with secrets masked and snippet trimmed."""
    payload = build_ai_prompt_payload(vuln)
    for key in ("code_snippet", "description", "title"):
        if payload.get(key) and isinstance(payload[key], str):
            payload[key] = _mask_secrets(payload[key])
    payload["code_snippet"] = _trim_snippet(payload.get("code_snippet"))
    return payload


# -- Main Orchestrator -----------------------------------------------------

async def explain_vulnerabilities(
    vulns: List[NormalizedVulnerability],
    repo_name: str,
    job_id: str,
) -> tuple[List[NormalizedVulnerability], Optional[Dict[str, Any]]]:
    """
    For each vulnerability with score >= threshold, run the unified AI call.
    Returns (mutated vulns, executive_summary).
    """
    log = JobLogger(job_id, "ai_engine")

    if not AI_ENABLED:
        log.info("AI analysis disabled (AI_ENABLED=false) -- skipping")
        return vulns, None

    priority_vulns = [
        v for v in vulns
        if v.exploitability and v.exploitability.score >= AI_SCORE_THRESHOLD
    ]
    below_threshold = [
        v for v in vulns
        if not v.exploitability or v.exploitability.score < AI_SCORE_THRESHOLD
    ]

    log.info(
        f"AI analysis: {len(priority_vulns)}/{len(vulns)} findings qualify "
        f"for unified AI call (score >= {AI_SCORE_THRESHOLD}), "
        f"{len(below_threshold)} get deterministic fallback"
    )

    for v in below_threshold:
        v.ai_explanation = _fallback_explanation(v)

    if not priority_vulns:
        log.info("No findings above threshold -- all received fallback")
        return vulns, None

    # -- Circuit-breaker state --
    consecutive_failures = 0
    circuit_open = False
    total_calls = 0
    total_success = 0
    total_fallback = 0
    total_input_tokens = 0
    total_output_tokens = 0
    total_latency_ms = 0.0

    semaphore = asyncio.Semaphore(AI_MAX_CONCURRENT)
    loop = asyncio.get_event_loop()

    async def _analyze_one(vuln: NormalizedVulnerability) -> None:
        nonlocal total_calls, total_success, total_fallback
        nonlocal total_input_tokens, total_output_tokens, total_latency_ms
        nonlocal consecutive_failures, circuit_open

        if circuit_open:
            vuln.ai_explanation = _fallback_explanation(vuln)
            total_fallback += 1
            return

        async with semaphore:
            if circuit_open:
                vuln.ai_explanation = _fallback_explanation(vuln)
                total_fallback += 1
                return

            log_id = vuln.id[:8]
            payload = _sanitize_payload(vuln)
            user_prompt = build_single_vuln_prompt(payload)

            input_tokens = _estimate_tokens(SYSTEM_PROMPT + user_prompt)
            total_input_tokens += input_tokens

            for attempt in range(1 + MAX_RETRY):
                total_calls += 1
                t0 = time.monotonic()
                try:
                    raw = await loop.run_in_executor(
                        None,
                        invoke_claude,
                        SYSTEM_PROMPT,
                        user_prompt,
                    )
                    elapsed_ms = (time.monotonic() - t0) * 1000
                    total_latency_ms += elapsed_ms
                    output_tokens = _estimate_tokens(raw)
                    total_output_tokens += output_tokens

                    log.debug(
                        f"{log_id} -- {elapsed_ms:.0f}ms, "
                        f"~{input_tokens}+{output_tokens} tok"
                    )

                    data = _safe_json_parse(raw)
                    if data:
                        result = _build_from_ai(data, vuln)
                        if result:
                            vuln.ai_explanation = result
                            total_success += 1
                            consecutive_failures = 0
                            return
                        else:
                            log.warning(
                                f"{log_id} -- AI returned generic filler, "
                                f"attempt {attempt + 1}"
                            )
                    else:
                        log.warning(
                            f"{log_id} -- malformed JSON, "
                            f"attempt {attempt + 1}"
                        )

                except BedrockPermanentError as e:
                    elapsed_ms = (time.monotonic() - t0) * 1000
                    total_latency_ms += elapsed_ms
                    consecutive_failures += 1
                    log.error(
                        f"{log_id} -- permanent error "
                        f"({consecutive_failures}/{CIRCUIT_BREAKER_LIMIT}): {e}"
                    )
                    if consecutive_failures >= CIRCUIT_BREAKER_LIMIT:
                        circuit_open = True
                        log.error(
                            "CIRCUIT BREAKER OPEN -- AI disabled for remaining findings."
                        )
                    break  # no retry on permanent errors

                except Exception as e:
                    elapsed_ms = (time.monotonic() - t0) * 1000
                    total_latency_ms += elapsed_ms
                    consecutive_failures += 1
                    log.warning(
                        f"{log_id} -- error "
                        f"({consecutive_failures}/{CIRCUIT_BREAKER_LIMIT}): {e}"
                    )
                    if consecutive_failures >= CIRCUIT_BREAKER_LIMIT:
                        circuit_open = True
                        log.error(
                            "CIRCUIT BREAKER OPEN -- AI disabled for remaining findings."
                        )
                    if attempt < MAX_RETRY:
                        log.debug(f"{log_id} retry {attempt + 1}")
                        continue
                    break

            # All attempts exhausted -- fallback
            if vuln.ai_explanation is None:
                log.warning(f"{log_id} -- all attempts failed, fallback")
                vuln.ai_explanation = _fallback_explanation(vuln)
                total_fallback += 1

    # Run all analyses concurrently (bounded by semaphore)
    await asyncio.gather(*[_analyze_one(v) for v in priority_vulns])

    # -- Metrics summary --
    avg_latency = total_latency_ms / max(total_calls, 1)
    log.info(
        f"Unified AI analysis complete -- "
        f"calls={total_calls}, success={total_success}, fallback={total_fallback}, "
        f"circuit_open={circuit_open}, "
        f"avg_latency={avg_latency:.0f}ms, "
        f"tokens_in~{total_input_tokens}, tokens_out~{total_output_tokens}"
    )

    # -- Executive summary --
    executive_summary = None
    if not circuit_open:
        try:
            summary_prompt = build_batch_summary_prompt(vulns, repo_name)
            t0 = time.monotonic()
            raw_summary = await loop.run_in_executor(
                None, invoke_claude, SUMMARY_SYSTEM_PROMPT, summary_prompt
            )
            elapsed = (time.monotonic() - t0) * 1000
            executive_summary = _safe_json_parse(raw_summary)
            if executive_summary:
                log.info(f"Executive summary generated ({elapsed:.0f}ms)")
            else:
                log.warning("Executive summary -- malformed JSON, skipping")
        except BedrockPermanentError as e:
            log.error(f"Executive summary -- permanent Bedrock error: {e}")
        except Exception as e:
            log.warning(f"Executive summary generation failed: {e}")
    else:
        log.warning(
            "Skipping executive summary -- circuit breaker is OPEN. "
            "Verify model access: "
            "https://console.aws.amazon.com/bedrock/home#/modelaccess"
        )

    return vulns, executive_summary

