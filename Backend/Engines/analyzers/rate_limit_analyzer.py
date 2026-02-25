"""
Rate Limiting & Abuse Protection Analyzer — SecureTrail
Detects missing or misconfigured rate limiting on sensitive endpoints.
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

_RATE_LIMIT_IMPORT = re.compile(
    r"""require\s*\(\s*['"]express-rate-limit['"]\s*\)|from\s+['"]express-rate-limit['"]|"
    r"slowDown|rate_limit|ratelimit|throttle""",
    re.IGNORECASE,
)

_LOGIN_ROUTE = re.compile(
    r"""(?:app|router)\.(post|get)\s*\(\s*["'][^"']*(?:login|signin|authenticate|auth)[^"']*["']""",
    re.IGNORECASE,
)

_PASSWORD_RESET_ROUTE = re.compile(
    r"""(?:app|router)\.(post|get)\s*\(\s*["'][^"']*(?:reset|forgot|password)[^"']*["']""",
    re.IGNORECASE,
)

_REGISTER_ROUTE = re.compile(
    r"""(?:app|router)\.(post|get)\s*\(\s*["'][^"']*(?:register|signup|sign.up)[^"']*["']""",
    re.IGNORECASE,
)


def analyze_rate_limiting(project_dir: Path, job_id: str) -> List[NormalizedVulnerability]:
    log = JobLogger(job_id, "analyzer.rate_limit")
    vulns: List[NormalizedVulnerability] = []

    js_files = list(project_dir.rglob("*.js")) + list(project_dir.rglob("*.ts"))

    for fpath in js_files:
        try:
            content = fpath.read_text(errors="replace")
        except Exception:
            continue

        rel = str(fpath.relative_to(project_dir))
        has_rate_limit = bool(_RATE_LIMIT_IMPORT.search(content))

        if not has_rate_limit:
            # Check for sensitive routes that need rate limiting
            for pattern, endpoint_type in [
                (_LOGIN_ROUTE, "login"),
                (_PASSWORD_RESET_ROUTE, "password-reset"),
                (_REGISTER_ROUTE, "registration"),
            ]:
                for m in pattern.finditer(content):
                    line_num = content[: m.start()].count("\n") + 1
                    vulns.append(NormalizedVulnerability(
                        type=f"missing-rate-limit-{endpoint_type}",
                        category=VulnerabilityCategory.RATE_LIMIT,
                        title=f"No rate limiting on {endpoint_type} endpoint",
                        description=(
                            f"The {endpoint_type} endpoint in {fpath.name} has no rate limiting, "
                            f"enabling brute-force and credential stuffing attacks."
                        ),
                        file=rel,
                        line=line_num,
                        code_snippet=content[m.start(): m.end()].strip()[:200],
                        severity=Severity.HIGH if endpoint_type == "login" else Severity.MEDIUM,
                        confidence=Confidence.MEDIUM,
                        source=ScannerSource.INTERNAL_RATE_LIMIT,
                        owasp_id="A07:2021",
                        metadata={
                            "endpoint_type": endpoint_type,
                            "is_public_endpoint": True,
                            "automated_exploit": True,
                        },
                    ))

    log.info(f"Rate limit analysis complete: {len(vulns)} findings")
    return vulns
