"""
Scanner Orchestrator — SecureTrail
Runs all scanners in parallel using asyncio.gather with isolated error handling.
No single failed scanner can prevent the others from completing.
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import Any, Dict, Tuple

from Scanners.semgrep_scanner import run_semgrep
from Scanners.trivy_scanner import run_trivy
from Scanners.gitleaks_scanner import run_gitleaks
from Utils.logger import JobLogger


async def run_all_scanners(
    project_dir: Path,
    job_id: str,
) -> Tuple[Dict[str, Any], Dict[str, str]]:
    """
    Run all scanners concurrently.

    Returns:
        results  — dict mapping scanner name → raw scanner output
        errors   — dict mapping scanner name → error message (if failed)
    """
    log = JobLogger(job_id, "scanner.orchestrator")
    log.info("Launching all scanners in parallel")

    start = time.monotonic()

    semgrep_task   = asyncio.create_task(_safe_run("semgrep",   run_semgrep(project_dir, job_id),   log))
    trivy_task     = asyncio.create_task(_safe_run("trivy",     run_trivy(project_dir, job_id),     log))
    gitleaks_task  = asyncio.create_task(_safe_run("gitleaks",  run_gitleaks(project_dir, job_id),  log))

    semgrep_result, semgrep_err    = await semgrep_task
    trivy_result,   trivy_err      = await trivy_task
    gitleaks_result, gitleaks_err  = await gitleaks_task

    elapsed = time.monotonic() - start
    log.info(f"All scanners finished in {elapsed:.1f}s")

    results: Dict[str, Any] = {}
    errors: Dict[str, str] = {}

    if semgrep_result is not None:
        results["semgrep"] = semgrep_result
    if semgrep_err:
        errors["semgrep"] = semgrep_err

    if trivy_result is not None:
        results["trivy"] = trivy_result
    if trivy_err:
        errors["trivy"] = trivy_err

    if gitleaks_result is not None:
        results["gitleaks"] = gitleaks_result
    if gitleaks_err:
        errors["gitleaks"] = gitleaks_err

    log.info(f"Scanner summary: {len(results)} succeeded, {len(errors)} failed/skipped")
    return results, errors


async def _safe_run(
    name: str,
    coro: Any,
    log: JobLogger,
) -> Tuple[Any, str]:
    """
    Wraps a scanner coroutine so that exceptions are caught and returned
    as an error string instead of propagating.
    """
    try:
        result = await coro
        return result, ""
    except Exception as exc:
        log.error(f"Scanner '{name}' failed: {exc}")
        return None, str(exc)
