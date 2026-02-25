"""
Trivy Dependency & Vulnerability Scanner — SecureTrail

Replaces npm audit with Trivy, which provides broader coverage:
  - npm / yarn / pnpm (Node.js)
  - pip / Poetry / Pipenv (Python)
  - Gemfile.lock (Ruby)
  - go.sum (Go)
  - pom.xml / build.gradle (Java)
  - Cargo.lock (Rust)
  - Composer.lock (PHP)
  - OS packages (Alpine, Debian, Ubuntu, RHEL, etc.)

Runs via Docker (preferred, isolated) or direct Trivy CLI.
Output: Trivy JSON schema v2.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
from pathlib import Path
from typing import Any, Dict

from Utils.logger import JobLogger

SCAN_TIMEOUT    = int(os.getenv("TRIVY_TIMEOUT", "180"))
DOCKER_MEM      = os.getenv("TRIVY_DOCKER_MEM", "512m")
TRIVY_SEVERITY  = os.getenv("TRIVY_SEVERITY", "UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL")
TRIVY_IMAGE     = os.getenv("TRIVY_IMAGE", "aquasec/trivy:latest")


async def run_trivy(project_dir: Path, job_id: str) -> Dict[str, Any]:
    """
    Execute Trivy filesystem scan against project_dir.

    Returns the raw parsed Trivy JSON report dict.
    Raises RuntimeError on total failure (caller handles gracefully).
    """
    log = JobLogger(job_id, "scanner.trivy")
    log.info(f"Starting Trivy scan on {project_dir}")

    abs_dir = str(project_dir.resolve())
    use_docker = shutil.which("docker") is not None
    use_cli = shutil.which("trivy") is not None

    if use_docker:
        result = await _run_docker(abs_dir, log)
    elif use_cli:
        result = await _run_cli(abs_dir, log)
    else:
        log.warning("Neither Docker nor Trivy CLI available — skipping Trivy scan")
        return {"skipped": True, "reason": "Trivy not available", "Results": []}

    total = sum(
        len(r.get("Vulnerabilities") or [])
        for r in result.get("Results", [])
    )
    log.info(f"Trivy complete: {total} vulnerabilities across {len(result.get('Results', []))} targets")
    return result


# ──────────────────────────────────────────────────────────────────────────────
# Docker execution
# ──────────────────────────────────────────────────────────────────────────────

# Persistent host-side cache for the Trivy vulnerability DB.
# Reused across scans so the DB is only downloaded once, not every run.
_TRIVY_CACHE_DIR = os.getenv("TRIVY_CACHE_DIR", "/tmp/securetrail_trivy_cache")


def _trivy_db_exists() -> bool:
    """Check whether the Trivy vuln DB has been downloaded at least once."""
    db_path = os.path.join(_TRIVY_CACHE_DIR, "db", "trivy.db")
    return os.path.exists(db_path)


async def _run_docker(abs_dir: str, log: JobLogger) -> Dict[str, Any]:
    """Run Trivy inside Docker.

    The vulnerability DB is cached in _TRIVY_CACHE_DIR on the host and
    bind-mounted into the container so it survives between scans.
    Network access is allowed so Trivy can download/update the DB.
    """
    os.makedirs(_TRIVY_CACHE_DIR, exist_ok=True)

    # Only skip the DB update when a local DB already exists to avoid the
    # "cannot skip on first run" fatal error.
    skip_db_flag = ["--skip-db-update"] if _trivy_db_exists() else []

    cmd = [
        "docker", "run", "--rm",
        "--memory", DOCKER_MEM,
        "-v", f"{abs_dir}:/scan:ro",
        "-v", f"{_TRIVY_CACHE_DIR}:/root/.cache/trivy",
        TRIVY_IMAGE,
        "fs",
        "--format", "json",
        "--severity", TRIVY_SEVERITY,
        "--no-progress",
        *skip_db_flag,
        "/scan",
    ]
    return await _exec(cmd, log, timeout=SCAN_TIMEOUT)


# ──────────────────────────────────────────────────────────────────────────────
# Direct CLI execution
# ──────────────────────────────────────────────────────────────────────────────

async def _run_cli(abs_dir: str, log: JobLogger) -> Dict[str, Any]:
    """Run Trivy CLI directly (less isolated, but usable in dev environments)."""
    log.warning("Using direct Trivy CLI — Docker preferred for production isolation")
    cmd = [
        "trivy", "fs",
        "--format", "json",
        "--severity", TRIVY_SEVERITY,
        "--no-progress",
        abs_dir,
    ]
    return await _exec(cmd, log, timeout=SCAN_TIMEOUT)


# ──────────────────────────────────────────────────────────────────────────────
# Shared execution helper
# ──────────────────────────────────────────────────────────────────────────────

async def _exec(cmd: list, log: JobLogger, timeout: int) -> Dict[str, Any]:
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        log.error("Trivy scan timed out")
        raise RuntimeError("Trivy timed out")
    except FileNotFoundError as exc:
        log.error(f"Trivy/Docker binary not found: {exc}")
        raise RuntimeError("Trivy not installed") from exc

    stderr_text = stderr.decode("utf-8", errors="replace")
    if stderr_text:
        log.debug(f"Trivy stderr: {stderr_text[:500]}")

    raw = stdout.decode("utf-8", errors="replace").strip()
    if not raw:
        log.warning("Trivy produced no output — returning empty result")
        return {"SchemaVersion": 2, "Results": [], "skipped": False}

    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        log.error(f"Trivy returned non-JSON output: {raw[:200]}")
        raise RuntimeError("Trivy output unparseable") from exc
