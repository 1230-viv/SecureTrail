"""
File Upload Security Analyzer — SecureTrail
Detects insecure file upload implementations:
  - Missing MIME type validation
  - Missing file extension whitelist
  - Missing size limits
  - Dangerous storage locations
  - Missing execution prevention
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

# Multer / common upload library patterns
_UPLOAD_LIBRARY = re.compile(
    r"""multer|formidable|busboy|fileUpload|UploadFile|File\s*=\s*File""",
    re.IGNORECASE,
)
_MIME_CHECK = re.compile(r"""mimetype|mimeType|file\.type|content.type""", re.IGNORECASE)
_EXT_CHECK = re.compile(r"""\.ext|extname|file_extension|\.split\(['"]\.["']""", re.IGNORECASE)
_SIZE_LIMIT = re.compile(r"""fileSize|maxSize|max_size|limits\s*:\s*\{""", re.IGNORECASE)
_EXEC_STORAGE = re.compile(r"""\.php|\.sh|\.exe|\.bat|\.cmd|public/uploads|wwwroot""", re.IGNORECASE)
_DANGEROUS_DEST = re.compile(r"""destination\s*[:=]\s*["']\.?\/public""", re.IGNORECASE)


def analyze_file_upload(project_dir: Path, job_id: str) -> List[NormalizedVulnerability]:
    log = JobLogger(job_id, "analyzer.file_upload")
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

        if not _UPLOAD_LIBRARY.search(content):
            continue

        rel = str(fpath.relative_to(project_dir))

        # Missing MIME validation
        if not _MIME_CHECK.search(content):
            vulns.append(NormalizedVulnerability(
                type="file-upload-no-mime-check",
                category=VulnerabilityCategory.FILE_UPLOAD,
                title="File upload missing MIME type validation",
                description=(
                    f"{fpath.name} accepts file uploads without validating MIME type. "
                    "Unauthorized users could upload harmful files disguised as allowed types."
                ),
                file=rel,
                severity=Severity.HIGH,
                confidence=Confidence.MEDIUM,
                source=ScannerSource.INTERNAL_FILE_UPLOAD,
                owasp_id="A04:2021",
                metadata={"user_input_involved": True},
            ))

        # Missing extension whitelist
        if not _EXT_CHECK.search(content):
            vulns.append(NormalizedVulnerability(
                type="file-upload-no-extension-check",
                category=VulnerabilityCategory.FILE_UPLOAD,
                title="File upload missing extension whitelist",
                description=(
                    f"{fpath.name} accepts file uploads without restricting file extensions. "
                    "This allows executable file upload, leading to RCE."
                ),
                file=rel,
                severity=Severity.HIGH,
                confidence=Confidence.MEDIUM,
                source=ScannerSource.INTERNAL_FILE_UPLOAD,
                owasp_id="A04:2021",
                metadata={"user_input_involved": True},
            ))

        # Missing size limit
        if not _SIZE_LIMIT.search(content):
            vulns.append(NormalizedVulnerability(
                type="file-upload-no-size-limit",
                category=VulnerabilityCategory.FILE_UPLOAD,
                title="File upload has no size limit",
                description=(
                    f"{fpath.name} accepts file uploads without a size limit, "
                    "enabling denial-of-service via disk exhaustion."
                ),
                file=rel,
                severity=Severity.MEDIUM,
                confidence=Confidence.MEDIUM,
                source=ScannerSource.INTERNAL_FILE_UPLOAD,
                owasp_id="A04:2021",
                metadata={},
            ))

        # Dangerous storage in public/web-accessible directory
        if _DANGEROUS_DEST.search(content):
            m = _DANGEROUS_DEST.search(content)
            line_num = content[: m.start()].count("\n") + 1
            vulns.append(NormalizedVulnerability(
                type="file-upload-public-storage",
                category=VulnerabilityCategory.FILE_UPLOAD,
                title="Files stored in publicly accessible web directory",
                description=(
                    f"Uploaded files are stored in a public directory. "
                    "Executable files stored here can be directly requested and run by unauthorized users."
                ),
                file=rel,
                line=line_num,
                severity=Severity.CRITICAL,
                confidence=Confidence.HIGH,
                source=ScannerSource.INTERNAL_FILE_UPLOAD,
                owasp_id="A04:2021",
                metadata={"user_input_involved": True, "sensitive_data_exposed": True},
            ))

    log.info(f"File upload analysis complete: {len(vulns)} findings")
    return vulns
