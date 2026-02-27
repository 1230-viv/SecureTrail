"""
AI Explanation Engine — SecureTrail
Orchestrates AWS Bedrock invocations for vulnerability analysis.
- Only processes HIGH and CRITICAL findings (cost and latency optimization)
- Parses structured JSON from Claude responses
- Falls back gracefully when AI is unavailable
- Never sends raw scanner output to the AI
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, List, Optional

from Engines.ai.bedrock_client import invoke_claude, BedrockPermanentError
from Engines.ai.prompt_builder import (
    SYSTEM_PROMPT,
    build_batch_summary_prompt,
    build_single_vuln_prompt,
)
from Engines.business_impact.impact_engine import build_ai_prompt_payload
from Engines.normalization.schema import AIExplanation, NormalizedVulnerability, RiskLevel
from Utils.logger import JobLogger

# Score threshold to select findings for AI analysis
AI_SCORE_THRESHOLD = float(os.getenv("AI_SCORE_THRESHOLD", "7.0"))
# Max concurrent Bedrock calls to avoid throttling
AI_MAX_CONCURRENT = int(os.getenv("AI_MAX_CONCURRENT", "3"))
# Disable AI by default — set AI_ENABLED=true in env to enable Bedrock invocations
AI_ENABLED = os.getenv("AI_ENABLED", "false").lower() == "true"


async def explain_vulnerabilities(
    vulns: List[NormalizedVulnerability],
    repo_name: str,
    job_id: str,
) -> tuple[List[NormalizedVulnerability], Optional[Dict[str, Any]]]:
    """
    For each HIGH/CRITICAL vulnerability, invoke AI to produce structured
    explanations and patch suggestions.

    Returns:
        mutated vulnerabilities list (with .ai_explanation populated)
        executive_summary dict (or None if AI disabled/failed)
    """
    log = JobLogger(job_id, "ai_engine")

    if not AI_ENABLED:
        log.info("AI analysis disabled (AI_ENABLED=false) — skipping")
        return vulns, None

    # Select only findings above threshold
    priority_vulns = [
        v for v in vulns
        if v.exploitability and v.exploitability.score >= AI_SCORE_THRESHOLD
    ]

    log.info(
        f"AI analysis: {len(priority_vulns)}/{len(vulns)} findings qualify "
        f"(score >= {AI_SCORE_THRESHOLD})"
    )

    if not priority_vulns:
        return vulns, None

    # Circuit-breaker flag — set to True on first permanent Bedrock error so we
    # skip all remaining calls instantly rather than retrying 18 times in a row.
    permanent_failure: list[str] = []   # use a mutable container for closure

    # Process in batches to respect concurrency limit
    semaphore = asyncio.Semaphore(AI_MAX_CONCURRENT)
    loop = asyncio.get_event_loop()

    async def _analyze_one(vuln: NormalizedVulnerability) -> None:
        if permanent_failure:
            return  # circuit-breaker: skip immediately
        async with semaphore:
            if permanent_failure:
                return  # re-check after acquiring semaphore
            payload = build_ai_prompt_payload(vuln)
            prompt = build_single_vuln_prompt(payload)
            try:
                raw_response = await loop.run_in_executor(
                    None, invoke_claude, SYSTEM_PROMPT, prompt
                )
                explanation = _parse_ai_response(raw_response)
                if explanation:
                    vuln.ai_explanation = explanation
                    log.debug(f"AI explained vuln {vuln.id[:8]}")
            except BedrockPermanentError as e:
                permanent_failure.append(str(e))
                log.error(
                    f"Bedrock permanent error — disabling AI for this job. "
                    f"Details: {e}"
                )
            except Exception as e:
                log.warning(f"AI analysis failed for vuln {vuln.id[:8]}: {e}")

    await asyncio.gather(*[_analyze_one(v) for v in priority_vulns])

    # Generate executive summary (skip if circuit-breaker tripped)
    executive_summary = None
    if not permanent_failure:
        try:
            summary_prompt = build_batch_summary_prompt(vulns, repo_name)
            raw_summary = await loop.run_in_executor(
                None, invoke_claude, SYSTEM_PROMPT, summary_prompt
            )
            executive_summary = _safe_json_parse(raw_summary)
            if executive_summary:
                log.info("Executive summary generated")
        except BedrockPermanentError as e:
            log.error(f"Executive summary skipped — permanent Bedrock error: {e}")
        except Exception as e:
            log.warning(f"Executive summary generation failed: {e}")
    else:
        log.warning(
            "Skipping executive summary — Bedrock permanently unavailable. "
            "Check AWS account model access at: "
            "https://console.aws.amazon.com/bedrock/home#/modelaccess"
        )

    explained = sum(1 for v in priority_vulns if v.ai_explanation)
    log.info(f"AI analysis complete: {explained}/{len(priority_vulns)} findings explained")

    return vulns, executive_summary


def _parse_ai_response(raw: str) -> Optional[AIExplanation]:
    """Parse Claude's structured JSON response into AIExplanation."""
    data = _safe_json_parse(raw)
    if not data:
        return None
    try:
        return AIExplanation(
            root_cause=data.get("root_cause", ""),
            exploit_scenario=data.get("exploit_scenario", ""),
            minimal_patch=data.get("minimal_patch", ""),
            secure_practice=data.get("secure_practice", ""),
            references=data.get("references", []),
        )
    except Exception:
        return None


def _safe_json_parse(text: str) -> Optional[Dict[str, Any]]:
    """Extract and parse JSON from text, handling markdown code fences."""
    text = text.strip()
    # Strip markdown code fence if present
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(
            line for line in lines
            if not line.strip().startswith("```")
        )
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object boundaries
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
    return None
