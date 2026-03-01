"""
SecureTrail Master Scan Pipeline
Orchestrates the complete security analysis workflow:

  Extract → Scan → Normalize → Score → Correlate → Config Analysis →
  Business Impact → Build Report → AI Explanation (background)

Each stage updates job progress so the frontend can poll status in real time.
AI explanations run as a background task after the report is delivered,
enabling progressive UI rendering.
"""

from __future__ import annotations

import asyncio
import datetime
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional

from Database.connection import get_session
from Database.repositories import scan_repo as _scan_repo

from Engines.ai.explanation_engine import explain_vulnerabilities
from Engines.analyzers.config_orchestrator import run_config_analyzers
from Engines.business_impact.impact_engine import enrich_business_impact, enrich_business_impact_static
from Engines.correlation.correlator import correlate_vulnerabilities
from Engines.exploitability.scorer import score_vulnerabilities
from Engines.normalization.normalizer import normalize_all
from Engines.normalization.schema import NormalizedVulnerability, ScanReport, Severity
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

        # ── 6. Business Impact (static placeholder — AI enriches in background) ──
        _progress(75, "business_impact")
        vulns = enrich_business_impact_static(vulns, job_id)

        # ── 7. Build Report (before AI — enables progressive UI) ────────────
        _progress(90, "building_report")
        report = _build_report(
            job_id=job_id,
            repository_name=repository_name,
            vulns=vulns,
            scanner_results=scanner_results,
            scanner_errors=scanner_errors,
            correlation_summary=correlation_summary,
            config_summary=config_summary,
            executive_summary=None,          # AI hasn't run yet
            scan_errors=scan_errors,
        )

        # ── 8. Finalize — report is available immediately ─────────────────
        status = JobStatus.PARTIAL if scan_errors else JobStatus.COMPLETED
        report_dict = report.dict()
        report_dict["ai_pending"] = True     # signal frontend that AI is coming

        job_manager.update_job(
            job_id,
            status=status,
            progress=100,
            stage="completed",
            result=report_dict,
            ai_status="not_started",
            ai_total=len(vulns),
        )
        log.info(
            f"Scan complete: {report.total_vulnerabilities} vulns | "
            f"CRITICAL:{report.critical_count} HIGH:{report.high_count}"
        )

        # Persist initial result to database
        try:
            async with get_session() as db:
                await _scan_repo.update_scan_job(
                    db, job_id,
                    status=status.value,
                    progress=100,
                    stage="completed",
                    total_vulnerabilities=report.total_vulnerabilities,
                    critical_count=report.critical_count,
                    high_count=report.high_count,
                    medium_count=report.medium_count,
                    low_count=report.low_count,
                    info_count=report.info_count,
                    result_json=report_dict,
                    completed_at=datetime.datetime.now(datetime.timezone.utc),
                )
        except Exception as _db_exc:
            log.warning(f"Failed to persist scan result to DB: {_db_exc}")

        # ── 9. Launch AI in background (non-blocking) ────────────────────
        asyncio.create_task(
            _run_ai_background(job_id, vulns, repository_name)
        )

        # ── 10. Archive ZIP to S3 (7-day auto-deletion) ─────────────────────
        # Move the ZIP file to archive/ folder for automatic lifecycle deletion
        try:
            from Utils.s3_manager import move_to_archive
            
            # Get current S3 URL from database
            async with get_session() as db:
                job_record = await _scan_repo.get_scan_job(db, job_id)
                if job_record and job_record.s3_url:
                    log.info(f"Moving ZIP to archive folder: {job_record.s3_url}")
                    archive_url = move_to_archive(job_record.s3_url)
                    if archive_url:
                        # Update database with new archive URL
                        await _scan_repo.update_scan_job(db, job_id, s3_url=archive_url)
                        # No need to call commit() - get_session() auto-commits
                        log.info(f"ZIP archived successfully: {archive_url}")
                    else:
                        log.warning("Failed to move ZIP to archive")
                else:
                    log.debug("No S3 URL found for archiving")
        except Exception as archive_exc:
            log.warning(f"Archive operation failed (non-critical): {archive_exc}")

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
        # Persist failure to database
        try:
            async with get_session() as db:
                await _scan_repo.update_scan_job(
                    db, job_id,
                    status="failed",
                    stage="failed",
                    error_message=str(exc),
                    completed_at=datetime.datetime.now(datetime.timezone.utc),
                )
        except Exception as _db_exc:
            log.warning(f"Failed to persist job failure to DB: {_db_exc}")
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


# ── Background AI Task ───────────────────────────────────────────────────────

async def _run_ai_background(
    job_id: str,
    vulns: List[NormalizedVulnerability],
    repository_name: str,
) -> None:
    """
    Run AI explanations as a background task after the report is already
    delivered to the frontend.  Updates the job result in-place so the
    frontend can poll for progressive AI enrichment.
    """
    log = JobLogger(job_id, "pipeline_ai")
    try:
        log.info(f"Background AI analysis started for {len(vulns)} vulns")
        job_manager.update_job(job_id, ai_status="in_progress")

        # Run AI explanation and AI business impact concurrently
        vulns, executive_summary = await explain_vulnerabilities(
            vulns, repository_name, job_id
        )

        # Enrich business impact with AI (replaces static placeholders set earlier)
        try:
            vulns = await asyncio.to_thread(enrich_business_impact, vulns, job_id)
        except Exception as _bi_exc:
            log.warning(f"AI business impact enrichment failed, keeping static data: {_bi_exc}")

        # Update the job result with AI-enriched vulnerabilities
        job = job_manager.get_job(job_id)
        if job and job.result:
            job.result["vulnerabilities"] = [v.dict() for v in vulns]
            if executive_summary:
                job.result.setdefault("risk_summary", {})["executive_summary"] = executive_summary
            job.result["ai_pending"] = False
            job.updated_at = time.time()

        job_manager.update_job(
            job_id,
            ai_status="complete",
            ai_done=len(vulns),
        )

        # Persist AI-enriched result to database
        try:
            async with get_session() as db:
                await _scan_repo.update_scan_job(
                    db, job_id,
                    result_json=job.result if job else None,
                )
        except Exception as db_exc:
            log.warning(f"Failed to persist AI results to DB: {db_exc}")

        log.info("Background AI analysis completed")

    except Exception as e:
        log.warning(f"Background AI analysis failed: {e}")
        # Mark AI as done (failed) so frontend stops waiting
        job = job_manager.get_job(job_id)
        if job and job.result:
            job.result["ai_pending"] = False
            job.updated_at = time.time()
        job_manager.update_job(job_id, ai_status="complete")


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
