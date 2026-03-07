"""
CORS Configuration Analyzer — SecureTrail
Detects dangerous CORS policies:
  - Wildcard origin with credentials
  - Dynamic origin reflection without validation
  - Overly permissive allowed headers/methods
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import List

from Engines.normalization.schema import (
    Confidence,
    NormalizedVulnerability,
    Severity,
    ScannerSource,
    VulnerabilityCategory,
)
from Utils.logger import JobLogger

# Patterns for dangerous CORS configurations
_WILDCARD_ORIGIN = re.compile(r"""origin\s*[:=]\s*["']\*["']""", re.IGNORECASE)
_CREDENTIALS_TRUE = re.compile(r"""credentials\s*[:=]\s*(true|True)""")
_REFLECT_ORIGIN = re.compile(
    r"""origin\s*[:=]\s*(?:req(?:uest)?\.headers?\.origin|req\.get\(['"]origin['"]\))""",
    re.IGNORECASE,
)
_ALLOW_ALL_METHODS = re.compile(r"""methods\s*[:=]\s*["']\*["']|allow_methods\s*=\s*\[["']\*["']\]""", re.IGNORECASE)
_ALLOW_ALL_HEADERS = re.compile(r"""headers\s*[:=]\s*["']\*["']|allow_headers\s*=\s*\[["']\*["']\]""", re.IGNORECASE)


def analyze_cors(project_dir: Path, job_id: str) -> List[NormalizedVulnerability]:
    log = JobLogger(job_id, "analyzer.cors")
    vulns: List[NormalizedVulnerability] = []

    target_files = (
        list(project_dir.rglob("*.js"))
        + list(project_dir.rglob("*.ts"))
        + list(project_dir.rglob("*.py"))
    )

    for fpath in target_files:
        try:
            content = fpath.read_text(errors="replace")
        except Exception:
            continue

        rel = str(fpath.relative_to(project_dir))
        lines = content.splitlines()

        has_wildcard = bool(_WILDCARD_ORIGIN.search(content))
        has_credentials = bool(_CREDENTIALS_TRUE.search(content))
        has_reflect = bool(_REFLECT_ORIGIN.search(content))

        # 1. Wildcard + credentials — most dangerous combination
        if has_wildcard and has_credentials:
            m = _WILDCARD_ORIGIN.search(content)
            line_num = content[: m.start()].count("\n") + 1 if m else 0
            vulns.append(NormalizedVulnerability(
                type="cors-wildcard-with-credentials",
                category=VulnerabilityCategory.CORS,
                title="CORS wildcard origin with credentials=true",
                description=(
                    "Setting origin='*' with credentials=true violates the CORS spec "
                    "and enables credential theft from any origin."
                ),
                file=rel,
                line=line_num,
                code_snippet=lines[line_num - 1].strip() if line_num and line_num <= len(lines) else None,
                severity=Severity.CRITICAL,
                confidence=Confidence.HIGH,
                source=ScannerSource.INTERNAL_CORS,
                owasp_id="A05:2021",
                metadata={
                    "is_public_endpoint": True,
                    "sensitive_data_exposed": True,
                },
            ))
        elif has_wildcard:
            m = _WILDCARD_ORIGIN.search(content)
            line_num = content[: m.start()].count("\n") + 1 if m else 0
            vulns.append(NormalizedVulnerability(
                type="cors-wildcard-origin",
                category=VulnerabilityCategory.CORS,
                title="CORS configured with wildcard origin (*)",
                description=(
                    "Any website can access this API's resources. "
                    "Restrict 'origin' to explicit trusted domains."
                ),
                file=rel,
                line=line_num,
                severity=Severity.MEDIUM,
                confidence=Confidence.HIGH,
                source=ScannerSource.INTERNAL_CORS,
                owasp_id="A05:2021",
                metadata={"is_public_endpoint": True},
            ))

        # 2. Reflected origin without validation
        if has_reflect and not has_wildcard:
            m = _REFLECT_ORIGIN.search(content)
            line_num = content[: m.start()].count("\n") + 1 if m else 0
            vulns.append(NormalizedVulnerability(
                type="cors-reflected-origin",
                category=VulnerabilityCategory.CORS,
                title="CORS origin reflected from request header without whitelist validation",
                description=(
                    "The server echoes back the Origin header without checking against "
                    "an allowlist, permitting any externally controlled origin to make requests."
                ),
                file=rel,
                line=line_num,
                severity=Severity.HIGH,
                confidence=Confidence.MEDIUM,
                source=ScannerSource.INTERNAL_CORS,
                owasp_id="A05:2021",
                metadata={"is_public_endpoint": True},
            ))

        # 3. Allow all methods
        for m in _ALLOW_ALL_METHODS.finditer(content):
            line_num = content[: m.start()].count("\n") + 1
            vulns.append(NormalizedVulnerability(
                type="cors-allow-all-methods",
                category=VulnerabilityCategory.CORS,
                title="CORS allows all HTTP methods",
                description="Allowing all HTTP methods via '*' expands the exposure surface unnecessarily.",
                file=rel,
                line=line_num,
                severity=Severity.LOW,
                confidence=Confidence.HIGH,
                source=ScannerSource.INTERNAL_CORS,
                owasp_id="A05:2021",
                metadata={},
            ))

    log.info(f"CORS analysis complete: {len(vulns)} findings")
    return vulns
