"""
Normalization Engine — SecureTrail
Converts all scanner raw outputs into a unified NormalizedVulnerability schema.
Handles deduplication, schema validation, and extensibility for new scanners.
"""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any, Dict, List, Optional, Set

from Engines.normalization.schema import (
    Confidence,
    NormalizedVulnerability,
    Severity,
    ScannerSource,
    VulnerabilityCategory,
)
from Utils.logger import JobLogger

# ──────────────────────────────────────────────────────────────────────────────
# Severity mapping helpers
# ──────────────────────────────────────────────────────────────────────────────

_SEVERITY_MAP: Dict[str, Severity] = {
    "critical": Severity.CRITICAL,
    "high":     Severity.HIGH,
    "medium":   Severity.MEDIUM,
    "moderate": Severity.MEDIUM,
    "low":      Severity.LOW,
    "info":     Severity.INFO,
    "warning":  Severity.INFO,
    "note":     Severity.INFO,
    "error":    Severity.HIGH,
}

_OWASP_MAP: Dict[str, str] = {
    "sql-injection": "A03:2021",
    "xss": "A03:2021",
    "command-injection": "A03:2021",
    "path-traversal": "A01:2021",
    "insecure-deserialization": "A08:2021",
    "broken-auth": "A07:2021",
    "sensitive-data-exposure": "A02:2021",
    "xxe": "A05:2021",
    "security-misconfiguration": "A05:2021",
    "using-components-with-known-vulnerabilities": "A06:2021",
    "csrf": "A01:2021",
    "idor": "A01:2021",
    "open-redirect": "A01:2021",
    "ssrf": "A10:2021",
}

_CATEGORY_KEYWORDS: List[tuple[str, VulnerabilityCategory]] = [
    ("sql", VulnerabilityCategory.INJECTION),
    ("nosql", VulnerabilityCategory.INJECTION),
    ("command", VulnerabilityCategory.INJECTION),
    ("xss", VulnerabilityCategory.XSS),
    ("cross-site", VulnerabilityCategory.XSS),
    ("secret", VulnerabilityCategory.SECRET_EXPOSURE),
    ("token", VulnerabilityCategory.SECRET_EXPOSURE),
    ("api.key", VulnerabilityCategory.SECRET_EXPOSURE),
    ("password", VulnerabilityCategory.SECRET_EXPOSURE),
    ("jwt", VulnerabilityCategory.JWT),
    ("auth", VulnerabilityCategory.BROKEN_AUTH),
    ("idor", VulnerabilityCategory.IDOR),
    ("ssrf", VulnerabilityCategory.SSRF),
    ("redirect", VulnerabilityCategory.OPEN_REDIRECT),
    ("cors", VulnerabilityCategory.CORS),
    ("rate.limit", VulnerabilityCategory.RATE_LIMIT),
    ("upload", VulnerabilityCategory.FILE_UPLOAD),
    ("cve", VulnerabilityCategory.DEPENDENCY_CVE),
    ("path.traversal", VulnerabilityCategory.BROKEN_ACCESS),
    ("sensitive", VulnerabilityCategory.SENSITIVE_EXPOSURE),
    ("misconfigur", VulnerabilityCategory.SECURITY_MISCONFIGURATION),
]


def _coerce_str(value: Any) -> str:
    """Semgrep metadata fields (owasp, cwe) can be a list or a string.
    If a list, join elements with '; '. Always returns a plain string."""
    if isinstance(value, list):
        return "; ".join(str(v) for v in value)
    return str(value) if value is not None else ""


def _map_severity(raw: str) -> Severity:
    return _SEVERITY_MAP.get(raw.lower().strip(), Severity.UNKNOWN)


def _infer_category(text: str) -> VulnerabilityCategory:
    lower = text.lower()
    for keyword, cat in _CATEGORY_KEYWORDS:
        if re.search(keyword, lower):
            return cat
    return VulnerabilityCategory.OTHER


def _dedup_key(vuln: NormalizedVulnerability) -> str:
    """Stable hash for deduplication — same file + line + type."""
    raw = f"{vuln.type}|{vuln.file or ''}|{vuln.line or 0}|{vuln.source}"
    return hashlib.md5(raw.encode()).hexdigest()


# ──────────────────────────────────────────────────────────────────────────────
# Semgrep normalizer
# ──────────────────────────────────────────────────────────────────────────────

def normalize_semgrep(raw: Dict[str, Any], job_id: str) -> List[NormalizedVulnerability]:
    log = JobLogger(job_id, "normalizer.semgrep")
    vulns: List[NormalizedVulnerability] = []

    results = raw.get("results", [])
    if not isinstance(results, list):
        log.warning("Semgrep 'results' field is not a list")
        return []

    for finding in results:
        try:
            extra = finding.get("extra", {})
            metadata = extra.get("metadata", {})
            check_id: str = finding.get("check_id", "unknown")
            message: str = extra.get("message", "")
            severity_raw: str = extra.get("severity", extra.get("lines", "unknown"))
            file_path: str = finding.get("path", "")
            start_line: int = finding.get("start", {}).get("line", 0)
            end_line: int = finding.get("end", {}).get("line", 0)
            code_lines: str = extra.get("lines", "")

            vuln = NormalizedVulnerability(
                type=check_id.split(".")[-1] if "." in check_id else check_id,
                category=_infer_category(f"{check_id} {message}"),
                title=check_id,
                description=message,
                file=file_path,
                line=start_line or None,
                line_end=end_line or None,
                code_snippet=code_lines[:500] if code_lines else None,
                severity=_map_severity(str(extra.get("severity", "medium"))),
                confidence=Confidence.HIGH,
                source=ScannerSource.SEMGREP,
                cwe_id=_coerce_str(metadata.get("cwe", metadata.get("cwe_id", ""))),
                owasp_id=_coerce_str(metadata.get("owasp", "")),
                metadata={
                    "rule_id": check_id,
                    "rule_url": f"https://semgrep.dev/r/{check_id}",
                    "fix": extra.get("fix", ""),
                    "metavars": extra.get("metavars", {}),
                },
            )
            vulns.append(vuln)
        except Exception as e:
            log.warning(f"Failed to normalize semgrep finding: {e}")

    log.info(f"Normalized {len(vulns)}/{len(results)} Semgrep findings")
    return vulns


# ──────────────────────────────────────────────────────────────────────────────
# Trivy normalizer  (schema v2 — filesystem scan output)
# ──────────────────────────────────────────────────────────────────────────────

def normalize_trivy(raw: Dict[str, Any], job_id: str) -> List[NormalizedVulnerability]:
    """
    Normalize Trivy JSON v2 filesystem scan output.
    Handles all language ecosystems Trivy covers:
    npm, pip, gem, go, maven, cargo, composer, OS packages, etc.
    """
    log = JobLogger(job_id, "normalizer.trivy")
    if raw.get("skipped"):
        log.info("Trivy was skipped — nothing to normalize")
        return []

    vulns: List[NormalizedVulnerability] = []
    results = raw.get("Results", [])
    if not isinstance(results, list):
        log.warning("Trivy 'Results' field is not a list")
        return []

    for result_block in results:
        target = result_block.get("Target", "")
        ecosystem = result_block.get("Type", "unknown")
        vulnerabilities = result_block.get("Vulnerabilities") or []

        for finding in vulnerabilities:
            try:
                cve_id     = finding.get("VulnerabilityID", "")
                pkg_name   = finding.get("PkgName", "")
                installed  = finding.get("InstalledVersion", "")
                fixed      = finding.get("FixedVersion", "")
                severity_r = finding.get("Severity", "UNKNOWN")
                title      = finding.get("Title", cve_id)
                desc       = finding.get("Description", "")
                refs       = finding.get("References", [])
                cwe_list   = finding.get("CweIDs", [])
                cwe_id     = cwe_list[0] if cwe_list else None
                primary_url = finding.get("PrimaryURL", refs[0] if refs else "")

                # Extract CVSS v3 score if available
                cvss_score: Any = None
                cvss_block = finding.get("CVSS", {})
                for src in ("nvd", "redhat", "ghsa"):
                    if src in cvss_block:
                        cvss_score = cvss_block[src].get("V3Score")
                        break

                vuln = NormalizedVulnerability(
                    type="dependency-vulnerability",
                    category=VulnerabilityCategory.DEPENDENCY_CVE,
                    title=f"[{pkg_name}] {title}" if title != cve_id else f"[{pkg_name}] {cve_id}",
                    description=desc or title,
                    file=target,
                    severity=_map_severity(severity_r),
                    confidence=Confidence.HIGH,
                    source=ScannerSource.TRIVY,
                    cve_id=cve_id or None,
                    cwe_id=str(cwe_id) if cwe_id else None,
                    owasp_id=_OWASP_MAP.get("using-components-with-known-vulnerabilities", "A06:2021"),
                    metadata={
                        "package": pkg_name,
                        "ecosystem": ecosystem,
                        "installed_version": installed,
                        "fixed_version": fixed,
                        "advisory_url": primary_url,
                        "cvss_v3_score": cvss_score,
                        "references": refs[:5],
                    },
                )
                vulns.append(vuln)
            except Exception as e:
                log.warning(f"Failed to normalize Trivy finding for {finding.get('PkgName', '?')}: {e}")

    log.info(f"Normalized {len(vulns)} Trivy findings across {len(results)} targets")
    return vulns


# ──────────────────────────────────────────────────────────────────────────────
# Gitleaks normalizer
# ──────────────────────────────────────────────────────────────────────────────

def normalize_gitleaks(raw: Dict[str, Any], job_id: str) -> List[NormalizedVulnerability]:
    log = JobLogger(job_id, "normalizer.gitleaks")
    if raw.get("skipped"):
        log.info("Gitleaks was skipped — nothing to normalize")
        return []

    findings = raw.get("findings", [])
    if not isinstance(findings, list):
        return []

    vulns: List[NormalizedVulnerability] = []
    for f in findings:
        try:
            rule_id = f.get("RuleID", f.get("ruleID", "unknown-secret"))
            description = f.get("Description", f.get("description", rule_id))
            file_path = f.get("File", f.get("file", ""))
            line_num = f.get("StartLine", f.get("startLine", 0)) or 0
            secret_glimpse = f.get("Secret", "")[:6] + "..." if f.get("Secret") else ""

            vuln = NormalizedVulnerability(
                type=rule_id,
                category=VulnerabilityCategory.SECRET_EXPOSURE,
                title=f"Hardcoded Secret: {description}",
                description=f"Possible hardcoded secret detected ({description}). "
                            f"Secret preview: '{secret_glimpse}'",
                file=file_path,
                line=line_num or None,
                severity=Severity.CRITICAL,
                confidence=Confidence.HIGH,
                source=ScannerSource.GITLEAKS,
                owasp_id="A07:2021",
                metadata={
                    "rule_id": rule_id,
                    "match": f.get("Match", ""),
                    "author": f.get("Author", ""),
                    "commit": f.get("Commit", ""),
                    "date": f.get("Date", ""),
                    "tags": f.get("Tags", []),
                },
            )
            vulns.append(vuln)
        except Exception as e:
            log.warning(f"Failed to normalize Gitleaks finding: {e}")

    log.info(f"Normalized {len(vulns)} Gitleaks findings")
    return vulns


# ──────────────────────────────────────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────────────────────────────────────

def normalize_all(
    scanner_results: Dict[str, Any],
    job_id: str,
) -> List[NormalizedVulnerability]:
    """
    Normalize all scanner outputs into a de-duplicated list of
    NormalizedVulnerability objects.
    """
    log = JobLogger(job_id, "normalizer")
    log.info("Starting normalization of all scanner outputs")

    all_vulns: List[NormalizedVulnerability] = []

    if "semgrep" in scanner_results:
        all_vulns.extend(normalize_semgrep(scanner_results["semgrep"], job_id))

    if "trivy" in scanner_results:
        all_vulns.extend(normalize_trivy(scanner_results["trivy"], job_id))

    if "gitleaks" in scanner_results:
        all_vulns.extend(normalize_gitleaks(scanner_results["gitleaks"], job_id))

    # Deduplication
    seen: Set[str] = set()
    unique: List[NormalizedVulnerability] = []
    for v in all_vulns:
        key = _dedup_key(v)
        if key not in seen:
            seen.add(key)
            unique.append(v)

    removed = len(all_vulns) - len(unique)
    if removed:
        log.info(f"Deduplication removed {removed} duplicate findings")

    log.info(f"Normalization complete: {len(unique)} unique vulnerabilities")
    return unique
