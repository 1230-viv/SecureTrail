"""
Unified Vulnerability Schema — SecureTrail
All scanner outputs are normalized to this schema before any further processing.
"""

from __future__ import annotations
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import uuid


class Severity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"
    UNKNOWN = "UNKNOWN"


class Confidence(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ScannerSource(str, Enum):
    SEMGREP = "semgrep"
    TRIVY = "trivy"
    GITLEAKS = "gitleaks"
    CODEQL = "codeql"
    INTERNAL_AUTH = "internal_auth"
    INTERNAL_JWT = "internal_jwt"
    INTERNAL_CORS = "internal_cors"
    INTERNAL_RATE_LIMIT = "internal_rate_limit"
    INTERNAL_FILE_UPLOAD = "internal_file_upload"


class VulnerabilityCategory(str, Enum):
    INJECTION = "Injection"
    XSS = "Cross-Site Scripting"
    BROKEN_AUTH = "Broken Authentication"
    SENSITIVE_EXPOSURE = "Sensitive Data Exposure"
    XXE = "XML External Entity"
    BROKEN_ACCESS = "Broken Access Control"
    SECURITY_MISCONFIGURATION = "Security Misconfiguration"
    INSECURE_DESERIALIZATION = "Insecure Deserialization"
    VULNERABLE_COMPONENTS = "Vulnerable Components"
    INSUFFICIENT_LOGGING = "Insufficient Logging"
    SECRET_EXPOSURE = "Hardcoded Secrets / Credential Exposure"
    IDOR = "Insecure Direct Object Reference"
    SSRF = "Server-Side Request Forgery"
    OPEN_REDIRECT = "Open Redirect"
    RATE_LIMIT = "Missing Rate Limiting"
    FILE_UPLOAD = "Insecure File Upload"
    CORS = "CORS Misconfiguration"
    JWT = "JWT / Token Security"
    DEPENDENCY_CVE = "Dependency Vulnerability (CVE)"
    OTHER = "Other"


class RiskLevel(str, Enum):
    CRITICAL = "CRITICAL"   # 9.0 - 10.0
    HIGH = "HIGH"           # 7.0 - 8.9
    MEDIUM = "MEDIUM"       # 4.0 - 6.9
    LOW = "LOW"             # 1.0 - 3.9
    INFO = "INFO"           # 0.0 - 0.9


class ExploitabilityScore(BaseModel):
    score: float = Field(ge=0.0, le=10.0)
    risk_level: RiskLevel
    factors: Dict[str, Any] = Field(default_factory=dict)
    explanation: str = ""


class CorrelationInfo(BaseModel):
    correlated_with: List[str] = Field(default_factory=list)  # list of vuln IDs
    correlation_reason: str = ""
    score_boost: float = 0.0


class BusinessImpact(BaseModel):
    owasp_category: str = ""
    breach_example: str = ""
    potential_impact: str = ""
    exploit_scenario: str = ""
    estimated_loss_range: str = ""


class AIExplanation(BaseModel):
    root_cause: str = ""
    exploit_scenario: str = ""
    minimal_patch: str = ""
    secure_practice: str = ""
    references: List[str] = Field(default_factory=list)


class NormalizedVulnerability(BaseModel):
    """
    The single unified vulnerability record used throughout SecureTrail.
    Every scanner output is mapped to this struct.
    """
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str                             # e.g. "sql-injection", "hardcoded-secret"
    category: VulnerabilityCategory = VulnerabilityCategory.OTHER
    title: str = ""
    description: str = ""
    file: Optional[str] = None
    line: Optional[int] = None
    line_end: Optional[int] = None
    code_snippet: Optional[str] = None
    severity: Severity = Severity.UNKNOWN
    confidence: Confidence = Confidence.MEDIUM
    source: ScannerSource
    cve_id: Optional[str] = None
    cwe_id: Optional[str] = None
    owasp_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Populated by downstream engines
    exploitability: Optional[ExploitabilityScore] = None
    correlation: Optional[CorrelationInfo] = None
    business_impact: Optional[BusinessImpact] = None
    ai_explanation: Optional[AIExplanation] = None

    class Config:
        use_enum_values = True


class ScanReport(BaseModel):
    """Top-level scan report returned to the frontend."""
    job_id: str
    repository_name: str
    scan_timestamp: str
    status: str                           # "completed" | "partial" | "failed"
    total_vulnerabilities: int = 0
    critical_count: int = 0
    high_count: int = 0
    medium_count: int = 0
    low_count: int = 0
    info_count: int = 0
    scanner_results: Dict[str, Any] = Field(default_factory=dict)   # raw scanner meta
    vulnerabilities: List[NormalizedVulnerability] = Field(default_factory=list)
    correlation_summary: List[Dict[str, Any]] = Field(default_factory=list)
    configuration_analysis: Dict[str, Any] = Field(default_factory=dict)
    risk_summary: Dict[str, Any] = Field(default_factory=dict)
    scan_errors: List[str] = Field(default_factory=list)
