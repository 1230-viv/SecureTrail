"""
Semgrep SAST Scanner — SecureTrail
Runs Semgrep inside a Docker container with CPU/memory limits.
Falls back to direct semgrep CLI when Docker is unavailable.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any, Dict, List

from Utils.logger import JobLogger

# Semgrep ruleset — configurable via env
SEMGREP_RULES = os.getenv("SEMGREP_RULES", "auto")
DOCKER_MEMORY_LIMIT = os.getenv("SEMGREP_DOCKER_MEM", "512m")
DOCKER_CPU_LIMIT = os.getenv("SEMGREP_DOCKER_CPU", "1")
SCAN_TIMEOUT = int(os.getenv("SEMGREP_TIMEOUT", "180"))


async def run_semgrep(project_dir: Path, job_id: str) -> Dict[str, Any]:
    """
    Execute Semgrep against project_dir.
    Returns the raw parsed JSON output from Semgrep.
    Raises RuntimeError on total failure (caller handles gracefully).
    """
    log = JobLogger(job_id, "scanner.semgrep")
    log.info(f"Starting Semgrep scan on {project_dir}")

    abs_project_dir = str(project_dir.resolve())

    # Prefer Docker for isolation; fall back to direct CLI
    use_docker = _docker_available()

    if use_docker:
        cmd = [
            "docker", "run", "--rm",
            "--memory", DOCKER_MEMORY_LIMIT,
            "--cpus", DOCKER_CPU_LIMIT,
            "--network", "none",
            "-v", f"{abs_project_dir}:/src",
            "semgrep/semgrep:latest",
            "semgrep", "--config", SEMGREP_RULES,
            "--json", "--no-git-ignore",
            "--timeout", "60",
            "/src",
        ]
    else:
        log.warning("Docker not available — running semgrep directly (less isolated)")
        cmd = [
            "semgrep", "--config", SEMGREP_RULES,
            "--json", "--no-git-ignore",
            "--timeout", "60",
            str(project_dir),
        ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=SCAN_TIMEOUT)
    except asyncio.TimeoutError:
        log.error("Semgrep scan timed out")
        raise RuntimeError("Semgrep timed out")
    except FileNotFoundError as exc:
        log.error(f"Semgrep binary not found: {exc}")
        raise RuntimeError("Semgrep not installed") from exc

    raw_output = stdout.decode("utf-8", errors="replace")
    stderr_output = stderr.decode("utf-8", errors="replace")

    if stderr_output:
        log.debug(f"Semgrep stderr: {stderr_output[:500]}")

    try:
        result = json.loads(raw_output)
    except json.JSONDecodeError:
        log.error("Semgrep returned non-JSON output")
        raise RuntimeError("Semgrep output unparseable")

    findings_count = len(result.get("results", []))
    errors_count = len(result.get("errors", []))
    log.info(f"Semgrep complete: {findings_count} findings, {errors_count} errors")

    return result


def _docker_available() -> bool:
    """Quick synchronous check — avoids spawning a process."""
    import shutil
    return shutil.which("docker") is not None
