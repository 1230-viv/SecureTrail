"""
npm audit Dependency Scanner — SecureTrail
Detects CVEs in Node.js project dependencies.
Runs in the project directory; validates package.json presence first.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any, Dict

from Utils.logger import JobLogger

SCAN_TIMEOUT = int(__import__("os").getenv("NPM_AUDIT_TIMEOUT", "120"))


async def run_npm_audit(project_dir: Path, job_id: str) -> Dict[str, Any]:
    """
    Run `npm audit --json` in project_dir.
    Returns the raw npm audit JSON output.
    """
    log = JobLogger(job_id, "scanner.npm_audit")

    # Resolve the actual project root that contains package.json
    pkg_json = _find_package_json(project_dir)
    if pkg_json is None:
        log.info("No package.json found — skipping npm audit")
        return {"skipped": True, "reason": "No package.json found"}

    work_dir = str(pkg_json.parent.resolve())
    log.info(f"Running npm audit in {work_dir}")

    # Install dependencies first (required for audit in npm v7+)
    await _npm_install(work_dir, log)

    cmd = ["npm", "audit", "--json"]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=work_dir,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=SCAN_TIMEOUT)
    except asyncio.TimeoutError:
        log.error("npm audit timed out")
        raise RuntimeError("npm audit timed out")
    except FileNotFoundError:
        log.error("npm not found on PATH")
        raise RuntimeError("npm not installed")

    raw = stdout.decode("utf-8", errors="replace")
    # npm audit exits non-zero when vulnerabilities found — that's expected
    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        log.error("npm audit returned non-JSON output")
        raise RuntimeError("npm audit output unparseable")

    vuln_count = _count_vulnerabilities(result)
    log.info(f"npm audit complete: {vuln_count} vulnerabilities found")
    return result


async def _npm_install(work_dir: str, log: JobLogger) -> None:
    """Run `npm install --package-lock-only` to generate lock file for audit."""
    cmd = ["npm", "install", "--package-lock-only", "--ignore-scripts"]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=work_dir,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.communicate(), timeout=60)
    except Exception as e:
        log.warning(f"npm install failed (continuing anyway): {e}")


def _find_package_json(base: Path) -> Path | None:
    """Search up to 2 levels for package.json."""
    for depth in [0, 1, 2]:
        pattern = "/".join(["*"] * depth + ["package.json"]) if depth > 0 else "package.json"
        matches = list(base.glob(pattern))
        if matches:
            return matches[0]
    return None


def _count_vulnerabilities(audit_json: Dict[str, Any]) -> int:
    meta = audit_json.get("metadata", {})
    vulns = meta.get("vulnerabilities", {})
    if isinstance(vulns, dict):
        return sum(v for v in vulns.values() if isinstance(v, int))
    return 0
