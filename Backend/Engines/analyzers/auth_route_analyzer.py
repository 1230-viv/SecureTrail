"""
Authorization & Route Mapping Analyzer — SecureTrail
Parses Express/Node.js and FastAPI route definitions to detect:
  - Endpoints missing authentication middleware
  - Missing role/permission validation
  - Suspicious admin routes
  - Potential IDOR patterns
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List

from Engines.normalization.schema import (
    Confidence,
    NormalizedVulnerability,
    Severity,
    ScannerSource,
    VulnerabilityCategory,
)
from Utils.logger import JobLogger

# Express auth middleware patterns
_AUTH_MIDDLEWARE_PATTERNS = [
    r"authenticate", r"isAuthenticated", r"requireAuth", r"verifyToken",
    r"passport\.authenticate", r"jwt\.verify", r"checkAuth",
    r"authMiddleware", r"verifyJWT", r"requireLogin",
]

# Express route definitions
_ROUTE_PATTERN = re.compile(
    r'(?:app|router)\.(get|post|put|delete|patch|all)\s*\(\s*["\']([^"\']+)["\']',
    re.MULTILINE,
)

# Suspicious route keywords
_SENSITIVE_PATTERNS = [
    r"/admin", r"/user", r"/account", r"/profile", r"/dashboard",
    r"/payment", r"/billing", r"/delete", r"/update", r"/reset",
    r"/password", r"/secret", r"/token", r"/key", r"/internal",
]

_ROLE_PATTERNS = [
    r"isAdmin", r"role\s*===", r"checkRole", r"hasPermission",
    r"requireRole", r"authorize", r"can\(", r"ability\.",
]


def analyze_routes(project_dir: Path, job_id: str) -> List[NormalizedVulnerability]:
    log = JobLogger(job_id, "analyzer.auth_routes")
    vulns: List[NormalizedVulnerability] = []

    js_files = list(project_dir.rglob("*.js")) + list(project_dir.rglob("*.ts"))
    py_files = list(project_dir.rglob("*.py"))
    all_files = js_files + py_files

    if not all_files:
        log.info("No JS/TS/Python files found for route analysis")
        return []

    log.info(f"Analyzing {len(all_files)} files for route/auth patterns")

    for fpath in all_files:
        try:
            content = fpath.read_text(errors="replace")
        except Exception:
            continue

        routes = _ROUTE_PATTERN.findall(content)
        if not routes:
            continue

        lines = content.splitlines()
        has_auth = any(re.search(p, content, re.IGNORECASE) for p in _AUTH_MIDDLEWARE_PATTERNS)
        has_role_check = any(re.search(p, content, re.IGNORECASE) for p in _ROLE_PATTERNS)

        for method, path in routes:
            is_sensitive = any(re.search(p, path, re.IGNORECASE) for p in _SENSITIVE_PATTERNS)

            if is_sensitive and not has_auth:
                line_num = _find_route_line(lines, method, path)
                # Check for IDOR pattern (numeric ID in path without auth)
                is_idor = bool(re.search(r"/:id|/\{id\}|/\[id\]", path))

                vuln = NormalizedVulnerability(
                    type="missing-auth-on-sensitive-route",
                    category=VulnerabilityCategory.IDOR if is_idor else VulnerabilityCategory.BROKEN_AUTH,
                    title=f"Sensitive route '{method.upper()} {path}' lacks authentication middleware",
                    description=(
                        f"The route '{method.upper()} {path}' in {fpath.name} "
                        f"handles sensitive operations but no authentication middleware "
                        f"{'(possible IDOR)' if is_idor else ''} was detected in this file."
                    ),
                    file=str(fpath.relative_to(project_dir)),
                    line=line_num,
                    severity=Severity.HIGH,
                    confidence=Confidence.MEDIUM,
                    source=ScannerSource.INTERNAL_AUTH,
                    owasp_id="A07:2021",
                    metadata={
                        "route": path,
                        "method": method.upper(),
                        "is_idor_risk": is_idor,
                        "no_auth_required": True,
                        "sensitive_data_exposed": True,
                    },
                )
                vulns.append(vuln)

            # Admin route without role check
            if re.search(r"/admin", path, re.IGNORECASE) and not has_role_check:
                line_num = _find_route_line(lines, method, path)
                vuln = NormalizedVulnerability(
                    type="admin-route-missing-role-check",
                    category=VulnerabilityCategory.BROKEN_ACCESS,
                    title=f"Admin route '{method.upper()} {path}' missing role check",
                    description=(
                        f"Admin route '{path}' in {fpath.name} does not appear to verify "
                        f"user roles or permissions, allowing privilege escalation."
                    ),
                    file=str(fpath.relative_to(project_dir)),
                    line=line_num,
                    severity=Severity.HIGH,
                    confidence=Confidence.MEDIUM,
                    source=ScannerSource.INTERNAL_AUTH,
                    owasp_id="A01:2021",
                    metadata={
                        "route": path,
                        "method": method.upper(),
                        "is_public_endpoint": True,
                    },
                )
                vulns.append(vuln)

    log.info(f"Route analysis complete: {len(vulns)} findings")
    return vulns


def _find_route_line(lines: List[str], method: str, path: str) -> int:
    pattern = re.compile(re.escape(path), re.IGNORECASE)
    for idx, line in enumerate(lines, 1):
        if method.lower() in line.lower() and pattern.search(line):
            return idx
    return 0
