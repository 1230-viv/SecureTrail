"""
access_control_analyzer.py — SecureTrail SAST Access Control Engine
Enterprise v2

Detects broken access control, IDOR, BOLA, and authorization bypass in
Express/Node.js/TypeScript projects using static pattern analysis plus
lightweight data-flow tracking.

Rules:
    AC-001  Admin/sensitive route without authentication
    AC-002  Authenticated route missing role/permission check
    AC-003  Route parameter (IDOR) without ownership verification
    AC-004  Destructive endpoint (DELETE/PUT/PATCH) without authentication
    AC-005  Router mounted without auth middleware wrapper
    AC-006  Data-exfiltration endpoint without authentication
    AC-007  BOLA — req.query/body user-id access without ownership check

Enterprise v2 additions:
    - RouterGraph: BFS multi-level inheritance (replaces MountGraph)
    - Middleware semantic inference: sub-word probability scoring + arg extraction
    - IDOR data-flow-lite: req.params alias tracking, ORM-aware ownership patterns
    - AC-007 BOLA rule: req.query/body resource-id access detection
    - Upgraded risk formula: exposure, data-sensitivity, rate-limit multipliers
    - SuppressionEngine: allowlist, inline securetrail-ignore comments
    - False-negative reduction: template literals, versioned APIs, sub-app detection
    - FileResultCache: content-hash incremental analysis
    - FindingCorrelator: cross-tool dedup + severity escalation

Phase-2 roadmap markers are embedded as TODO(phase-2) comments.
"""

# ─────────────────────────────────────────────────────────────────────────────
# Imports
# ─────────────────────────────────────────────────────────────────────────────

from __future__ import annotations

import hashlib
import pickle
import re
import time
import uuid
from abc import ABC, abstractmethod
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

# SecureTrail internal schema (available at runtime)
try:
    from Engines.normalization.schema import NormalizedVulnerability, ScannerSource
    from Engines.normalization.schema import Severity, Confidence, VulnerabilityCategory
    from Utils.logger import JobLogger
except ImportError:  # pragma: no cover — allows standalone unit tests
    from enum import auto

    class Severity(str, Enum):
        CRITICAL = "CRITICAL"; HIGH = "HIGH"; MEDIUM = "MEDIUM"; LOW = "LOW"

    class Confidence(str, Enum):
        HIGH = "HIGH"; MEDIUM = "MEDIUM"; LOW = "LOW"

    class VulnerabilityCategory(str, Enum):
        BROKEN_ACCESS = "Broken Access Control"
        IDOR = "Insecure Direct Object Reference"
        INJECTION = "Injection"

    class ScannerSource(str, Enum):
        INTERNAL_ACCESS_CONTROL = "internal_access_control"

    class NormalizedVulnerability:
        """Stub used only in isolated unit tests."""
        def __init__(self, **kw): self.__dict__.update(kw)

    class JobLogger:
        def __init__(self, *a, **kw): pass
        def info(self, m): print("[INFO]", m)
        def warning(self, m): print("[WARN]", m)


# ─────────────────────────────────────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────────────────────────────────────

class MiddlewareClass(str, Enum):
    AUTH       = "auth"
    ROLE       = "role"
    OWNERSHIP  = "ownership"
    RATE_LIMIT = "rate_limit"
    LOGGING    = "logging"
    CORS       = "cors"
    UNKNOWN    = "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Core Data Classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class ClassifiedMiddleware:
    """A single middleware token with its resolved semantic class and evidence confidence."""
    token: str
    cls: MiddlewareClass
    confidence: float               # 0.0 – 1.0
    privilege_level: Optional[str] = None  # e.g. 'admin' from requireRole('admin')


# ─────────────────────────────────────────────────────────────────────────────
# Constants & Pattern Banks
# ─────────────────────────────────────────────────────────────────────────────

_AUTH_PATTERNS: List[str] = [
    r"\bauthenticate\b",
    r"\bisAuthenticated\b",
    r"\brequireAuth\b",
    r"\bauthRequired\b",
    r"\bverifyToken\b",
    r"\bpassport\.authenticate\s*\(",
    r"\bjwt\.verify\s*\(",
    r"\bauthMiddleware\b",
    r"\bauthGuard\b",
    r"\bverifyJWT\b",
    r"\brequireLogin\b",
    r"\bensureLoggedIn\b",
    r"\btokenRequired\b",
    r"\bprotectRoute\b",
    r"\bguardRoute\b",
    r"\bauthCheck\b",
    r"\bcheckAuth\b",
    r"\bisLoggedIn\b",
    r"\bwithAuth\b",
    r"\bsessionCheck\b",
    r"\bbearer\b",
    r"\bauth\s*[,)]",
    r"\bguard\s*[,)]",
    r"\bprotect\s*[,)]",
    # Third-party wrappers (false-negative reduction)
    r"\bexpress-jwt\b",
    r"\bexpress_jwt\b",
    r"\bkoa-jwt\b",
    r"\bexpress-openid\b",
    r"\bexpressJwt\b",
    r"\bexpressOpenidConnect\b",
]

_ROLE_PATTERNS: List[str] = [
    r"\bisAdmin\b",
    r"\bcheckRole\s*\(",
    r"\bhasRole\s*\(",
    r"\brequireRole\s*\(",
    r"\bhasPermission\s*\(",
    r"\bcheckPermission\s*\(",
    r"\bauthorizeRole\s*\(",
    r"\bauthorize\s*\(",
    r"\bpermissionGuard\b",
    r"\broleGuard\b",
    r"\badminOnly\b",
    r"\badminRequired\b",
    r"\brequireAdmin\b",
    r"\bcheckAdmin\b",
    r"\bsuperAdmin\b",
    r"\bpolicy\s*\(",
    r"\bcan\s*\(",
    r"\bability\.can\b",
    r"\bacl\b",
    r"\brole\s*[=!]==?\s*['\"]",
    r"\broles\.includes\s*\(",
    r"\binRole\s*\(",
    r"\bhaveRole\b",
]

_OWNERSHIP_PATTERNS: List[str] = [
    r"req\.user\.id\s*[=!]==?\s*",
    r"[=!]==?\s*req\.user\.id",
    r"\buserId\s*[=!]==?\s*req\.user",
    r"\bowner\s*[=!]==?\s*req\.user",
    r"\bisOwner\s*\(",
    r"\bcheckOwnership\s*\(",
    r"\bassertOwner\s*\(",
    r"\bbelongsToUser\b",
    r"\bownedBy\s*\(",
    r"\bverifyOwnership\b",
    r"req\.params\.id\s*[=!]==?\s*req\.user",
    r"params\.id\s*[=!]==?\s*user\.id",
    # ORM-level ownership (Mongoose, Sequelize)
    r"\b(?:findOne|findById|find)\s*\(\s*\{[^}]*(?:userId|user_id|ownerId|owner_id)[^}]*\}",
    r"user\s*:\s*req\.user(?:\.id|\.\_id)\b",
]

# ORM-aware ownership patterns (extended for data-flow-lite)
_ORM_OWNERSHIP_PATTERNS: List[str] = [
    r"prisma\.\w+\.findUnique\s*\(\s*\{[^}]*where\s*:",
    r"\.where\s*\(\s*\{[^}]*(?:userId|user_id|owner)\s*:",
    r"findById\s*\(\s*req\.params",
    r"findOne\s*\(\s*\{[^}]*req\.user",
    r"\.find\s*\(\s*\{[^}]*req\.user",
]

_RATE_LIMIT_PATTERNS: List[str] = [
    r"\brateLimit\b",
    r"\brat[eE]Limit(?:er)?\b",
    r"\bthrottl(?:e|er)\b",
    r"\blimiter\b",
    r"\bslowDown\b",
    r"\bexpress-rate-limit\b",
]

_LOGGING_PATTERNS: List[str] = [
    r"\bauditLog\b",
    r"\bactivityLog\b",
    r"\btraceMiddleware\b",
    r"\brequestLog(?:ger)?\b",
    r"\bmorgan\b",
    r"\bwinstonMiddleware\b",
]

_CORS_PATTERNS: List[str] = [
    r"\bcors\s*\(",
    r"\bcorsMiddleware\b",
    r"\bcorsOptions\b",
]

# BOLA patterns — req.query/body resource-id access
_BOLA_PATTERNS: List[str] = [
    r"req\.query\.(userId|user_id|id|owner|ownerId)\b",
    r"req\.body\.(userId|user_id|id|owner|ownerId)\b",
    r"req\.query\[['\"](?:userId|user_id|id|owner|ownerId)['\"]\]",
    r"req\.body\[['\"](?:userId|user_id|id|owner|ownerId)['\"]\]",
]

_ADMIN_PATH_SEGMENTS: frozenset = frozenset([
    "admin", "manage", "superuser", "root", "internal",
    "backoffice", "backstage", "ops", "operator", "su", "management",
])

_SENSITIVE_PATH_SEGMENTS: frozenset = frozenset([
    "users", "accounts", "delete", "update", "edit", "remove",
    "create", "register", "password", "reset", "tokens", "secret",
    "keys", "config", "settings", "payment", "billing",
    "import", "permissions", "roles", "audit", "logs",
    "credentials", "private",
])

# PII path segments (risk multiplier)
_PII_PATH_SEGMENTS: frozenset = frozenset([
    "email", "ssn", "dob", "phone", "address", "passport",
    "national_id", "tax", "identity", "profile",
])

# Financial path segments (risk multiplier)
_FINANCIAL_PATH_SEGMENTS: frozenset = frozenset([
    "payment", "billing", "card", "invoice", "transaction",
    "stripe", "paypal", "checkout", "subscription", "bank",
])

# Data-exfiltration paths — targeted by AC-006
_EXFIL_PATH_SEGMENTS: frozenset = frozenset([
    "export", "download", "report", "reports", "backup",
    "dump", "extract", "bulk", "csv", "xlsx", "snapshot",
])

_DESTRUCTIVE_METHODS: frozenset = frozenset(["delete", "put", "patch"])

_SKIP_DIRS: frozenset = frozenset([
    "node_modules", ".git", "dist", "build", "coverage",
    "__pycache__", ".next", ".nuxt", ".cache", "vendor",
    "public", "static", "assets", "migrations", "fixtures",
    "test", "tests", "__tests__", "spec", "specs", "e2e",
])

_ANALYZE_EXTENSIONS: Tuple[str, ...] = (".js", ".ts", ".mjs", ".cjs")
_MAX_FILE_BYTES: int = 5 * 1024 * 1024
_MAX_WORKERS: int = 8

# ─────────────────────────────────────────────────────────────────────────────
# Middleware Semantic Sub-word Tables (v2)
# ─────────────────────────────────────────────────────────────────────────────
# Used by _infer_middleware_class() for probabilistic classification of tokens
# that don't match any hard pattern.

_AUTH_SUBWORDS: Dict[str, float] = {
    "auth": 0.80, "verify": 0.75, "require": 0.60, "guard": 0.70,
    "check": 0.50, "protect": 0.70, "login": 0.65, "token": 0.60,
    "jwt": 0.85, "bearer": 0.80, "session": 0.60, "secure": 0.55,
    "authenticated": 0.85, "ensurelogged": 0.80, "middleware": 0.30,
}
_ROLE_SUBWORDS: Dict[str, float] = {
    "role": 0.85, "admin": 0.80, "permission": 0.85, "authorize": 0.80,
    "policy": 0.75, "acl": 0.90, "can": 0.55, "privilege": 0.80,
    "access": 0.50, "scope": 0.65, "authority": 0.70,
}
_SEMANTIC_THRESHOLD: float = 0.55  # minimum score to override UNKNOWN


# ─────────────────────────────────────────────────────────────────────────────
# Compiled Regular Expressions
# ─────────────────────────────────────────────────────────────────────────────

# Standard route: app/router.method(path, [mw...], handler)
_ROUTE_RE = re.compile(
    r"""
    (?P<router>
        \b(?:app|router|this\.router|exports?(?:\.\w+)?|module\.exports?(?:\.\w+)?)
        |\b\w+[Rr]outer\b
    )
    \s*\.\s*
    (?P<method>get|post|put|delete|patch|all|head|options)
    \s*\(\s*
    (?P<path_raw>['"`][^'"`\n]*['"`])
    (?P<rest_args>[^;{]*)
    """,
    re.VERBOSE | re.IGNORECASE,
)

# Template literal path: router.get(`/api/${version}/admin`, ...)
_TEMPLATE_ROUTE_RE = re.compile(
    r"""
    (?:app|router|\w+[Rr]outer)\s*\.\s*
    (?P<method>get|post|put|delete|patch|all|head|options)\s*\(\s*
    (?P<path_raw>`[^`\n]*\$\{[^}]+\}[^`\n]*`)
    (?P<rest_args>[^;{]*)
    """,
    re.VERBOSE | re.IGNORECASE,
)

# router.use('/prefix', [mw...], subRouter)
_ROUTER_USE_RE = re.compile(
    r"""
    \b(?:app|router|\w+[Rr]outer)\s*\.\s*use\s*\(
        \s*(?P<path>['"`][^'"`\n]*['"`]\s*,\s*)?
        (?P<args>[^)]*?)
    \s*\)
    """,
    re.VERBOSE,
)

# router.route('/path').get(mw, handler).post(handler2)
_CHAINED_ROUTE_RE = re.compile(
    r"""
    (?:app|router|\w+[Rr]outer)\s*\.\s*route\s*\(\s*
    (?P<path>['"`][^'"`\n]*['"`])\s*\)
    (?P<chain>(?:\s*\.\s*(?:get|post|put|delete|patch|all|head|options)\s*\([^)]*\))+)
    """,
    re.VERBOSE | re.IGNORECASE,
)

_CHAINED_METHOD_RE = re.compile(
    r"""
    \.\s*(?P<method>get|post|put|delete|patch|all|head|options)\s*\(
    (?P<args>[^)]*)
    \)
    """,
    re.VERBOSE | re.IGNORECASE,
)

# const X = require('./path')
_REQUIRE_RE = re.compile(
    r"""
    (?:const|let|var)\s+
    (?P<var>[a-zA-Z_$][\w$]*)\s*=\s*
    require\s*\(\s*(?P<path>['"`][^'"`]+['"`])\s*\)
    """,
    re.VERBOSE,
)

# module.exports = routerVarName
_MODULE_EXPORTS_RE = re.compile(
    r"module\.exports\s*=\s*(?P<var>[a-zA-Z_$][\w$]*)"
)

# Pre-screen signal
_ROUTE_SIGNAL_RE = re.compile(
    r'\b(?:app|router|\w+[Rr]outer)\s*\.\s*'
    r'(?:get|post|put|delete|patch|all|head|options|use|route)\s*\(',
    re.IGNORECASE,
)

_MIDDLEWARE_TOKEN_RE = re.compile(
    r"""
    ([a-zA-Z_$][\w$]*
    (?:\s*\.\s*[a-zA-Z_$][\w$]*)*
    (?:\s*\([^)]*\))?)
    """,
    re.VERBOSE,
)

_HANDLER_TOKEN_RE = re.compile(
    r"""
    (?:async\s+)?
    (?:function\s*\w*\s*\(|
       \([^)]*\)\s*=>|
       \w+\s*=>|
       \b(?:controller|handler|ctrl|resolver)\b)
    """,
    re.VERBOSE | re.IGNORECASE,
)

_PATH_PARAM_RE = re.compile(r"/:[\w]+")

# req.params.X alias: const id = req.params.id
_PARAM_ALIAS_RE = re.compile(
    r"(?:const|let|var)\s+(?P<alias>\w+)\s*=\s*req\.params\.(?P<param>\w+)"
)

# Privilege argument: requireRole('admin') → 'admin'
_PRIV_ARG_RE = re.compile(r"\(\s*['\"](?P<priv>\w+)['\"]\s*\)")

# Versioned API prefix normalization (/v1/, /v2/, etc.)
_VERSION_RE = re.compile(r"^/v\d+(/.*)?$")


# ─────────────────────────────────────────────────────────────────────────────
# Route & File Data Classes
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RouteContext:
    """Everything known about a single parsed route declaration."""
    file: str
    line_number: int
    method: str
    path: str
    inline_middleware: List[str]
    raw_call: str
    context_window: str
    handler_snippet: str
    # Enterprise v1 fields
    full_path: str = ""
    risk_score: int = 0
    classified_middleware: List[ClassifiedMiddleware] = field(default_factory=list)
    is_chained: bool = False
    has_path_param: bool = field(init=False, default=False)
    # Enterprise v2 fields
    is_dynamic_path: bool = False    # True for template-literal paths
    has_bola_signal: bool = False    # True when req.query/body id-field found in handler

    def __post_init__(self) -> None:
        self.has_path_param = bool(_PATH_PARAM_RE.search(self.path))
        if not self.full_path:
            self.full_path = self.path


@dataclass
class FileContext:
    """File-level context informing per-route analysis."""
    path: str
    global_auth_use: bool
    global_role_use: bool
    auth_imports: Set[str]
    router_use_entries: List[str]
    inherited_auth: bool = False
    inherited_role: bool = False
    mount_prefix: Optional[str] = None
    # v2: exported router var (for RouterGraph)
    exported_var: Optional[str] = None
    # v2: param aliases discovered in file {alias: param_name}
    param_aliases: Dict[str, str] = field(default_factory=dict)


@dataclass
class RuleResult:
    """Intermediate result produced by a DetectionRule before schema conversion."""
    rule_id: str
    severity: Severity
    confidence: Confidence
    category: VulnerabilityCategory
    route: RouteContext
    title: str
    description: str
    recommendation: str
    owasp_id: str
    cwe_id: str


# ─────────────────────────────────────────────────────────────────────────────
# Risk Scorer  (v2 — upgraded formula)
# ─────────────────────────────────────────────────────────────────────────────

class RiskScorer:
    """
    Computes a 0–100 authorization risk score and derives Severity + Confidence.

    v2 Formula
    ----------
    base  = method_weight × path_weight
    risk  = base × auth_factor × idor_bonus
            × exposure_mult × data_sensitivity_mult × rate_limit_mult
    score = min(100, int(risk × 100))

    Method weights: DELETE=1.0, PUT=0.9, PATCH=0.8, POST=0.7, GET=0.5
    Path weights:   admin=1.0, exfil=0.85, sensitive=0.70, default=0.30
    Auth factor:    no-auth→1.0, auth+no-role→0.45, auth+role→0.10
    IDOR bonus:     1.3× when :id param + auth + no-role
    Exposure mult:  /api/ or /v*/ → 1.2, /internal/ → 0.8, else 1.0
    Data sensitivity: PII→1.3, financial→1.4, bulk/exfil→1.25, else 1.0
    Rate-limit mult: no rate-limit middleware → 1.15, else 1.0
    Inheritance mod: auth from inheritance only → reduce auth_factor confidence by 0.85x
    """

    _METHOD_WEIGHTS: Dict[str, float] = {
        "delete": 1.0, "put": 0.9, "patch": 0.8, "post": 0.7,
        "get": 0.5, "all": 0.8, "head": 0.2, "options": 0.1,
    }

    @staticmethod
    def score(
        method: str,
        path: str,
        has_auth: bool,
        has_role: bool,
        has_path_param: bool,
        classified_middleware: Optional[List[ClassifiedMiddleware]] = None,
        auth_from_inheritance: bool = False,
    ) -> int:
        method_w = RiskScorer._METHOD_WEIGHTS.get(method.lower(), 0.5)
        path_lower = path.lower()
        segs = set(re.split(r"[/\-_.]", path_lower))

        # Path weight
        if _ADMIN_PATH_SEGMENTS & segs:
            path_w = 1.0
        elif _EXFIL_PATH_SEGMENTS & segs:
            path_w = 0.85
        elif _SENSITIVE_PATH_SEGMENTS & segs:
            path_w = 0.70
        else:
            path_w = 0.30

        # Auth factor (with inheritance confidence reduction)
        if not has_auth:
            auth_factor = 1.0
        elif not has_role:
            auth_factor = 0.45 * (0.85 if auth_from_inheritance else 1.0)
        else:
            auth_factor = 0.10 * (0.85 if auth_from_inheritance else 1.0)

        # IDOR bonus
        idor_bonus = 1.3 if (has_path_param and has_auth and not has_role) else 1.0

        # Exposure multiplier
        if re.search(r"^/(?:api|v\d+)/", path_lower):
            exposure_mult = 1.2
        elif "/internal/" in path_lower or path_lower.startswith("/internal"):
            exposure_mult = 0.8
        else:
            exposure_mult = 1.0

        # Data sensitivity multiplier
        if _FINANCIAL_PATH_SEGMENTS & segs:
            data_mult = 1.4
        elif _PII_PATH_SEGMENTS & segs:
            data_mult = 1.3
        elif _EXFIL_PATH_SEGMENTS & segs:
            data_mult = 1.25
        else:
            data_mult = 1.0

        # Rate-limit multiplier
        has_rate_limit = False
        if classified_middleware:
            has_rate_limit = any(
                c.cls == MiddlewareClass.RATE_LIMIT for c in classified_middleware
            )
        rate_mult = 1.0 if has_rate_limit else 1.15

        raw = (method_w * path_w * auth_factor * idor_bonus
               * exposure_mult * data_mult * rate_mult)
        return min(100, int(raw * 100))

    @staticmethod
    def to_severity(score: int) -> Severity:
        if score >= 80:
            return Severity.CRITICAL
        if score >= 50:
            return Severity.HIGH
        if score >= 18:
            return Severity.MEDIUM
        return Severity.LOW

    @staticmethod
    def to_confidence(
        has_inline_match: bool,
        has_global_match: bool,
        has_inherited: bool,
    ) -> Confidence:
        evidence = sum([has_inline_match, has_global_match, has_inherited])
        if has_inline_match and evidence >= 2:
            return Confidence.HIGH
        if has_inline_match or evidence >= 2:
            return Confidence.MEDIUM
        return Confidence.LOW


# ─────────────────────────────────────────────────────────────────────────────
# Middleware Classifier  (v2 — semantic inference)
# ─────────────────────────────────────────────────────────────────────────────

def _infer_middleware_class(token: str) -> ClassifiedMiddleware:
    """
    Probabilistic sub-word classification for tokens that didn't match any
    hard pattern. Scores AUTH and ROLE subword tables; highest score wins
    if above _SEMANTIC_THRESHOLD.
    """
    lower = token.lower()
    # Strip call signature for token matching
    clean = re.sub(r"\([^)]*\)", "", lower)

    auth_score: float = 0.0
    role_score: float = 0.0

    for word, weight in _AUTH_SUBWORDS.items():
        if word in clean:
            auth_score = max(auth_score, weight)

    for word, weight in _ROLE_SUBWORDS.items():
        if word in clean:
            role_score = max(role_score, weight)

    # Extract privilege argument (e.g. requireRole('admin') → 'admin')
    priv_match = _PRIV_ARG_RE.search(token)
    privilege_level = priv_match.group("priv") if priv_match else None

    if role_score >= auth_score and role_score >= _SEMANTIC_THRESHOLD:
        return ClassifiedMiddleware(
            token=token, cls=MiddlewareClass.ROLE,
            confidence=round(role_score * 0.9, 3),
            privilege_level=privilege_level,
        )
    if auth_score >= _SEMANTIC_THRESHOLD:
        return ClassifiedMiddleware(
            token=token, cls=MiddlewareClass.AUTH,
            confidence=round(auth_score * 0.9, 3),
            privilege_level=privilege_level,
        )
    return ClassifiedMiddleware(
        token=token, cls=MiddlewareClass.UNKNOWN, confidence=0.0
    )


class MiddlewareClassifier:
    """
    Classifies a middleware token into a typed MiddlewareClass with confidence.

    v2: Falls through to semantic sub-word inference when no hard pattern matches.
    Priority: AUTH > ROLE > OWNERSHIP > RATE_LIMIT > LOGGING > CORS > semantic > UNKNOWN
    """

    _PATTERN_MAP: List[Tuple[MiddlewareClass, List[str], float]] = [
        (MiddlewareClass.AUTH,       _AUTH_PATTERNS,       0.90),
        (MiddlewareClass.ROLE,       _ROLE_PATTERNS,       0.90),
        (MiddlewareClass.OWNERSHIP,  _OWNERSHIP_PATTERNS,  0.85),
        (MiddlewareClass.RATE_LIMIT, _RATE_LIMIT_PATTERNS, 0.85),
        (MiddlewareClass.LOGGING,    _LOGGING_PATTERNS,    0.80),
        (MiddlewareClass.CORS,       _CORS_PATTERNS,       0.80),
    ]

    def classify(self, token: str) -> ClassifiedMiddleware:
        # Extract privilege level for role patterns
        priv_match = _PRIV_ARG_RE.search(token)
        privilege = priv_match.group("priv") if priv_match else None

        for cls, patterns, conf in self._PATTERN_MAP:
            if _matches_any(token, patterns):
                return ClassifiedMiddleware(
                    token=token, cls=cls, confidence=conf,
                    privilege_level=privilege if cls == MiddlewareClass.ROLE else None,
                )
        # v2: semantic fallback
        return _infer_middleware_class(token)

    def classify_all(self, tokens: List[str]) -> List[ClassifiedMiddleware]:
        return [self.classify(t) for t in tokens]


_CLASSIFIER = MiddlewareClassifier()


# ─────────────────────────────────────────────────────────────────────────────
# Router Graph  (v2 — BFS multi-level inheritance, replaces MountGraph)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RouterNode:
    """A file acting as an Express router with resolved inheritance state."""
    file_path: Path
    stem: str
    exported_vars: Set[str]          # vars exported from this file
    middleware_chain: List[str]       # all ancestor middleware tokens accumulated
    mount_path: str                   # full resolved path prefix from root
    has_auth: bool                    # any ancestor provided auth
    has_role: bool                    # any ancestor provided role


@dataclass
class RouterEdge:
    """A router.use() mount edge: parent mounts child at a path with optional middleware."""
    parent_file: Path
    child_stem: str
    mount_path: str
    middleware: List[str]
    has_auth: bool
    has_role: bool


class RouterGraph:
    """
    Multi-level cross-file router inheritance tracker using BFS from entry files.

    Algorithm
    ---------
    1. Parse-pass: For each file, collect:
       - require() variable→stem associations
       - module.exports = var (exported router variable)
       - router.use() calls → RouterEdge list
    2. BFS from entry files (app.js, index.js, server.js, main.js):
       - Propagate accumulated middleware down to child stems
       - Resolve full mount_path by concatenating parent path + mount segment
    3. Conflict: child inline auth always wins over inherited (override semantics).
    """

    _ENTRY_STEMS: frozenset = frozenset(["app", "index", "server", "main"])

    def __init__(self) -> None:
        self._nodes: Dict[str, RouterNode] = {}      # stem → node
        self._edges: List[RouterEdge] = []
        self._stem_to_file: Dict[str, Path] = {}

    def build(self, files: List[Path]) -> None:
        """Full two-pass BFS build."""
        var_to_stem: Dict[str, str] = {}
        file_exports: Dict[str, str] = {}           # file_stem → exported var

        # Pass 1: collect require() and module.exports
        for fpath in files:
            try:
                raw = fpath.read_bytes()
                if len(raw) > _MAX_FILE_BYTES:
                    continue
                content = raw.decode("utf-8", errors="replace")
            except Exception:
                continue

            stem = fpath.stem.lower()
            self._stem_to_file[stem] = fpath

            for m in _REQUIRE_RE.finditer(content):
                var_name = m.group("var")
                req_path = m.group("path").strip("\"'`")
                req_stem = Path(req_path).stem.lower()
                var_to_stem[var_name] = req_stem

            exp_m = _MODULE_EXPORTS_RE.search(content)
            if exp_m:
                file_exports[stem] = exp_m.group("var")

            # Collect edges in same pass
            for m in _ROUTER_USE_RE.finditer(content):
                path_part = (m.group("path") or "").strip()
                args_str = (m.group("args") or "").strip()
                mount_path = _clean_path(path_part.rstrip(", ")) or "/"
                has_auth_m = _matches_any(args_str, _AUTH_PATTERNS)
                has_role_m = _matches_any(args_str, _ROLE_PATTERNS)
                tokens = [t.strip() for t in _MIDDLEWARE_TOKEN_RE.findall(args_str) if t.strip()]

                for tok in tokens:
                    if tok in var_to_stem:
                        self._edges.append(RouterEdge(
                            parent_file=fpath,
                            child_stem=var_to_stem[tok],
                            mount_path=mount_path,
                            middleware=tokens,
                            has_auth=has_auth_m,
                            has_role=has_role_m,
                        ))

        # Pass 2: BFS from entry stems
        entry_stems = [s for s in self._stem_to_file if s in self._ENTRY_STEMS]
        if not entry_stems and self._stem_to_file:
            entry_stems = [next(iter(self._stem_to_file))]

        visited: Set[str] = set()
        queue: List[Tuple[str, str, List[str], bool, bool]] = [
            (s, "", [], False, False) for s in entry_stems
        ]

        while queue:
            stem, prefix, inherited_mw, inherited_auth, inherited_role = queue.pop(0)
            if stem in visited:
                continue
            visited.add(stem)

            node = RouterNode(
                file_path=self._stem_to_file.get(stem, Path(stem)),
                stem=stem,
                exported_vars={file_exports.get(stem, stem)},
                middleware_chain=list(inherited_mw),
                mount_path=prefix or "/",
                has_auth=inherited_auth,
                has_role=inherited_role,
            )
            self._nodes[stem] = node

            # Enqueue children
            for edge in self._edges:
                if edge.parent_file.stem.lower() == stem:
                    child_path = (prefix.rstrip("/") + "/" + edge.mount_path.lstrip("/")).rstrip("/") or "/"
                    child_auth = inherited_auth or edge.has_auth
                    child_role = inherited_role or edge.has_role
                    child_mw = inherited_mw + edge.middleware
                    if edge.child_stem not in visited:
                        queue.append((edge.child_stem, child_path, child_mw, child_auth, child_role))

    def resolve(self, file_path: Path) -> Optional[RouterNode]:
        return self._nodes.get(file_path.stem.lower())

    def get_inherited_auth(self, file_path: Path) -> bool:
        node = self.resolve(file_path)
        return node.has_auth if node else False

    def get_inherited_role(self, file_path: Path) -> bool:
        node = self.resolve(file_path)
        return node.has_role if node else False

    def get_mount_prefix(self, file_path: Path) -> Optional[str]:
        node = self.resolve(file_path)
        if node and node.mount_path and node.mount_path != "/":
            return node.mount_path
        return None


# Backward-compat alias
MountGraph = RouterGraph


# ─────────────────────────────────────────────────────────────────────────────
# Suppression Engine  (v2)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class SuppressionConfig:
    """
    Configuration for the SuppressionEngine.

    allowed_paths:          exact route path strings that are never flagged.
    allowed_path_patterns:  regex strings matched against route.path.
    ignored_rule_ids:       rule IDs always suppressed regardless of route.
    """
    allowed_paths: List[str] = field(default_factory=list)
    allowed_path_patterns: List[str] = field(default_factory=list)
    ignored_rule_ids: Set[str] = field(default_factory=set)


class SuppressionEngine:
    """
    Determines whether a finding should be suppressed based on:
      1. Globally ignored rule IDs (SuppressionConfig.ignored_rule_ids)
      2. Allowlisted paths (exact match or regex pattern)
      3. Inline comment on the route line or the line above:
             // securetrail-ignore: AC-002
             // securetrail-ignore-all
    """

    _INLINE_IGNORE_RE = re.compile(
        r"//\s*securetrail-ignore(?:-all|:\s*(?P<rules>[A-Z0-9,\- ]+))?",
        re.IGNORECASE,
    )

    def __init__(self, config: Optional[SuppressionConfig] = None) -> None:
        self._config = config or SuppressionConfig()
        self._compiled_patterns: List[re.Pattern] = [
            re.compile(p, re.IGNORECASE)
            for p in self._config.allowed_path_patterns
        ]

    def is_suppressed(
        self,
        route: RouteContext,
        rule_id: str,
        file_lines: Optional[List[str]] = None,
    ) -> Tuple[bool, str]:
        """
        Returns (suppressed: bool, reason: str).
        Reason is empty string when not suppressed.
        """
        # 1. Global rule ignore
        if rule_id in self._config.ignored_rule_ids:
            return True, f"rule {rule_id} in ignored_rule_ids"

        # 2. Exact path allowlist
        if route.path in self._config.allowed_paths:
            return True, f"path '{route.path}' in allowed_paths"

        # 3. Pattern allowlist
        for pat in self._compiled_patterns:
            if pat.search(route.path):
                return True, f"path '{route.path}' matches pattern '{pat.pattern}'"

        # 4. Inline comment suppression
        if file_lines:
            line_idx = route.line_number - 1  # 0-based
            for check_line in range(max(0, line_idx - 1), min(len(file_lines), line_idx + 1)):
                line_text = file_lines[check_line]
                m = self._INLINE_IGNORE_RE.search(line_text)
                if m:
                    rules_text = m.group("rules")
                    if rules_text is None:
                        # securetrail-ignore-all
                        return True, f"inline suppression (all) at line {check_line + 1}"
                    suppressed_rules = {r.strip().upper() for r in rules_text.split(",")}
                    if rule_id.upper() in suppressed_rules:
                        return True, f"inline suppression of {rule_id} at line {check_line + 1}"

        return False, ""


# ─────────────────────────────────────────────────────────────────────────────
# File Result Cache  (v2 — content-hash incremental analysis)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class CacheEntry:
    file_hash: str
    findings: List[NormalizedVulnerability]
    analyzed_at: float


class FileResultCache:
    """
    Content-hash based incremental file analysis cache.
    Persists to /tmp/securetrail_ac_cache.pkl between runs.
    Cache hit: file MD5 matches stored hash → return cached findings.
    Cache miss: analyze and store.
    """

    _CACHE_PATH: Path = Path("/tmp/securetrail_ac_cache.pkl")

    def __init__(self) -> None:
        self._data: Dict[str, CacheEntry] = {}

    def load(self) -> None:
        try:
            if self._CACHE_PATH.exists():
                with open(self._CACHE_PATH, "rb") as f:
                    self._data = pickle.load(f)
        except Exception:
            self._data = {}

    def save(self) -> None:
        try:
            with open(self._CACHE_PATH, "wb") as f:
                pickle.dump(self._data, f)
        except Exception:
            pass

    def get(self, fpath: Path, content: str) -> Optional[List[NormalizedVulnerability]]:
        h = self._hash(content)
        entry = self._data.get(str(fpath))
        if entry and entry.file_hash == h:
            return entry.findings
        return None

    def put(self, fpath: Path, content: str, findings: List[NormalizedVulnerability]) -> None:
        self._data[str(fpath)] = CacheEntry(
            file_hash=self._hash(content),
            findings=list(findings),
            analyzed_at=time.time(),
        )

    @staticmethod
    def _hash(content: str) -> str:
        return hashlib.md5(content.encode("utf-8", errors="replace")).hexdigest()


# ─────────────────────────────────────────────────────────────────────────────
# Finding Correlator  (v2 — cross-tool dedup + severity escalation)
# ─────────────────────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class CorrelationKey:
    """Groups findings that are likely the same vulnerability."""
    file: str
    line_bucket: int       # line // 5  (5-line near-match)
    cwe_id: str


class FindingCorrelator:
    """
    Deduplicates and escalates findings across tools (access_control_analyzer,
    semgrep, trivy, gitleaks).

    Deduplication: same CorrelationKey → keep highest severity, merge metadata.
    Escalation:
      - AC-003 (IDOR / CWE-639) + AC-001 (no-auth / CWE-306) on same file+bucket
        → escalate both to CRITICAL, add correlation note.
      - AC-006 (exfil) + no-rate-limit on same file bucket → compound severity.
    """

    def deduplicate(
        self, findings: List[NormalizedVulnerability]
    ) -> List[NormalizedVulnerability]:
        """Remove near-duplicate findings, keeping the highest severity per bucket."""
        severity_rank = {
            Severity.CRITICAL: 4, Severity.HIGH: 3,
            Severity.MEDIUM: 2, Severity.LOW: 1,
        }
        buckets: Dict[CorrelationKey, List[NormalizedVulnerability]] = defaultdict(list)
        for f in findings:
            key = CorrelationKey(
                file=f.file,
                line_bucket=f.line // 5,
                cwe_id=f.cwe_id or "",
            )
            buckets[key].append(f)

        result: List[NormalizedVulnerability] = []
        for key, group in buckets.items():
            best = max(group, key=lambda f: severity_rank.get(f.severity, 0))
            result.append(best)
        return result

    def escalate(
        self, findings: List[NormalizedVulnerability]
    ) -> List[NormalizedVulnerability]:
        """
        Escalate finding severity when correlated with complementary evidence.
        AC-003 + AC-001 on same file bucket → both CRITICAL.
        """
        # Build per-file-bucket rule presence
        FBKey = Tuple[str, int]
        rule_presence: Dict[FBKey, Set[str]] = defaultdict(set)
        for f in findings:
            fb: FBKey = (f.file, f.line // 5)
            rule_id = (f.metadata or {}).get("rule_id", "")
            if rule_id:
                rule_presence[fb].add(rule_id)

        result: List[NormalizedVulnerability] = []
        for f in findings:
            fb: FBKey = (f.file, f.line // 5)
            rules_here = rule_presence[fb]
            rule_id = (f.metadata or {}).get("rule_id", "")

            if "AC-003" in rules_here and "AC-001" in rules_here and rule_id in ("AC-003", "AC-001"):
                # Escalate to CRITICAL and annotate
                meta = dict(f.metadata or {})
                meta["correlated_escalation"] = "AC-001+AC-003 co-occurrence → CRITICAL"
                result.append(NormalizedVulnerability(
                    id=f.id, type=f.type, category=f.category,
                    title=f.title, description=f.description,
                    file=f.file, line=f.line,
                    severity=Severity.CRITICAL,
                    confidence=f.confidence, source=f.source,
                    owasp_id=f.owasp_id, cwe_id=f.cwe_id, metadata=meta,
                ))
            else:
                result.append(f)
        return result

    def composite_index(
        self, findings: List[NormalizedVulnerability]
    ) -> Dict[str, int]:
        """Per-file weighted sum of risk scores (higher = more risky file)."""
        scores: Dict[str, int] = defaultdict(int)
        for f in findings:
            rs = (f.metadata or {}).get("risk_score", 0)
            scores[f.file] += rs
        return dict(sorted(scores.items(), key=lambda x: -x[1]))


# ─────────────────────────────────────────────────────────────────────────────
# Rule Metadata & Registry
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RuleMetadata:
    rule_id: str
    name: str
    description: str
    enabled: bool = True
    severity_override: Optional[Severity] = None
    confidence_weight: float = 1.0
    tags: List[str] = field(default_factory=list)


class RuleRegistry:
    """
    Registry of DetectionRule instances with associated RuleMetadata.

    Usage example:
        registry = RuleRegistry.default()
        registry.disable("AC-002")
        analyze_access_control(dir, job_id, rule_registry=registry)
    """

    def __init__(self) -> None:
        self._entries: Dict[str, Tuple[DetectionRule, RuleMetadata]] = {}

    def register(
        self,
        rule: DetectionRule,
        metadata: Optional[RuleMetadata] = None,
    ) -> None:
        if metadata is None:
            metadata = RuleMetadata(rule_id=rule.rule_id, name=rule.rule_id, description="")
        self._entries[rule.rule_id] = (rule, metadata)

    def disable(self, rule_id: str) -> None:
        entry = self._entries.get(rule_id)
        if entry:
            rule, meta = entry
            self._entries[rule_id] = (rule, RuleMetadata(
                rule_id=meta.rule_id, name=meta.name, description=meta.description,
                enabled=False, severity_override=meta.severity_override,
                confidence_weight=meta.confidence_weight, tags=meta.tags,
            ))

    def get_enabled_rules(self) -> List["DetectionRule"]:
        return [rule for rule, meta in self._entries.values() if meta.enabled]

    def get_metadata(self, rule_id: str) -> Optional[RuleMetadata]:
        entry = self._entries.get(rule_id)
        return entry[1] if entry else None

    @classmethod
    def default(cls) -> "RuleRegistry":
        registry = cls()
        registry.register(AdminNoAuthRule(), RuleMetadata(
            rule_id="AC-001", name="Admin Route No Auth",
            description="Admin/sensitive route accessible without authentication.",
            tags=["auth", "admin", "critical"],
        ))
        registry.register(AuthWithoutRoleRule(), RuleMetadata(
            rule_id="AC-002", name="Auth Without Role Enforcement",
            description="Authenticated route missing role/permission check.",
            tags=["authorization", "privilege-escalation"],
        ))
        registry.register(IDORRiskRule(), RuleMetadata(
            rule_id="AC-003", name="IDOR Risk",
            description="Route parameter without ownership verification.",
            tags=["idor", "authorization", "object-level"],
        ))
        registry.register(DestructiveNoAuthRule(), RuleMetadata(
            rule_id="AC-004", name="Destructive Endpoint No Auth",
            description="DELETE/PUT/PATCH endpoint without authentication.",
            tags=["auth", "destructive", "data-integrity"],
        ))
        registry.register(SensitiveExfiltrationRule(), RuleMetadata(
            rule_id="AC-006", name="Data Exfiltration Endpoint No Auth",
            description="Export/download/report endpoint without authentication.",
            tags=["auth", "data-exfiltration", "bulk-access"],
        ))
        registry.register(BOLARule(), RuleMetadata(
            rule_id="AC-007", name="BOLA — Object-Level Auth via Query/Body",
            description="Handler accesses user-id field from req.query/body without ownership check.",
            tags=["bola", "authorization", "object-level", "idor"],
        ))
        return registry


# ─────────────────────────────────────────────────────────────────────────────
# Detection Rule Abstraction
# ─────────────────────────────────────────────────────────────────────────────

class DetectionRule(ABC):
    """Base class for all access control detection rules."""

    @property
    @abstractmethod
    def rule_id(self) -> str:
        """Unique short identifier, e.g. 'AC-001'."""

    @abstractmethod
    def check(
        self,
        route: RouteContext,
        file_ctx: FileContext,
    ) -> Optional[RuleResult]:
        """Evaluate the rule against a single route. Returns RuleResult or None."""


# ─────────────────────────────────────────────────────────────────────────────
# Concrete Rules
# ─────────────────────────────────────────────────────────────────────────────

class AdminNoAuthRule(DetectionRule):
    """AC-001: Admin or sensitive route accessible without authentication."""

    @property
    def rule_id(self) -> str:
        return "AC-001"

    def check(self, route: RouteContext, file_ctx: FileContext) -> Optional[RuleResult]:
        if _has_auth(route, file_ctx):
            return None

        path_lower = _normalize_versioned_path(route.path)
        path_segments = set(re.split(r"[/\-_.]", path_lower))
        is_admin = bool(_ADMIN_PATH_SEGMENTS & path_segments)
        is_sensitive = bool(_SENSITIVE_PATH_SEGMENTS & path_segments)
        if not (is_admin or is_sensitive):
            return None

        tier = "administrative" if is_admin else "sensitive"
        score = RiskScorer.score(
            route.method, route.path, False, False, route.has_path_param,
            route.classified_middleware,
        )
        severity = RiskScorer.to_severity(score)
        confidence = _compute_confidence(route, file_ctx)
        full_path_note = (
            f" Full resolved path: `{route.full_path}`."
            if route.full_path != route.path else ""
        )

        return RuleResult(
            rule_id=self.rule_id,
            severity=severity, confidence=confidence,
            category=VulnerabilityCategory.BROKEN_ACCESS,
            route=route,
            title=f"Unauthenticated {tier} route: {route.method.upper()} {route.path}",
            description=(
                f"The {tier} route `{route.method.upper()} {route.path}` has no "
                f"authentication middleware. Any unauthenticated user can access it.{full_path_note}"
            ),
            recommendation=(
                "Apply an authentication middleware (e.g. `verifyToken`, `requireAuth`) "
                "as the first argument of the route definition, or protect the entire "
                "router with `router.use(authMiddleware)` before mounting it."
            ),
            owasp_id="A01:2021", cwe_id="CWE-306",
        )


class AuthWithoutRoleRule(DetectionRule):
    """AC-002: Route has auth but no role/permission validation."""

    @property
    def rule_id(self) -> str:
        return "AC-002"

    def check(self, route: RouteContext, file_ctx: FileContext) -> Optional[RuleResult]:
        if not _has_auth(route, file_ctx):
            return None
        if _has_role(route, file_ctx):
            return None

        path_lower = _normalize_versioned_path(route.path)
        path_segments = set(re.split(r"[/\-_.]", path_lower))
        is_relevant = bool((_ADMIN_PATH_SEGMENTS | _SENSITIVE_PATH_SEGMENTS) & path_segments)
        if not is_relevant:
            return None

        score = RiskScorer.score(
            route.method, route.path, True, False, route.has_path_param,
            route.classified_middleware,
            auth_from_inheritance=file_ctx.inherited_auth and not file_ctx.global_auth_use,
        )
        severity = RiskScorer.to_severity(score)
        confidence = _compute_confidence(route, file_ctx)

        return RuleResult(
            rule_id=self.rule_id,
            severity=severity, confidence=confidence,
            category=VulnerabilityCategory.BROKEN_ACCESS,
            route=route,
            title=f"Missing role validation on protected route: {route.method.upper()} {route.path}",
            description=(
                f"Route `{route.method.upper()} {route.path}` requires authentication "
                f"but has no role or permission check. A low-privilege authenticated "
                f"user could invoke this endpoint and gain unauthorized access."
            ),
            recommendation=(
                "Add a role/permission middleware after authentication, e.g. "
                "`requireRole('admin')`, `checkPermission('users:write')`, or an ACL/policy check."
            ),
            owasp_id="A01:2021", cwe_id="CWE-285",
        )


class IDORRiskRule(DetectionRule):
    """AC-003: Route with :id parameter and no ownership verification (IDOR)."""

    @property
    def rule_id(self) -> str:
        return "AC-003"

    def check(self, route: RouteContext, file_ctx: FileContext) -> Optional[RuleResult]:
        if not route.has_path_param:
            return None
        if not _has_auth(route, file_ctx):
            return None
        if _has_role(route, file_ctx):
            return None
        if _has_ownership_check(route, file_ctx):
            return None

        params = _PATH_PARAM_RE.findall(route.path)
        param_str = ", ".join(p.lstrip("/") for p in params)

        score = RiskScorer.score(
            route.method, route.path, True, False, True,
            route.classified_middleware,
        )
        severity = RiskScorer.to_severity(score)
        confidence = _compute_confidence(route, file_ctx)

        return RuleResult(
            rule_id=self.rule_id,
            severity=severity, confidence=confidence,
            category=VulnerabilityCategory.IDOR,
            route=route,
            title=f"Potential IDOR on {route.method.upper()} {route.path}",
            description=(
                f"Route `{route.method.upper()} {route.path}` accepts path parameter(s) "
                f"`{param_str}` but no ownership verification was detected in the handler. "
                f"An authenticated user could access other users' resources by altering the ID, creating an exposure risk."
            ),
            recommendation=(
                "Verify the requested resource belongs to the authenticated user. "
                "ORM: `{{ userId: req.user.id, _id: req.params.id }}`. "
                "Inline: `if (resource.userId !== req.user.id) return res.status(403)...`"
            ),
            owasp_id="A01:2021", cwe_id="CWE-639",
        )


class DestructiveNoAuthRule(DetectionRule):
    """AC-004: DELETE/PUT/PATCH endpoint without authentication."""

    @property
    def rule_id(self) -> str:
        return "AC-004"

    def check(self, route: RouteContext, file_ctx: FileContext) -> Optional[RuleResult]:
        if route.method not in _DESTRUCTIVE_METHODS:
            return None
        if _has_auth(route, file_ctx):
            return None

        score = RiskScorer.score(
            route.method, route.path, False, False, route.has_path_param,
            route.classified_middleware,
        )
        severity = RiskScorer.to_severity(score)
        confidence = _compute_confidence(route, file_ctx)

        return RuleResult(
            rule_id=self.rule_id,
            severity=severity, confidence=confidence,
            category=VulnerabilityCategory.BROKEN_ACCESS,
            route=route,
            title=f"Unauthenticated destructive endpoint: {route.method.upper()} {route.path}",
            description=(
                f"The `{route.method.upper()}` endpoint `{route.path}` modifies or "
                f"deletes server-side state without requiring authentication."
            ),
            recommendation=(
                "Require authentication for all state-modifying operations. "
                "Apply `requireAuth` or equivalent as the first middleware argument."
            ),
            owasp_id="A01:2021", cwe_id="CWE-306",
        )


class RouterNoWrapperRule(DetectionRule):
    """AC-005: Router mounted without auth wrapper (stub — handled by detect_unprotected_mounts)."""

    @property
    def rule_id(self) -> str:
        return "AC-005"

    def check(self, route: RouteContext, file_ctx: FileContext) -> Optional[RuleResult]:
        return None


class SensitiveExfiltrationRule(DetectionRule):
    """AC-006: Data exfiltration endpoint without auth."""

    @property
    def rule_id(self) -> str:
        return "AC-006"

    def check(self, route: RouteContext, file_ctx: FileContext) -> Optional[RuleResult]:
        if _has_auth(route, file_ctx):
            return None

        path_lower = _normalize_versioned_path(route.path)
        segs = set(re.split(r"[/\-_.]", path_lower))
        hit_segs = sorted(_EXFIL_PATH_SEGMENTS & segs)
        if not hit_segs:
            return None
        if route.method in _DESTRUCTIVE_METHODS:
            return None

        score = RiskScorer.score(
            route.method, route.path, False, False, route.has_path_param,
            route.classified_middleware,
        )
        severity = RiskScorer.to_severity(max(score, 55))
        confidence = _compute_confidence(route, file_ctx)

        return RuleResult(
            rule_id=self.rule_id,
            severity=severity, confidence=confidence,
            category=VulnerabilityCategory.BROKEN_ACCESS,
            route=route,
            title=f"Unauthenticated data exfiltration endpoint: {route.method.upper()} {route.path}",
            description=(
                f"The endpoint `{route.method.upper()} {route.path}` contains "
                f"data-exfiltration segment(s) `{', '.join(hit_segs)}` and has no "
                f"authentication middleware. This could allow mass data extraction."
            ),
            recommendation=(
                "Apply authentication middleware and enforce rate limiting on all export "
                "and reporting endpoints. Audit-log every successful export."
            ),
            owasp_id="A01:2021", cwe_id="CWE-306",
        )


class BOLARule(DetectionRule):
    """
    AC-007: BOLA — Broken Object-Level Authorization via req.query/body.

    Fires when:
      - Handler snippet contains req.query.userId / req.body.userId (or similar)
      - No ownership check is present
      - No admin-level role check suppresses (IDOR already covered by AC-003)
    """

    @property
    def rule_id(self) -> str:
        return "AC-007"

    def check(self, route: RouteContext, file_ctx: FileContext) -> Optional[RuleResult]:
        # Only fire when handler accesses req.query/body id-like fields
        if not route.has_bola_signal:
            return None
        if _has_role(route, file_ctx):
            return None
        if _has_ownership_check(route, file_ctx):
            return None

        score = RiskScorer.score(
            route.method, route.path, _has_auth(route, file_ctx), False, False,
            route.classified_middleware,
        )
        # Floor at MEDIUM
        severity = RiskScorer.to_severity(max(score, 18))
        confidence = _compute_confidence(route, file_ctx)

        return RuleResult(
            rule_id=self.rule_id,
            severity=severity, confidence=confidence,
            category=VulnerabilityCategory.IDOR,
            route=route,
            title=f"BOLA: User-controlled ID in request body/query on {route.method.upper()} {route.path}",
            description=(
                f"Handler for `{route.method.upper()} {route.path}` reads a user-supplied "
                f"resource ID from `req.query` or `req.body` (e.g. `userId`, `id`) without "
                f"an ownership check. An unauthorized user could supply another user's ID to access or "
                f"modify their resources, creating an exposure risk."
            ),
            recommendation=(
                "Never trust client-supplied resource IDs for ownership. "
                "Derive the resource owner from `req.user.id` (the authenticated identity) "
                "rather than from query/body parameters. "
                "For bulk operations, validate each item individually."
            ),
            owasp_id="A01:2021", cwe_id="CWE-639",
        )


# ─────────────────────────────────────────────────────────────────────────────
# Helper Predicates
# ─────────────────────────────────────────────────────────────────────────────

def _matches_any(text: str, patterns: List[str]) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def _normalize_versioned_path(path: str) -> str:
    """Strip /v1/, /v2/ etc. prefix for segment matching — same sensitivity applies."""
    m = _VERSION_RE.match(path)
    if m and m.group(1):
        return m.group(1)
    return path.lower()


def _has_auth(route: RouteContext, file_ctx: FileContext) -> bool:
    inline_text = " ".join(route.inline_middleware)
    if _matches_any(inline_text, _AUTH_PATTERNS):
        return True
    # Semantic: check classified middleware for AUTH class
    if any(c.cls == MiddlewareClass.AUTH and c.confidence >= _SEMANTIC_THRESHOLD
           for c in route.classified_middleware):
        return True
    if file_ctx.global_auth_use:
        return True
    if file_ctx.inherited_auth:
        return True
    return False


def _has_role(route: RouteContext, file_ctx: FileContext) -> bool:
    inline_text = " ".join(route.inline_middleware)
    if _matches_any(inline_text, _ROLE_PATTERNS):
        return True
    if any(c.cls == MiddlewareClass.ROLE and c.confidence >= _SEMANTIC_THRESHOLD
           for c in route.classified_middleware):
        return True
    if file_ctx.global_role_use:
        return True
    if file_ctx.inherited_role:
        return True
    return False


def _has_ownership_check(route: RouteContext, file_ctx: Optional[FileContext] = None) -> bool:
    """
    v2: Enhanced ownership check.
    1. Standard _OWNERSHIP_PATTERNS in handler + inline middleware.
    2. ORM-aware patterns (_ORM_OWNERSHIP_PATTERNS).
    3. Alias-aware: if req.params.id was aliased to `id`, check if `id` appears
       in an ORM/ownership context.
    """
    combined = route.handler_snippet + " " + " ".join(route.inline_middleware)
    if _matches_any(combined, _OWNERSHIP_PATTERNS):
        return True
    if _matches_any(combined, _ORM_OWNERSHIP_PATTERNS):
        return True

    # Alias-aware: if file has param_aliases, check if alias is used in ownership context
    if file_ctx and file_ctx.param_aliases:
        for alias in file_ctx.param_aliases:
            # alias used inside a findById/findOne/where or compared to req.user
            if re.search(
                rf"\b{re.escape(alias)}\b.{{0,60}}(?:findById|findOne|findUnique|where|userId|user_id)",
                combined, re.IGNORECASE
            ):
                return True
            if re.search(
                rf"req\.user(?:\.id|\.\_id)\s*[=!]==?\s*\b{re.escape(alias)}\b",
                combined, re.IGNORECASE
            ):
                return True
    return False


def _compute_confidence(route: RouteContext, file_ctx: FileContext) -> Confidence:
    inline_text = " ".join(route.inline_middleware)
    has_inline = (
        _matches_any(inline_text, _AUTH_PATTERNS)
        or _matches_any(inline_text, _ROLE_PATTERNS)
        or any(c.cls in (MiddlewareClass.AUTH, MiddlewareClass.ROLE)
               and c.confidence >= _SEMANTIC_THRESHOLD
               for c in route.classified_middleware)
    )
    has_global = file_ctx.global_auth_use or file_ctx.global_role_use
    has_inherited = file_ctx.inherited_auth or file_ctx.inherited_role
    return RiskScorer.to_confidence(has_inline, has_global, has_inherited)


def _clean_path(raw: str) -> str:
    return raw.strip("\"'`").strip()


def _extract_inline_middleware(rest_args: str) -> List[str]:
    if not rest_args.strip():
        return []
    handler_match = _HANDLER_TOKEN_RE.search(rest_args)
    if handler_match:
        rest_args = rest_args[: handler_match.start()]
    tokens = _MIDDLEWARE_TOKEN_RE.findall(rest_args)
    skip = {"req", "res", "next", "err", "e", "error", "cb", "callback"}
    return [t.strip() for t in tokens if t.strip() and t.strip().lower() not in skip]


def _is_in_skip_dir(path: Path) -> bool:
    return any(part in _SKIP_DIRS for part in path.parts)


def _pre_filter(content: str) -> bool:
    return bool(_ROUTE_SIGNAL_RE.search(content))


def _detect_bola_signal(handler_snippet: str) -> bool:
    """Return True if the handler snippet contains req.query/body user-id access."""
    return _matches_any(handler_snippet, _BOLA_PATTERNS)


# ─────────────────────────────────────────────────────────────────────────────
# File Parser  (v2 — template literals, versioned API, param aliases, BOLA)
# ─────────────────────────────────────────────────────────────────────────────

class FileParser:
    """
    Parses a single JS/TS file and extracts:
      - Standard route declarations (_ROUTE_RE)
      - Template-literal route declarations (_TEMPLATE_ROUTE_RE)
      - Chained route declarations (_CHAINED_ROUTE_RE)
      - File-level context (global middleware, auth imports, exports, param aliases)
    """

    CONTEXT_LINES_BEFORE = 5
    CONTEXT_LINES_AFTER  = 8
    HANDLER_SNIPPET_LINES = 10

    def __init__(self, file_path: Path) -> None:
        self._path = file_path
        self._content = ""
        self._lines: List[str] = []

    def parse(self) -> Tuple[List[RouteContext], FileContext]:
        try:
            raw = self._path.read_bytes()
            if len(raw) > _MAX_FILE_BYTES:
                return [], self._empty_file_ctx()
            self._content = raw.decode("utf-8", errors="replace")
        except Exception:
            return [], self._empty_file_ctx()

        if not _pre_filter(self._content):
            return [], self._empty_file_ctx()

        self._lines = self._content.splitlines()
        file_ctx = self._build_file_context()
        routes = self._extract_routes(file_ctx)
        routes += self._extract_template_routes(file_ctx)
        routes += self._extract_chained_routes()
        return routes, file_ctx

    def _build_file_context(self) -> FileContext:
        auth_imports: Set[str] = set()
        router_use_entries: List[str] = []
        global_auth_use = False
        global_role_use = False
        exported_var: Optional[str] = None
        param_aliases: Dict[str, str] = {}

        for line in self._lines:
            # Auth imports
            if re.search(r"\b(?:require|import)\b", line, re.IGNORECASE):
                if _matches_any(line, _AUTH_PATTERNS):
                    id_match = re.search(r"(?:const|let|var)\s+(\w+)\s*=", line)
                    if id_match:
                        auth_imports.add(id_match.group(1))

            # Global use() calls
            use_match = _ROUTER_USE_RE.search(line)
            if use_match:
                args_str = (use_match.group("args") or "").strip()
                router_use_entries.append(args_str)
                if _matches_any(args_str, _AUTH_PATTERNS):
                    global_auth_use = True
                if _matches_any(args_str, _ROLE_PATTERNS):
                    global_role_use = True

            # module.exports
            exp_m = _MODULE_EXPORTS_RE.search(line)
            if exp_m:
                exported_var = exp_m.group("var")

            # req.params alias collection
            for alias_m in _PARAM_ALIAS_RE.finditer(line):
                param_aliases[alias_m.group("alias")] = alias_m.group("param")

        return FileContext(
            path=str(self._path),
            global_auth_use=global_auth_use,
            global_role_use=global_role_use,
            auth_imports=auth_imports,
            router_use_entries=router_use_entries,
            exported_var=exported_var,
            param_aliases=param_aliases,
        )

    def _build_route(
        self,
        match: re.Match,
        line_number: int,
        idx: int,
        all_raw_matches: List[Tuple[re.Match, int]],
        is_dynamic: bool = False,
        file_ctx: Optional[FileContext] = None,
    ) -> RouteContext:
        path_raw   = match.group("path_raw") or ""
        rest_args  = match.group("rest_args") or ""
        method     = match.group("method").lower()
        path       = _clean_path(path_raw)

        ctx_start = max(0, line_number - 1 - self.CONTEXT_LINES_BEFORE)
        ctx_end   = min(len(self._lines), line_number + self.CONTEXT_LINES_AFTER)
        context_window = "\n".join(self._lines[ctx_start:ctx_end])

        handler_start = line_number
        if idx + 1 < len(all_raw_matches):
            next_line = all_raw_matches[idx + 1][1]
            handler_end = min(next_line - 1, handler_start + self.HANDLER_SNIPPET_LINES)
        else:
            handler_end = min(len(self._lines), handler_start + self.HANDLER_SNIPPET_LINES)
        handler_end = max(handler_start, handler_end)
        handler_snippet = "\n".join(self._lines[handler_start:handler_end])

        inline_mw  = _extract_inline_middleware(rest_args)
        classified = _CLASSIFIER.classify_all(inline_mw)
        bola_signal = _detect_bola_signal(handler_snippet)

        return RouteContext(
            file=str(self._path),
            line_number=line_number,
            method=method,
            path=path,
            inline_middleware=inline_mw,
            raw_call=match.group(0)[:200],
            context_window=context_window,
            handler_snippet=handler_snippet,
            classified_middleware=classified,
            is_dynamic_path=is_dynamic,
            has_bola_signal=bola_signal,
        )

    def _extract_routes(self, file_ctx: Optional[FileContext] = None) -> List[RouteContext]:
        raw_matches = [
            (match, self._content[: match.start()].count("\n") + 1)
            for match in _ROUTE_RE.finditer(self._content)
        ]
        return [
            self._build_route(m, ln, i, raw_matches, False, file_ctx)
            for i, (m, ln) in enumerate(raw_matches)
        ]

    def _extract_template_routes(self, file_ctx: Optional[FileContext] = None) -> List[RouteContext]:
        """v2: Extract routes with template-literal paths."""
        raw_matches = [
            (match, self._content[: match.start()].count("\n") + 1)
            for match in _TEMPLATE_ROUTE_RE.finditer(self._content)
        ]
        return [
            self._build_route(m, ln, i, raw_matches, True, file_ctx)
            for i, (m, ln) in enumerate(raw_matches)
        ]

    def _extract_chained_routes(self) -> List[RouteContext]:
        routes: List[RouteContext] = []
        for outer_match in _CHAINED_ROUTE_RE.finditer(self._content):
            path       = _clean_path(outer_match.group("path"))
            chain_str  = outer_match.group("chain")
            base_line  = self._content[: outer_match.start()].count("\n") + 1

            ctx_start  = max(0, base_line - 1 - self.CONTEXT_LINES_BEFORE)
            ctx_end    = min(len(self._lines), base_line + self.CONTEXT_LINES_AFTER)
            context_window = "\n".join(self._lines[ctx_start:ctx_end])
            snip_end   = min(len(self._lines), base_line + self.HANDLER_SNIPPET_LINES)
            handler_snippet = "\n".join(self._lines[base_line:snip_end])

            for method_match in _CHAINED_METHOD_RE.finditer(chain_str):
                method    = method_match.group("method").lower()
                args_str  = method_match.group("args") or ""
                inline_mw = _extract_inline_middleware(args_str)
                classified = _CLASSIFIER.classify_all(inline_mw)
                bola_signal = _detect_bola_signal(handler_snippet)

                routes.append(RouteContext(
                    file=str(self._path),
                    line_number=base_line,
                    method=method,
                    path=path,
                    inline_middleware=inline_mw,
                    raw_call=outer_match.group(0)[:200],
                    context_window=context_window,
                    handler_snippet=handler_snippet,
                    classified_middleware=classified,
                    is_chained=True,
                    has_bola_signal=bola_signal,
                ))

        return routes

    def detect_unprotected_mounts(self) -> List[Tuple[str, int, str]]:
        findings = []
        for line_idx, line in enumerate(self._lines, start=1):
            use_match = _ROUTER_USE_RE.search(line)
            if not use_match:
                continue
            args_str = (use_match.group("args") or "").strip()
            if _matches_any(args_str, _AUTH_PATTERNS):
                continue
            tokens = _MIDDLEWARE_TOKEN_RE.findall(args_str)
            router_like = [
                t for t in tokens
                if re.search(r"[Rr]outer|[Cc]ontroller|[Rr]outes", t)
            ]
            if router_like:
                path_match = use_match.group("path") or ""
                mount_path = _clean_path(path_match.rstrip(", ")) or "/"
                findings.append((mount_path, line_idx, line.strip()[:200]))
        return findings

    @property
    def lines(self) -> List[str]:
        """Expose parsed lines for suppression checks."""
        return self._lines

    def _empty_file_ctx(self) -> FileContext:
        return FileContext(
            path=str(self._path),
            global_auth_use=False,
            global_role_use=False,
            auth_imports=set(),
            router_use_entries=[],
        )


# ─────────────────────────────────────────────────────────────────────────────
# Vulnerability Builder
# ─────────────────────────────────────────────────────────────────────────────

class VulnerabilityBuilder:
    """Converts a RuleResult into a NormalizedVulnerability for the output schema."""

    @staticmethod
    def build(result: RuleResult) -> NormalizedVulnerability:
        route = result.route
        metadata: Dict[str, Any] = {
            "rule_id":   result.rule_id,
            "method":    route.method.upper(),
            "route_path": route.path,
            "full_path": route.full_path,
            "inline_middleware": route.inline_middleware,
            "classified_middleware": [
                {
                    "token": c.token, "class": c.cls.value,
                    "confidence": c.confidence,
                    **({"privilege_level": c.privilege_level} if c.privilege_level else {}),
                }
                for c in route.classified_middleware
            ],
            "risk_score":       route.risk_score,
            "is_chained_route": route.is_chained,
            "is_dynamic_path":  route.is_dynamic_path,
            "has_bola_signal":  route.has_bola_signal,
            "source_tool":      "access_control_analyzer",
            "owasp":            result.owasp_id,
        }
        return NormalizedVulnerability(
            id=str(uuid.uuid4()),
            type=f"access-control.{result.rule_id.lower()}",
            category=result.category,
            title=result.title,
            description=result.description,
            file=route.file,
            line=route.line_number,
            severity=result.severity,
            confidence=result.confidence,
            source=ScannerSource.INTERNAL_ACCESS_CONTROL,
            owasp_id=result.owasp_id,
            cwe_id=result.cwe_id,
            metadata=metadata,
        )

    @staticmethod
    def build_mount_finding(
        file_path: str,
        mount_path: str,
        line_number: int,
        raw_call: str,
    ) -> NormalizedVulnerability:
        return NormalizedVulnerability(
            id=str(uuid.uuid4()),
            type="access-control.ac-005",
            category=VulnerabilityCategory.BROKEN_ACCESS,
            title=f"Router mounted without auth middleware at `{mount_path}`",
            description=(
                f"A sub-router is mounted at `{mount_path}` without any authentication "
                f"middleware in the mount call."
            ),
            file=file_path,
            line=line_number,
            severity=Severity.HIGH,
            confidence=Confidence.MEDIUM,
            source=ScannerSource.INTERNAL_ACCESS_CONTROL,
            owasp_id="A01:2021",
            cwe_id="CWE-306",
            metadata={
                "rule_id":    "AC-005",
                "mount_path": mount_path,
                "raw_call":   raw_call,
                "risk_score": 65,
                "source_tool": "access_control_analyzer",
                "owasp":      "A01:2021",
                "recommendation": (
                    "Mount sub-routers with a shared auth middleware: "
                    "`app.use('/admin', requireAuth, adminRouter)`."
                ),
            },
        )


# ─────────────────────────────────────────────────────────────────────────────
# Main Analyzer Engine  (v2)
# ─────────────────────────────────────────────────────────────────────────────

class AccessControlAnalyzer:
    """
    Orchestrates file discovery, RouterGraph construction, parallel rule evaluation,
    risk scoring, suppression, caching, deduplication, and correlation.
    """

    def __init__(
        self,
        project_dir: Path,
        job_id: str,
        rule_registry: Optional[RuleRegistry] = None,
        suppression_config: Optional[SuppressionConfig] = None,
        use_cache: bool = True,
    ) -> None:
        self._project_dir = project_dir
        self._job_id = job_id
        self._log = JobLogger(job_id, "analyzer.access_control")
        self._registry = rule_registry or RuleRegistry.default()
        self._builder = VulnerabilityBuilder()
        self._seen: Set[Tuple[str, str, str, str]] = set()
        self._router_graph = RouterGraph()
        self._suppressor = SuppressionEngine(suppression_config)
        self._correlator = FindingCorrelator()
        self._cache = FileResultCache() if use_cache else None
        if self._cache:
            self._cache.load()

    def run(self) -> List[NormalizedVulnerability]:
        js_files = self._collect_files()
        if not js_files:
            self._log.info("No JS/TS files found — skipping access control analysis")
            return []

        # Phase 1: Build cross-file router graph
        self._log.info(f"Building RouterGraph across {len(js_files)} files…")
        self._router_graph.build(js_files)

        # Phase 2: Parallel per-file analysis
        self._log.info(f"Scanning {len(js_files)} JS/TS files for access control issues")
        all_findings: List[NormalizedVulnerability] = []
        files_with_routes = 0

        workers = min(_MAX_WORKERS, max(1, len(js_files)))
        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_map = {
                executor.submit(self._analyze_file, fpath): fpath
                for fpath in js_files
            }
            for future in as_completed(future_map):
                fpath = future_map[future]
                try:
                    file_findings = future.result()
                    if file_findings:
                        files_with_routes += 1
                        all_findings.extend(file_findings)
                except Exception as exc:
                    self._log.warning(f"Error analysing {fpath}: {exc}")

        # Phase 3: Correlate + deduplicate
        all_findings = self._correlator.deduplicate(all_findings)
        all_findings = self._correlator.escalate(all_findings)

        if self._cache:
            self._cache.save()

        self._log.info(
            f"Access control analysis complete: {len(all_findings)} findings "
            f"across {files_with_routes} files with routes"
        )
        return all_findings

    def _collect_files(self) -> List[Path]:
        results: List[Path] = []
        for ext in _ANALYZE_EXTENSIONS:
            for fpath in self._project_dir.rglob(f"*{ext}"):
                if not _is_in_skip_dir(fpath):
                    results.append(fpath)
        results.sort()
        return results

    def _analyze_file(self, fpath: Path) -> List[NormalizedVulnerability]:
        # Cache check
        if self._cache:
            try:
                raw = fpath.read_bytes()
                content_str = raw.decode("utf-8", errors="replace")
                cached = self._cache.get(fpath, content_str)
                if cached is not None:
                    return cached
            except Exception:
                content_str = ""
        else:
            content_str = ""

        parser = FileParser(fpath)
        routes, file_ctx = parser.parse()

        # Inject RouterGraph inheritance
        file_ctx.inherited_auth  = self._router_graph.get_inherited_auth(fpath)
        file_ctx.inherited_role  = self._router_graph.get_inherited_role(fpath)
        file_ctx.mount_prefix    = self._router_graph.get_mount_prefix(fpath)

        file_findings: List[NormalizedVulnerability] = []
        rules = self._registry.get_enabled_rules()
        file_lines = parser.lines

        for route in routes:
            # Resolve full path
            if file_ctx.mount_prefix and file_ctx.mount_prefix != "/":
                prefix = file_ctx.mount_prefix.rstrip("/")
                suffix = route.path if route.path.startswith("/") else "/" + route.path
                route.full_path = prefix + suffix
            else:
                route.full_path = route.path

            # Compute risk score
            has_auth_final = _has_auth(route, file_ctx)
            has_role_final = _has_role(route, file_ctx)
            auth_from_inh  = file_ctx.inherited_auth and not file_ctx.global_auth_use
            route.risk_score = RiskScorer.score(
                route.method, route.path,
                has_auth_final, has_role_final,
                route.has_path_param,
                route.classified_middleware,
                auth_from_inheritance=auth_from_inh,
            )

            for rule in rules:
                result = rule.check(route, file_ctx)
                if result is None:
                    continue

                # Suppression check
                suppressed, reason = self._suppressor.is_suppressed(route, rule.rule_id, file_lines)
                if suppressed:
                    continue

                dedup_key = (route.file, route.method, route.path, rule.rule_id)
                if dedup_key in self._seen:
                    continue
                self._seen.add(dedup_key)
                file_findings.append(self._builder.build(result))

        # AC-005: unprotected router mounts
        for mount_path, line_no, raw_call in parser.detect_unprotected_mounts():
            dedup_key = (str(fpath), "USE", mount_path, "AC-005")
            if dedup_key not in self._seen:
                self._seen.add(dedup_key)
                file_findings.append(
                    self._builder.build_mount_finding(
                        file_path=str(fpath),
                        mount_path=mount_path,
                        line_number=line_no,
                        raw_call=raw_call,
                    )
                )

        # Update cache
        if self._cache and content_str:
            self._cache.put(fpath, content_str, file_findings)

        return file_findings


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def analyze_access_control(
    project_dir: Path,
    job_id: str,
    rule_registry: Optional[RuleRegistry] = None,
    suppression_config: Optional[SuppressionConfig] = None,
    use_cache: bool = True,
) -> List[NormalizedVulnerability]:
    """
    Entry point — matches the calling convention of all SecureTrail analyzers.

    Called by config_orchestrator.run_config_analyzers() in a thread pool executor:
        loop.run_in_executor(None, analyze_access_control, project_dir, job_id)

    Args:
        project_dir:         Root of the extracted project.
        job_id:              UUID string for log correlation and progress tracking.
        rule_registry:       Optional custom RuleRegistry (defaults to all built-in rules).
        suppression_config:  Optional SuppressionConfig for allowlisting paths/rules.
        use_cache:           Enable content-hash incremental analysis cache (default True).

    Returns:
        List of NormalizedVulnerability instances ready for the normalization pipeline.
    """
    analyzer = AccessControlAnalyzer(
        project_dir, job_id, rule_registry, suppression_config, use_cache
    )
    return analyzer.run()
