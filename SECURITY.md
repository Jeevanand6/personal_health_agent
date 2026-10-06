# Security Architecture & Policies

This document outlines the security architecture, controls, and hardening standards implemented in the **AI-Powered Personal Health Copilot** platform.

---

## 1. Multi-Tenant Authorization & IDOR Defense

Medical document confidentiality requires strict tenant boundary enforcement:
- **Ownership Verification**: Every query for a document, OCR extraction, AI structured data, observation interpretation, timeline event, or health summary enforces:
  $$\text{document.user\_id} == \text{current\_user.id}$$
- **Anti-Enumeration (IDOR Prevention)**: If User A queries or attempts an operation on User B's document ID, the system returns **HTTP 404 Not Found** with a generic message (`"Document not found or access denied."`) rather than HTTP 403 Forbidden. This prevents malicious actors from discovering the existence of resource identifiers.
- **Preview Isolation**: Document previews (inline files or downloads) require authenticated user resolution via Bearer authorization or signed user session tokens; direct unauthenticated access to the physical storage paths is blocked.

---

## 2. Authentication & Cryptography

### Password Hashing (Argon2id)
- Passwords are hashed using the **Argon2id** password hashing algorithm (OWASP recommended):
  - Memory cost: 65,536 KiB (64 MB)
  - Time cost (iterations): 3
  - Parallelism: 4
  - Hash length: 32 bytes
  - Salt length: 16 bytes
- **Timing Attack Mitigation**: Password verification utilizes dummy hash checks on non-existent or invalid accounts to guarantee uniform response times and prevent username enumeration via timing side-channels.

### Password Strength Policy
- Passwords must meet the following OWASP-aligned standards:
  - Minimum 8 characters, maximum 128 characters.
  - At least one uppercase letter (`A-Z`).
  - At least one lowercase letter (`a-z`).
  - At least one numerical digit (`0-9`).
  - At least one special symbol (`!@#$%^&*()_+-=[]{};':",.<>/?~` `).
  - Rejection of common dictionary and leaked passwords.
  - Rejection of passwords containing the user's email username.

### JWT Security
- **Algorithm Enforcement**: Strict enforcement of `HS256`. The `none` algorithm and algorithm confusion attacks are explicitly rejected.
- **Claims Verification**: Tokens include `sub` (user UUID), `iat` (issued-at), `nbf` (not-before), `exp` (expiration), `type` (`access`), and a cryptographically unique `jti` (JWT ID).
- **Token Type Isolation**: Access tokens are marked with `type: "access"`; refresh or auxiliary tokens cannot be presented as access tokens.
- **Revocation Support**: An in-memory/persistent token blacklist tracks revoked `jti` identifiers, immediately invalidating compromised sessions.
- **Cryptographic Secret Key**: Minimum 32-character key requirement. Default development secrets are blocked in production environments.

---

## 3. Input Validation & XSS Defense

- **Pydantic Schemas**: All incoming request payloads are strictly validated against Pydantic models with field-level constraints, pattern matching, and length limitations.
- **Character Sanitization**: Text inputs are stripped of null bytes (`\x00`), non-printable control characters, and leading/trailing whitespace.
- **HTML Entity Escaping**: User-contributed strings (names, notes, search queries) are escaped (`html.escape`) before storage or reflection to eliminate Stored and Reflected Cross-Site Scripting (XSS).
- **Search Query Protection**: Timeline and document search terms are sanitized and length-capped to mitigate ReDoS and SQL parameter abuse.

---

## 4. File Upload & Storage Security

Uploaded medical records undergo a multi-layered verification process before acceptance:

1. **Extension Whitelist**: Only `.pdf`, `.jpg`, `.jpeg`, and `.png` are accepted. Executables, scripts, and archives are rejected with HTTP 400.
2. **MIME Validation**: Validates declared `Content-Type` against the allowable extensions.
3. **Magic Byte Signature Inspection**:
   - PDF: `%PDF-` / `%PDF`
   - JPEG: `\xff\xd8\xff`
   - PNG: `\x89PNG\r\n\x1a\n`
4. **Image Structural Verification**: For `.jpg` and `.png` uploads, Pillow (`Image.verify()`) verifies structural image validity, blocking polyglot image exploits and corrupt payloads.
5. **Path Traversal Guards**:
   - Original filenames are stripped of `..`, `/`, `\`, null bytes, and non-alphanumeric characters.
   - Files are stored on disk using **random UUIDs** (`<uuid>.<ext>`), completely decoupling the physical filesystem path from user input.
   - Filesystem paths are verified with `os.path.commonpath` to ensure they reside strictly within the designated storage directory.
6. **Maximum File Size Limit**: Enforces a strict upload limit (default 15 MB). Streams are monitored in real time and aborted with HTTP 413 if the limit is exceeded, with automatic cleanup of partial files.

---

## 5. SQL Injection Protection

- **SQLAlchemy 2.0 ORM**: The application exclusively utilizes parameterized SQLAlchemy ORM constructs.
- **No Raw SQL Concatenation**: Search filters, IDs, dates, and category parameters are bound via parameterized SQL expressions (`ilike`, `filter`, `in_`), preventing SQL injection attacks.

---

## 6. Tiered Rate Limiting

To prevent brute-force credential stuffing and denial-of-service on computationally heavy AI pipelines, tiered sliding-window rate limits are enforced per client IP:
- **Authentication Tier** (`/api/auth/login`, `/api/auth/register`): 10 requests / minute.
- **Computation / AI Tier** (`/api/documents/upload`, `/ocr`, `/extract`, `/interpret`, `/health-summary/generate`): 30 requests / minute.
- **General API Tier**: 120 requests / minute.
- **Abuse Response**: When limits are exceeded, the API responds with **HTTP 429 Too Many Requests**, providing `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers.

---

## 7. Secure HTTP Headers

All HTTP responses automatically include OWASP recommended defense-in-depth headers:
- `X-Content-Type-Options: nosniff` (Prevents MIME sniffing)
- `X-Frame-Options: SAMEORIGIN` (Allows application previews while preventing third-party clickjacking)
- `X-XSS-Protection: 1; mode=block` (Browser XSS filter)
- `Referrer-Policy: strict-origin-when-cross-origin` (Protects referrer URLs)
- `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()`
- `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'self';`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` (Enforced in production/HTTPS)
- `Cache-Control: no-store, no-cache, must-revalidate, private` (Anti-caching on clinical and authentication endpoints)
- `X-Request-ID`: Unique correlation UUID attached to every response for distributed tracing.

---

## 8. CORS Security

- **No Wildcard with Credentials**: In accordance with the W3C CORS specification, wildcard origins (`*`) are disallowed when `allow_credentials=True`.
- **Explicit Allowed Origins**: Restricted to verified domain origins (configured via `CORS_ORIGINS`).
- **Explicit HTTP Methods**: Restricted to `["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]`.
- **Preflight Cache**: `max_age=600` to prevent unnecessary CORS preflight floods.

---

## 9. Sensitive Information Redaction in Application Logs

Application logs must **NEVER** expose Protected Health Information (PHI) or authentication secrets.

### Blacklisted Elements
The logging pipeline enforces automatic regex redaction on all log records and parameters:
- **Passwords**: Plaintext or hashed passwords in JSON, queries, or logs $\rightarrow$ `[REDACTED_PASSWORD]`.
- **JWT Tokens**: Any three-part base64url string (`eyJ...`) $\rightarrow$ `[REDACTED_JWT]`.
- **Authorization Tokens**: Bearer tokens $\rightarrow$ `Bearer [REDACTED_TOKEN]`.
- **API Keys**: Google AI keys (`AIza...`), OpenAI keys (`sk-...`), or `api_key` $\rightarrow$ `[REDACTED_API_KEY]`.
- **Medical Document Contents**: Raw OCR text, cleaned text, or clinical records $\rightarrow$ `[REDACTED_MEDICAL_CONTENT]`.

---

## 10. Audit Logging & Compliance

A dedicated `AuditLog` model and `audit_service` record security and compliance events across the platform.

### Required Audit Events
1. **`LOGIN`**: Authenticated sessions and failed login attempts (with failure reason).
2. **`DOCUMENT_UPLOAD`**: Document creation, file size, MIME type, and document classification.
3. **`DOCUMENT_VIEW`**: Viewing metadata, downloading files, or inspecting OCR/AI extractions.
4. **`DOCUMENT_DELETE`**: Permanent purging of medical documents.
5. **`AI_PROCESSING`**: OCR text extraction, structured AI synthesis, laboratory interpretation, and health summary generation.
6. **`DATA_EXPORT`**: FHIR R4 Bundle exports and bulk health data downloads.

### Audit Record Schema
- `timestamp`: UTC ISO-8601 timestamp.
- `event_type`: One of the 6 audited event types.
- `status`: `SUCCESS` or `FAILURE`.
- `user_id`: Authenticated user UUID (or anonymous for failed auth).
- `resource_id`: Targeted document, bundle, or patient identifier.
- `ip_address`: Client IP address.
- `user_agent`: Client device/browser user agent.
- `details`: Sanitized metadata dictionary (guaranteed free of passwords, tokens, API keys, and medical text).

---

## 11. Error Sanitization

- **No Traceback Exposure**: Unhandled internal exceptions return a generic message:
  ```json
  {
    "detail": "An internal server error occurred. Please try again later.",
    "request_id": "c138f0e5-7973-4217-bfbe-d9dfaa855650"
  }
  ```
- **Correlation Tracking**: The client receives a `request_id` which corresponds to the internal server log for troubleshooting, ensuring database connection strings, stack traces, and local filesystem paths are never leaked to users.

---

## 12. Vulnerability Reporting

To report security vulnerabilities or concerns, contact the security team directly or file a confidential security advisory.
