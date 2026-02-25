"""
Gitleaks Secret Scanner — SecureTrail
Detects hardcoded secrets, API keys, tokens, and credentials.
Runs as a Docker container or direct CLI with JSON output.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict, List

from Utils.logger import JobLogger

SCAN_TIMEOUT = int(os.getenv("GITLEAKS_TIMEOUT", "120"))
DOCKER_MEMORY_LIMIT = os.getenv("GITLEAKS_DOCKER_MEM", "256m")


async def run_gitleaks(project_dir: Path, job_id: str) -> Dict[str, Any]:
    """
    Run Gitleaks against project_dir.
    Returns a dict with a 'findings' list and metadata.
    """
    log = JobLogger(job_id, "scanner.gitleaks")
    log.info(f"Starting Gitleaks scan on {project_dir}")

    abs_dir = str(project_dir.resolve())
    report_path = project_dir.parent / f"gitleaks_report_{job_id}.json"

    use_docker = shutil.which("docker") is not None
    use_cli = shutil.which("gitleaks") is not None

    if use_docker:
        cmd = [
            "docker", "run", "--rm",
            "--memory", DOCKER_MEMORY_LIMIT,
            "--network", "none",
            "-v", f"{abs_dir}:/path",
            "-v", f"{str(project_dir.parent.resolve())}:/reports",
            "zricethezav/gitleaks:latest",
            "detect",
            "--source=/path",
            "--report-path=/reports/gitleaks_report.json",
            "--report-format=json",
            "--no-git",
            "--exit-code=0",
        ]
    elif use_cli:
        cmd = [
            "gitleaks", "detect",
            "--source", abs_dir,
            "--report-path", str(report_path),
            "--report-format", "json",
            "--no-git",
            "--exit-code=0",
        ]
    else:
        log.warning("Neither Docker nor gitleaks CLI available — skipping secret scan")
        return {"skipped": True, "reason": "Gitleaks not available", "findings": []}

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=SCAN_TIMEOUT)
    except asyncio.TimeoutError:
        log.error("Gitleaks timed out")
        raise RuntimeError("Gitleaks timed out")

    # Determine report file location
    if use_docker:
        report_path = project_dir.parent / "gitleaks_report.json"

    findings: List[Dict[str, Any]] = []
    if report_path.exists():
        try:
            with open(report_path) as f:
                content = f.read().strip()
                if content:
                    findings = json.loads(content)
                    if not isinstance(findings, list):
                        findings = []
        except (json.JSONDecodeError, IOError) as e:
            log.warning(f"Could not parse Gitleaks report: {e}")
        finally:
            try:
                report_path.unlink()
            except Exception:
                pass

    log.info(f"Gitleaks complete: {len(findings)} secret findings")
    return {"findings": findings, "skipped": False}
