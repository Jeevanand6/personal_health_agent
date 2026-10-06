# Production Security Checklist

Prior to deploying the **AI-Powered Personal Health Copilot** platform into a staging or production environment, complete and verify every item on this checklist.

---

## 1. Secrets & Environment Configuration

- [ ] **Generate Production Secret Key**:
  - Replace development `SECRET_KEY` with a cryptographically strong random string of at least 32 bytes:
    ```bash
    python -c "import secrets; print(secrets.token_hex(32))"
    ```
  - Verify that the application fails to start if `APP_ENV=production` and the secret key contains default development values.
- [ ] **Protect Environment Files**:
  - Verify that `.env` and `.env.*` are excluded in `.gitignore` and `.dockerignore`.
  - Store production secrets in a dedicated secret manager (e.g., AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault) rather than in plain text files.
- [ ] **AI Provider API Key Protection**:
  - Store `GEMINI_API_KEY` and `OPENAI_API_KEY` securely.
  - Verify that API keys are injected via HTTP request headers (`x-goog-api-key`, `Authorization`) and never passed as URL query parameters.
- [ ] **Database Credentials**:
  - Use strong, unique database credentials for production.
  - Never run with default user/password in production.

---

## 2. Network & Transport Security (TLS/HTTPS)

- [ ] **Enforce TLS 1.3 / HTTPS**:
  - Configure reverse proxy (Nginx, Caddy, Cloudflare, or AWS ALB) to terminate TLS.
  - Redirect all plaintext HTTP traffic to HTTPS (301 Permanent Redirect).
- [ ] **HSTS (HTTP Strict Transport Security)**:
  - Verify that `Strict-Transport-Security: max-age=31536000; includeSubDomains` is returned on all HTTPS responses.
- [ ] **CORS Origins Lockdown**:
  - Explicitly list allowed frontend production domains in `CORS_ORIGINS` (e.g. `https://healthcopilot.example.com`).
  - Verify that wildcard `*` is not present when `allow_credentials=True`.
- [ ] **Trusted Proxy Configuration**:
  - Restrict `X-Forwarded-For` header trust to known upstream load balancers or Cloudflare IP ranges to prevent IP spoofing for rate limits.

---

## 3. Web Application & Header Hardening

- [ ] **Verify Defense-in-Depth Headers**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN` (or `DENY`)
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: accelerometer=(), camera=(), geolocation=(), ...`
  - `Content-Security-Policy` with self-origin restrictions.
- [ ] **Anti-Caching for Sensitive PHI**:
  - Verify that `Cache-Control: no-store, no-cache, must-revalidate, private` is delivered on `/api/auth/*`, `/api/documents/*`, `/api/fhir/*`, and `/api/timeline/*`.
- [ ] **Rate Limiting Verification**:
  - Test that authentication routes throttle at 10 requests / minute per client IP.
  - Test that document processing endpoints throttle at 30 requests / minute.
  - Verify that throttled requests receive `HTTP 429 Too Many Requests` with `Retry-After`.

---

## 4. Multi-Tenant Isolation & Access Control (IDOR)

- [ ] **Multi-Tenant Document Access Verification**:
  - Run `python backend/verify_phase11.py` before every release.
  - Verify that User A cannot read, download, delete, OCR, or interpret documents belonging to User B.
  - Ensure unauthorized document lookups return `HTTP 404 Not Found` rather than `HTTP 403 Forbidden` to prevent identifier enumeration.
- [ ] **Token Revocation Check**:
  - Verify that user logout or security resets add token `jti` to the revocation list.
  - Verify that access tokens have a limited lifetime (60 minutes maximum).
- [ ] **Password Strength Enforcement**:
  - Verify that passwords with fewer than 8 characters, missing character classes, or common weak dictionary passwords are rejected at registration.

---

## 5. File Upload & Storage Hardening

- [ ] **File Format Enforcement**:
  - Ensure strict whitelist is active: `.pdf`, `.jpg`, `.jpeg`, `.png`.
  - Verify magic byte verification blocks disguised executables or scripts.
  - Verify Pillow image verification blocks corrupted or polyglot image files.
- [ ] **Path Traversal Guards**:
  - Verify that uploaded documents are stored under randomized UUID filenames (`<uuid>.<ext>`) rather than original client filenames.
  - Confirm that `os.path.commonpath` checks prevent directory traversal outside `LOCAL_STORAGE_DIR`.
- [ ] **Volume & Storage Permissions**:
  - Set storage directory permissions to `chmod 700` or `750` so only the backend application user has read/write permissions.
  - Mount upload volume with `noexec` option if supported by the host filesystem.
- [ ] **Maximum Upload Size**:
  - Enforce max size limit (default 15 MB) both in FastAPI and reverse proxy (`client_max_body_size 15M;` in Nginx).

---

## 6. Database Hardening

- [ ] **PostgreSQL Network Isolation**:
  - Do not expose port `5432` to the public Internet; bind database only to internal docker network or private VPC subnet.
- [ ] **Least Privilege User**:
  - Run application under a dedicated unprivileged database role without `SUPERUSER` or `CREATEDB` permissions.
- [ ] **Connection Security**:
  - Enforce SSL mode (`sslmode=require` or `sslmode=verify-full`) between backend and database in production.
- [ ] **Database Backups & Encryption**:
  - Enable Automated Daily Backups with Point-In-Time Recovery (PITR).
  - Encrypt database volume at rest using AES-256 (e.g. AWS RDS encryption, LUKS, or managed volume encryption).

---

## 7. Container & Operating System Hardening

- [ ] **Non-Root Container User**:
  - Run the Docker container as an unprivileged user (`USER appuser`) rather than `root`.
- [ ] **Read-Only Root Filesystem**:
  - Run containers with `--read-only` flag where possible, with writable mounts restricted to `/app/storage_data` and `/tmp`.
- [ ] **Minimal Base Images**:
  - Use slim/alpine base images (`python:3.11-slim`, `postgres:16-alpine`) to minimize attack surface and CVE footprint.
- [ ] **Dependency Audits**:
  - Run security vulnerability scans:
    ```bash
    pip install pip-audit
    pip-audit -r requirements.txt
    ```

---

## 8. Logging, Monitoring & Audit Compliance

- [ ] **Verify Sensitive Data Redaction**:
  - Verify that application logs never contain passwords, JWTs, API keys, or raw OCR medical records.
  - Ensure the `SensitiveDataSanitizerFilter` is active on all logging handlers.
- [ ] **Audit Trail Retention**:
  - Verify that the 6 audit events (`LOGIN`, `DOCUMENT_UPLOAD`, `DOCUMENT_VIEW`, `DOCUMENT_DELETE`, `AI_PROCESSING`, `DATA_EXPORT`) are being persisted to the `audit_logs` table.
  - Configure automated audit log rotation and immutable archival storage (e.g., AWS S3 Glacier with Object Lock).
- [ ] **Alerting & Anomaly Detection**:
  - Configure alerts on high spikes of `HTTP 401`, `HTTP 404`, or `HTTP 429` errors.
  - Monitor abnormal volume of `DATA_EXPORT` events.

---

## 9. ABDM / Prototype Governance Disclaimers

- [ ] **Mock ABHA Identifier Demarcation**:
  - Verify that Mock ABHA identifiers are clearly stamped with `DEMO / MOCK ABHA ID` badge.
  - Ensure FHIR resources include `is_official_abdm: false` and mock prototype metadata tags.
- [ ] **Clinical Decision Support Disclaimer**:
  - Verify that clinical interpretations and AI health summaries include visible disclaimers that they are assistive reference materials and do not replace licensed medical consultations.

---

## Verification Sign-Off

| Review Stage | Responsible Party | Status | Date |
|:---|:---|:---|:---|
| Multi-tenant Authorization | Lead Security Engineer | Verified & Tested | October 2026 |
| Cryptography & Secrets | DevSecOps Lead | Verified & Tested | October 2026 |
| Infrastructure & Network | Platform Engineer | Ready for Staging | October 2026 |
| Compliance & Audit Logs | Product & Compliance Lead | Verified & Tested | October 2026 |
