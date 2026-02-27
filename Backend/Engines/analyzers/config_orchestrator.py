"""
Configuration Analysis Orchestrator — SecureTrail
Runs all internal static analyzers (JWT, CORS, Auth Routes, Rate Limiting,
File Upload, Access Control) in parallel and returns structured results.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict, List

from Engines.analyzers.auth_route_analyzer import analyze_routes
from Engines.analyzers.cors_analyzer import analyze_cors
from Engines.analyzers.jwt_analyzer import analyze_jwt
from Engines.analyzers.rate_limit_analyzer import analyze_rate_limiting
from Engines.analyzers.file_upload_analyzer import analyze_file_upload
from Engines.analyzers.access_control_analyzer import analyze_access_control
from Engines.normalization.schema import NormalizedVulnerability
from Utils.logger import JobLogger


async def run_config_analyzers(
    project_dir: Path,
    job_id: str,
) -> tuple[List[NormalizedVulnerability], Dict[str, Any]]:
    """
    Run all configuration analyzers concurrently (using executor since they
    are CPU-bound file reads).
    Returns (all_findings, summary_dict).
    """
    log = JobLogger(job_id, "config_orchestrator")
    log.info("Running all configuration analyzers")

    loop = asyncio.get_event_loop()

    # Run analyzers in thread pool to avoid blocking event loop on file I/O
    auth_task   = loop.run_in_executor(None, analyze_routes, project_dir, job_id)
    cors_task   = loop.run_in_executor(None, analyze_cors, project_dir, job_id)
    jwt_task    = loop.run_in_executor(None, analyze_jwt, project_dir, job_id)
    rate_task   = loop.run_in_executor(None, analyze_rate_limiting, project_dir, job_id)
    upload_task = loop.run_in_executor(None, analyze_file_upload, project_dir, job_id)
    ac_task     = loop.run_in_executor(None, analyze_access_control, project_dir, job_id)

    auth_vulns, cors_vulns, jwt_vulns, rate_vulns, upload_vulns, ac_vulns = await asyncio.gather(
        auth_task, cors_task, jwt_task, rate_task, upload_task, ac_task,
        return_exceptions=True,
    )

    all_vulns: List[NormalizedVulnerability] = []
    summary: Dict[str, Any] = {}

    def _collect(name: str, result: Any) -> None:
        if isinstance(result, Exception):
            log.error(f"Analyzer '{name}' failed: {result}")
            summary[name] = {"count": 0, "error": str(result)}
        else:
            all_vulns.extend(result)
            summary[name] = {"count": len(result)}

    _collect("auth_routes", auth_vulns)
    _collect("cors", cors_vulns)
    _collect("jwt", jwt_vulns)
    _collect("rate_limiting", rate_vulns)
    _collect("file_upload", upload_vulns)
    _collect("access_control", ac_vulns)

    log.info(f"Config analysis complete: {len(all_vulns)} findings from all analyzers")
    return all_vulns, summary
