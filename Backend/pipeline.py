"""
SecureTrail Master Scan Pipeline
Orchestrates the complete security analysis workflow:

  Extract → Scan → Normalize → Score → Correlate → Config Analysis →
  Business Impact → AI Explanation → Structured Report

Each stage updates job progress so the frontend can poll status in real time.
"""

from __future__ import annotations

import datetime
import traceback
from pathlib import Path
from typing import Any, Dict, Optional

from Engines.ai.explanation_engine import explain_vulnerabilities
from Engines.analyzers.config_orchestrator import run_config_analyzers
from Engines.business_impact.impact_engine import enrich_business_impact
from Engines.correlation.correlator import correlate_vulnerabilities
from Engines.exploitability.scorer import score_vulnerabilities
from Engines.normalization.normalizer import normalize_all
from Engines.normalization.schema import ScanReport, Severity
from Jobs.job_manager import JobStatus, job_manager
from Scanners.orchestrator import run_all_scanners
from Utils.logger import JobLogger
from Utils.temp_manager import cleanup_job_directory


async def run_scan_pipeline(
    job_id: str,
    project_dir: Path,
    repository_name: str,
    cleanup_after: bool = True,
) -> ScanReport:
    """
    Full scan pipeline for a job.
    Handles all errors internally — always returns a ScanReport.
    Updates job_manager at each stage for frontend progress polling.
    """
    log = JobLogger(job_id, "pipeline")
    scan_errors: list[str] = []
    scanner_results: Dict[str, Any] = {}

    def _progress(pct: int, stage: str) -> None:
        job_manager.update_job(job_id, progress=pct, stage=stage)
        log.info(f"Stage: {stage} ({pct}%)")

    try:
        # ── 1. Scanners ──────────────────────────────────────────────────────
        _progress(5, "running_scanners")
        scanner_results, scanner_errors = await run_all_scanners(project_dir, job_id)
        scan_errors.extend(
            f"Scanner '{k}' failed: {v}" for k, v in scanner_errors.items()
        )

        # ── 2. Normalization ─────────────────────────────────────────────────
        _progress(30, "normalizing")
        vulns = normalize_all(scanner_results, job_id)

        # ── 3. Exploitability Scoring ─────────────────────────────────────────
        _progress(45, "scoring")
        vulns = score_vulnerabilities(vulns, job_id)

        # ── 4. Correlation ───────────────────────────────────────────────────
        _progress(55, "correlating")
        vulns, correlation_summary = correlate_vulnerabilities(vulns, job_id)

        # ── 5. Configuration Analyzers ────────────────────────────────────────
        _progress(65, "config_analysis")
        config_vulns, config_summary = await run_config_analyzers(project_dir, job_id)
        # Score the config findings too
        config_vulns = score_vulnerabilities(config_vulns, job_id)
        vulns.extend(config_vulns)
        # Re-sort after merge
        vulns.sort(
            key=lambda v: (v.exploitability.score if v.exploitability else 0),
            reverse=True,
        )

        # ── 6. Business Impact ───────────────────────────────────────────────
        _progress(75, "business_impact")
        vulns = enrich_business_impact(vulns, job_id)

        # ── 7. AI Explanations ───────────────────────────────────────────────
        _progress(85, "ai_analysis")
        vulns, executive_summary = await explain_vulnerabilities(
            vulns, repository_name, job_id
        )

        # ── 8. Build Final Report ────────────────────────────────────────────
        _progress(95, "building_report")
        report = _build_report(
            job_id=job_id,
            repository_name=repository_name,
            vulns=vulns,
            scanner_results=scanner_results,
            scanner_errors=scanner_errors,
            correlation_summary=correlation_summary,
            config_summary=config_summary,
            executive_summary=executive_summary,
            scan_errors=scan_errors,
        )

        # ── 9. Finalize ──────────────────────────────────────────────────────
        status = JobStatus.PARTIAL if scan_errors else JobStatus.COMPLETED
        job_manager.update_job(
            job_id,
            status=status,
            progress=100,
            stage="completed",
            result=report.dict(),
        )
        log.info(
            f"Scan complete: {report.total_vulnerabilities} vulns | "
            f"CRITICAL:{report.critical_count} HIGH:{report.high_count}"
        )
        return report

    except Exception as exc:
        log.exception(f"Pipeline failed: {exc}")
        tb = traceback.format_exc()
        job_manager.update_job(
            job_id,
            status=JobStatus.FAILED,
            stage="failed",
            error=str(exc),
        )
        # Return minimal failure report
        return ScanReport(
            job_id=job_id,
            repository_name=repository_name,
            scan_timestamp=_now(),
            status="failed",
            scan_errors=[str(exc), tb],
        )
    finally:
        if cleanup_after:
            cleanup_job_directory(job_id)


def _build_report(
    *,
    job_id: str,
    repository_name: str,
    vulns: list,
    scanner_results: Dict[str, Any],
    scanner_errors: Dict[str, str],
    correlation_summary: list,
    config_summary: Dict[str, Any],
    executive_summary: Optional[Dict[str, Any]],
    scan_errors: list[str],
) -> ScanReport:
    counts = {
        "CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0,
    }
    for v in vulns:
        sev = v.severity.upper() if isinstance(v.severity, str) else v.severity.value
        if sev in counts:
            counts[sev] += 1

    scanner_meta: Dict[str, Any] = {}
    for name, raw in scanner_results.items():
        scanner_meta[name] = {
            "status": "success",
            "skipped": raw.get("skipped", False),
        }
    for name, err in scanner_errors.items():
        scanner_meta[name] = {"status": "error", "error": err}

    risk_summary = {
        "total": len(vulns),
        "by_severity": counts,
        "top_categories": _top_categories(vulns),
        "executive_summary": executive_summary,
    }

    return ScanReport(
        job_id=job_id,
        repository_name=repository_name,
        scan_timestamp=_now(),
        status="completed" if not scan_errors else "partial",
        total_vulnerabilities=len(vulns),
        critical_count=counts["CRITICAL"],
        high_count=counts["HIGH"],
        medium_count=counts["MEDIUM"],
        low_count=counts["LOW"],
        info_count=counts["INFO"],
        scanner_results=scanner_meta,
        vulnerabilities=vulns,
        correlation_summary=correlation_summary,
        configuration_analysis=config_summary,
        risk_summary=risk_summary,
        scan_errors=scan_errors,
    )


def _top_categories(vulns: list) -> list:
    from collections import Counter
    counts = Counter(
        (v.category if isinstance(v.category, str) else v.category.value)
        for v in vulns
    )
    return [
        {"category": cat, "count": cnt}
        for cat, cnt in counts.most_common(5)
    ]


def _now() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"
