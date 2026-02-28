"""
AI Explanation Engine -- SecureTrail  (4-Layer Chain Architecture)
Production-grade orchestrator for AWS Bedrock (Llama 3 70B Instruct).

Architecture
------------
Each vulnerability is processed through a 4-layer sequential chain:
  Layer 1: Technical Root Cause Analyzer  (temp 0.10, 500 tokens)
  Layer 2: Security Exploit & Risk Modeler (temp 0.15, 600 tokens)
  Layer 3: Student Mentor Translator       (temp 0.25, 900 tokens)
  Layer 4: AI Self-Critic / Quality Review (temp 0.10, 900 tokens)

Graceful degradation:
  - L1 fails -> full deterministic fallback
  - L2 fails -> build from L1 only
  - L3 fails -> build from L1 + L2
  - L4 fails -> use L3 uncorrected

Features
--------
* Async with configurable concurrency semaphore
* Circuit breaker (3 consecutive Bedrock failures disables AI)
* Per-layer temperature and max_tokens via prompt_builder.LAYER_CONFIG
* Strict JSON validation per layer
* Secrets masked before sending to the model
* Code snippets capped at 20 lines
* Per-call latency and per-layer metrics logged
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
    LAYER_CONFIG,
    L1_SYSTEM_PROMPT,
    L2_SYSTEM_PROMPT,
    L3_SYSTEM_PROMPT,
    L4_SYSTEM_PROMPT,
    build_layer1_prompt,
    build_layer2_prompt,
    build_layer3_prompt,
    build_layer4_prompt,
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
        r'["\'\s:=]+)\S+',
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
    lines = snippet.splitlines()
    if len(lines) > MAX_SNIPPET_LINES:
        lines = lines[:MAX_SNIPPET_LINES] + [
            f"... ({len(lines) - MAX_SNIPPET_LINES} more lines)"
        ]
    return _mask_secrets("\n".join(lines))


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
        # Layer 1 fields
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
        # Layer 2 fields
        severity_justification=(
            f"Rated {sev} based on the {cat} category and potential for exploitation."
        ),
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
        # Layer 3 fields
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
        common_student_mistake=(
            f"Beginners often skip {cat} protections because the code 'works' "
            f"during development. Security gaps only become visible under attack."
        ),
        learning_takeaways=[
            "Always validate and sanitize user input before processing.",
            "Use security linting tools in your IDE and CI/CD pipeline.",
            "Follow the OWASP Top 10 as a checklist for every project.",
        ],
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


# -- Layer Output Merging --------------------------------------------------

def _build_from_layers(
    l1: Optional[Dict[str, Any]],
    l2: Optional[Dict[str, Any]],
    l3: Optional[Dict[str, Any]],
    vuln: NormalizedVulnerability,
) -> Optional[AIExplanation]:
    """
    Merge outputs from available layers into a single AIExplanation.
    Missing layers are filled with empty defaults.
    Returns None only if L1 is also missing.
    """
    if not l1:
        return None

    l1 = l1 or {}
    l2 = l2 or {}
    l3 = l3 or {}

    # -- Layer 1 extraction --
    code_behavior = str(l1.get("code_behavior_summary", ""))
    confidence = str(l1.get("confidence_level", ""))
    root_cause = str(l1.get("root_cause_precise", ""))
    evidence = str(l1.get("explicit_evidence", ""))
    vuln_type = str(l1.get("validated_vulnerability_type", ""))

    # -- Layer 2 extraction --
    attack_flow = _to_list(l2.get("realistic_attack_flow", []))
    secondary_flow = _to_list(l2.get("secondary_attack_flow", []))
    if secondary_flow:
        attack_flow = attack_flow + ["--- Secondary Attack Vector ---"] + secondary_flow
    evidence_basis = str(l2.get("evidence_basis", ""))
    tech_impact = str(l2.get("technical_impact", ""))
    biz_impact = str(l2.get("business_impact_realistic", ""))
    sev_just = str(l2.get("severity_justification", ""))
    if evidence_basis:
        sev_just = f"[{evidence_basis}] {sev_just}"

    # -- Layer 3 extraction (may be L4-corrected) --
    student_expl = str(l3.get("clear_student_explanation", ""))
    why_matters = str(l3.get("why_this_matters_in_this_file", ""))
    attack_sim = _to_list(l3.get("step_by_step_attack_simulation", []))
    fix_steps = _to_list(l3.get("secure_fix_steps", []))
    secure_code = str(l3.get("secure_code_example", ""))
    defense = _to_list(l3.get("defense_in_depth", []))
    principle = str(l3.get("core_security_principle", ""))
    mistake = str(l3.get("common_student_mistake", ""))
    takeaways = _to_list(l3.get("learning_takeaways", []))

    # -- Quality check: reject if root cause is generic filler --
    _GENERIC_PHRASES = [
        "this type of vulnerability",
        "in real-world attacks",
        "can cause significant disruption",
    ]
    for phrase in _GENERIC_PHRASES:
        if phrase.lower() in root_cause.lower():
            return None

    # -- Cross-map to professional fields --
    pro_root = root_cause or student_expl
    pro_exploit = tech_impact or biz_impact
    pro_fix = "; ".join(fix_steps) if fix_steps else ""
    pro_patch = secure_code
    pro_bp = principle

    try:
        return AIExplanation(
            # Layer 1
            code_behavior_summary=code_behavior,
            confidence_level=confidence,
            validated_root_cause=root_cause or pro_root,
            evidence_from_code=evidence,
            # Layer 2
            severity_justification=sev_just,
            attacker_realistic_path=attack_flow or attack_sim,
            technical_impact=tech_impact or biz_impact,
            project_specific_risk=why_matters or biz_impact,
            # Layer 3
            clear_student_explanation=student_expl or root_cause,
            step_by_step_attack_simulation=attack_sim or attack_flow,
            secure_fix_steps=fix_steps,
            secure_code_example=secure_code,
            defense_in_depth=defense,
            core_security_principle=principle,
            common_student_mistake=mistake,
            learning_takeaways=takeaways,
            # Professional mode
            root_cause=pro_root,
            exploit_scenario=pro_exploit,
            step_by_step_exploit=attack_flow or attack_sim,
            secure_fix=pro_fix,
            code_patch_example=pro_patch,
            best_practice=pro_bp,
            minimal_patch=pro_fix,
            secure_practice=pro_bp,
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
        lines = text.splitlines()
        text = "\n".join(l for l in lines if not l.strip().startswith("```"))

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
    For each vulnerability with score >= threshold, run the 4-layer AI chain.
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
        f"for 4-layer AI chain (score >= {AI_SCORE_THRESHOLD}), "
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
    layer_stats = {"L1": 0, "L2": 0, "L3": 0, "L4": 0}
    layer_fail = {"L1": 0, "L2": 0, "L3": 0, "L4": 0}
    corrections_count = 0

    semaphore = asyncio.Semaphore(AI_MAX_CONCURRENT)
    loop = asyncio.get_event_loop()

    async def _invoke_layer(
        layer_name: str,
        system_prompt: str,
        user_prompt: str,
        log_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Invoke a single layer with its configured temperature & max_tokens."""
        nonlocal total_calls, total_input_tokens, total_output_tokens
        nonlocal total_latency_ms, consecutive_failures, circuit_open

        cfg = LAYER_CONFIG[layer_name]
        input_tokens = _estimate_tokens(system_prompt + user_prompt)
        total_input_tokens += input_tokens
        total_calls += 1
        layer_stats[layer_name] += 1

        t0 = time.monotonic()
        try:
            raw = await loop.run_in_executor(
                None,
                invoke_claude,
                system_prompt,
                user_prompt,
                cfg["temperature"],
                cfg["max_tokens"],
            )
            elapsed_ms = (time.monotonic() - t0) * 1000
            total_latency_ms += elapsed_ms
            output_tokens = _estimate_tokens(raw)
            total_output_tokens += output_tokens

            log.debug(
                f"{layer_name} {log_id} -- "
                f"{elapsed_ms:.0f}ms, ~{input_tokens}+{output_tokens} tok"
            )

            data = _safe_json_parse(raw)
            if data:
                consecutive_failures = 0
                return data
            else:
                layer_fail[layer_name] += 1
                log.warning(f"{layer_name} {log_id} -- malformed JSON")
                return None

        except BedrockPermanentError as e:
            elapsed_ms = (time.monotonic() - t0) * 1000
            total_latency_ms += elapsed_ms
            consecutive_failures += 1
            layer_fail[layer_name] += 1
            log.error(
                f"{layer_name} {log_id} -- permanent error "
                f"({consecutive_failures}/{CIRCUIT_BREAKER_LIMIT}): {e}"
            )
            if consecutive_failures >= CIRCUIT_BREAKER_LIMIT:
                circuit_open = True
                log.error(
                    "CIRCUIT BREAKER OPEN -- AI disabled for remaining findings."
                )
            raise  # propagate so _analyze_one can handle

        except Exception as e:
            elapsed_ms = (time.monotonic() - t0) * 1000
            total_latency_ms += elapsed_ms
            consecutive_failures += 1
            layer_fail[layer_name] += 1
            log.warning(
                f"{layer_name} {log_id} -- error "
                f"({consecutive_failures}/{CIRCUIT_BREAKER_LIMIT}): {e}"
            )
            if consecutive_failures >= CIRCUIT_BREAKER_LIMIT:
                circuit_open = True
                log.error(
                    "CIRCUIT BREAKER OPEN -- AI disabled for remaining findings."
                )
            return None

    async def _analyze_one(vuln: NormalizedVulnerability) -> None:
        nonlocal total_success, total_fallback, corrections_count

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

            # ---- LAYER 1: Technical Root Cause ----
            l1_prompt = build_layer1_prompt(payload)
            l1_data = None
            for attempt in range(1 + MAX_RETRY):
                try:
                    l1_data = await _invoke_layer(
                        "L1", L1_SYSTEM_PROMPT, l1_prompt, log_id
                    )
                    if l1_data:
                        break
                    if attempt < MAX_RETRY:
                        log.debug(f"L1 {log_id} retry {attempt + 1}")
                except BedrockPermanentError:
                    vuln.ai_explanation = _fallback_explanation(vuln)
                    total_fallback += 1
                    return

            if not l1_data:
                log.warning(f"{log_id} -- L1 failed, full fallback")
                vuln.ai_explanation = _fallback_explanation(vuln)
                total_fallback += 1
                return

            if circuit_open:
                vuln.ai_explanation = (
                    _build_from_layers(l1_data, None, None, vuln)
                    or _fallback_explanation(vuln)
                )
                total_fallback += 1
                return

            # ---- LAYER 2: Exploit & Risk Model ----
            l2_prompt = build_layer2_prompt(l1_data)
            try:
                l2_data = await _invoke_layer(
                    "L2", L2_SYSTEM_PROMPT, l2_prompt, log_id
                )
            except BedrockPermanentError:
                l2_data = None

            if not l2_data:
                log.info(f"{log_id} -- L2 failed, building from L1 only")
                result = _build_from_layers(l1_data, None, None, vuln)
                vuln.ai_explanation = result or _fallback_explanation(vuln)
                total_success += 1 if result else 0
                total_fallback += 0 if result else 1
                return

            if circuit_open:
                result = _build_from_layers(l1_data, l2_data, None, vuln)
                vuln.ai_explanation = result or _fallback_explanation(vuln)
                total_fallback += 1
                return

            # ---- LAYER 3: Student Mentor ----
            l3_prompt = build_layer3_prompt(l1_data, l2_data, payload)
            try:
                l3_data = await _invoke_layer(
                    "L3", L3_SYSTEM_PROMPT, l3_prompt, log_id
                )
            except BedrockPermanentError:
                l3_data = None

            if not l3_data:
                log.info(f"{log_id} -- L3 failed, building from L1+L2")
                result = _build_from_layers(l1_data, l2_data, None, vuln)
                vuln.ai_explanation = result or _fallback_explanation(vuln)
                total_success += 1 if result else 0
                total_fallback += 0 if result else 1
                return

            if circuit_open:
                result = _build_from_layers(l1_data, l2_data, l3_data, vuln)
                vuln.ai_explanation = result or _fallback_explanation(vuln)
                total_fallback += 1
                return

            # ---- LAYER 4: Self-Critic ----
            l4_prompt = build_layer4_prompt(l3_data)
            try:
                l4_data = await _invoke_layer(
                    "L4", L4_SYSTEM_PROMPT, l4_prompt, log_id
                )
            except BedrockPermanentError:
                l4_data = None

            # Determine final L3 output (corrected or original)
            final_l3 = l3_data  # default: use original
            if l4_data:
                if l4_data.get("corrections_made") in (True, "true", "True"):
                    corrections_count += 1
                    summary = l4_data.get("corrections_summary", "")
                    log.info(f"{log_id} -- L4 corrected: {summary[:80]}")
                    final_l3 = l4_data
                else:
                    log.debug(f"{log_id} -- L4 approved (no corrections)")

            # ---- MERGE ALL LAYERS ----
            result = _build_from_layers(l1_data, l2_data, final_l3, vuln)
            if result:
                vuln.ai_explanation = result
                total_success += 1
            else:
                log.warning(f"{log_id} -- merged result invalid, fallback")
                vuln.ai_explanation = _fallback_explanation(vuln)
                total_fallback += 1

    # Run all analyses concurrently (bounded by semaphore)
    await asyncio.gather(*[_analyze_one(v) for v in priority_vulns])

    # -- Metrics summary --
    avg_latency = total_latency_ms / max(total_calls, 1)
    log.info(
        f"4-Layer AI chain complete -- "
        f"calls={total_calls}, success={total_success}, fallback={total_fallback}, "
        f"circuit_open={circuit_open}, corrections={corrections_count}, "
        f"avg_latency={avg_latency:.0f}ms, "
        f"L1={layer_stats['L1']}(fail={layer_fail['L1']}), "
        f"L2={layer_stats['L2']}(fail={layer_fail['L2']}), "
        f"L3={layer_stats['L3']}(fail={layer_fail['L3']}), "
        f"L4={layer_stats['L4']}(fail={layer_fail['L4']}), "
        f"tokens_in~{total_input_tokens}, tokens_out~{total_output_tokens}"
    )

    # -- Executive summary --
    executive_summary = None
    if not circuit_open:
        try:
            summary_prompt = build_batch_summary_prompt(vulns, repo_name)
            t0 = time.monotonic()
            raw_summary = await loop.run_in_executor(
                None, invoke_claude, SYSTEM_PROMPT, summary_prompt
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
