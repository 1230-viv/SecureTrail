"""
JWT & Authentication Analyzer — SecureTrail
Checks for insecure JWT usage patterns in JavaScript/TypeScript/Python files.
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

_WEAK_ALGO_PATTERN = re.compile(r"""algorithm\s*[:=]\s*["']?(none|HS1|HS128)["']?""", re.IGNORECASE)
_NO_VERIFY_PATTERN = re.compile(r"""jwt\.decode\s*\(""", re.IGNORECASE)
_VERIFY_SKIP_PATTERN = re.compile(r"""verify_signature\s*[:=]\s*False|algorithms\s*=\s*\[\s*["']none["']""", re.IGNORECASE)
_HARDCODED_SECRET_PATTERN = re.compile(r"""(?:jwt_secret|JWT_SECRET|jwtSecret)\s*[=:]\s*["'][^"'\s]{4,}["']""")
_NO_EXPIRY_PATTERN = re.compile(r"""jwt\.sign\s*\((?:[^)]{0,300})\)""", re.DOTALL)
_EXPIRY_PATTERN = re.compile(r"""expiresIn|exp\s*:""", re.IGNORECASE)


def analyze_jwt(project_dir: Path, job_id: str) -> List[NormalizedVulnerability]:
    log = JobLogger(job_id, "analyzer.jwt")
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

        rel = str(fpath)
        lines = content.splitlines()

        # 1. Weak / none algorithm
        for m in _WEAK_ALGO_PATTERN.finditer(content):
            line_num = content[: m.start()].count("\n") + 1
            vulns.append(NormalizedVulnerability(
                type="jwt-weak-algorithm",
                category=VulnerabilityCategory.JWT,
                title="JWT signed with weak or 'none' algorithm",
                description=(
                    f"JWT is configured with an insecure algorithm ({m.group()}) "
                    f"allowing token forgery."
                ),
                file=str(fpath.relative_to(project_dir)),
                line=line_num,
                code_snippet=lines[line_num - 1].strip() if line_num <= len(lines) else None,
                severity=Severity.CRITICAL,
                confidence=Confidence.HIGH,
                source=ScannerSource.INTERNAL_JWT,
                owasp_id="A07:2021",
                metadata={"matched": m.group()},
            ))

        # 2. jwt.decode without verification (Python: PyJWT)
        for m in _NO_VERIFY_PATTERN.finditer(content):
            line_num = content[: m.start()].count("\n") + 1
            # Check if options={"verify_signature": False} is nearby
            snippet = content[m.start(): m.start() + 300]
            if _VERIFY_SKIP_PATTERN.search(snippet):
                vulns.append(NormalizedVulnerability(
                    type="jwt-signature-verification-disabled",
                    category=VulnerabilityCategory.JWT,
                    title="JWT signature verification disabled",
                    description=(
                        "jwt.decode() is called with signature verification disabled, "
                        "allowing attacker-crafted tokens to be accepted."
                    ),
                    file=str(fpath.relative_to(project_dir)),
                    line=line_num,
                    severity=Severity.CRITICAL,
                    confidence=Confidence.HIGH,
                    source=ScannerSource.INTERNAL_JWT,
                    owasp_id="A07:2021",
                    metadata={"automated_exploit": True},
                ))

        # 3. Hardcoded JWT secret
        for m in _HARDCODED_SECRET_PATTERN.finditer(content):
            line_num = content[: m.start()].count("\n") + 1
            vulns.append(NormalizedVulnerability(
                type="jwt-hardcoded-secret",
                category=VulnerabilityCategory.JWT,
                title="JWT secret hardcoded in source code",
                description=(
                    "The JWT signing secret appears to be hardcoded. "
                    "An attacker who reads the source code can forge tokens."
                ),
                file=str(fpath.relative_to(project_dir)),
                line=line_num,
                code_snippet=lines[line_num - 1].strip() if line_num <= len(lines) else None,
                severity=Severity.HIGH,
                confidence=Confidence.HIGH,
                source=ScannerSource.INTERNAL_JWT,
                owasp_id="A07:2021",
                metadata={"sensitive_data_exposed": True},
            ))

        # 4. JWT sign without expiry
        for m in _NO_EXPIRY_PATTERN.finditer(content):
            snippet = m.group()
            if "jwt.sign" in snippet.lower() and not _EXPIRY_PATTERN.search(snippet):
                line_num = content[: m.start()].count("\n") + 1
                vulns.append(NormalizedVulnerability(
                    type="jwt-no-expiry",
                    category=VulnerabilityCategory.JWT,
                    title="JWT issued without expiration",
                    description=(
                        "jwt.sign() call does not include 'expiresIn'. "
                        "Tokens never expire, allowing permanent session hijacking."
                    ),
                    file=str(fpath.relative_to(project_dir)),
                    line=line_num,
                    severity=Severity.MEDIUM,
                    confidence=Confidence.MEDIUM,
                    source=ScannerSource.INTERNAL_JWT,
                    owasp_id="A07:2021",
                    metadata={},
                ))

    log.info(f"JWT analysis complete: {len(vulns)} findings")
    return vulns
