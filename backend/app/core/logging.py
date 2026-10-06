import logging
import re
import sys
from typing import Any, Dict, List, Union

# Compiled regular expressions for sensitive pattern detection and redaction
PATTERNS = [
    # 1. Passwords (JSON, query string, key-value pairs, quoted or unquoted)
    (
        re.compile(r'(?i)(["\']?(?:password|hashed_password|passwd|pwd)["\']?\s*[:=]\s*["\']?)([^"\'\s&,]+)(["\']?)'),
        r'\1[REDACTED_PASSWORD]\3',
    ),
    # 2. JWT Tokens (Three base64url segments separated by dots)
    (
        re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_\-./+=]{10,}'),
        '[REDACTED_JWT]',
    ),
    # 3. Bearer Token Headers
    (
        re.compile(r'(?i)(bearer\s+)([A-Za-z0-9_\-./+=]{10,})'),
        r'\1[REDACTED_TOKEN]',
    ),
    # 4. API Keys (Google AI, OpenAI, general key params)
    (
        re.compile(r'AIza[0-9A-Za-z_-]{25,45}'),
        '[REDACTED_API_KEY]',
    ),
    (
        re.compile(r'sk-[a-zA-Z0-9_-]{20,}'),
        '[REDACTED_API_KEY]',
    ),
    (
        re.compile(r'(?i)(["\']?(?:api[_-]?key|secret[_-]?key|x-goog-api-key)["\']?\s*[:=]\s*["\']?)([^"\'\s&,]+)(["\']?)'),
        r'\1[REDACTED_API_KEY]\3',
    ),
    (
        re.compile(r'(?i)([?&]key=)([^&\s]+)'),
        r'\1[REDACTED_API_KEY]',
    ),
    # 5. Medical Document Contents (explicitly labeled raw/cleaned OCR or clinical extracts)
    (
        re.compile(r'(?i)(["\']?(?:raw_text|cleaned_text|ocr_text|document_content|medical_text)["\']?\s*[:=]\s*["\']?)([^"\'\r\n]{15,})(["\']?)'),
        r'\1[REDACTED_MEDICAL_CONTENT]\3',
    ),
]


def redact_sensitive_text(text: str) -> str:
    """Scans and redacts all passwords, JWT tokens, API keys, and medical text."""
    if not isinstance(text, str):
        return text
    sanitized = text
    for pattern, replacement in PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


def redact_sensitive_data(data: Any) -> Any:
    """Recursively redacts sensitive keys and values from dictionaries, lists, and strings."""
    if isinstance(data, str):
        return redact_sensitive_text(data)
    elif isinstance(data, dict):
        cleaned = {}
        for k, v in data.items():
            k_lower = str(k).lower()
            if any(term in k_lower for term in ["password", "token", "secret", "api_key", "raw_text", "cleaned_text"]):
                cleaned[k] = "[REDACTED]"
            else:
                cleaned[k] = redact_sensitive_data(v)
        return cleaned
    elif isinstance(data, (list, tuple, set)):
        return [redact_sensitive_data(item) for item in data]
    return data


class SensitiveDataSanitizerFilter(logging.Filter):
    """Logging filter that redacts sensitive information from log messages and arguments."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            if isinstance(record.msg, str):
                record.msg = redact_sensitive_text(record.msg)
            elif isinstance(record.msg, (dict, list)):
                record.msg = redact_sensitive_data(record.msg)

            if record.args:
                if isinstance(record.args, tuple):
                    record.args = tuple(
                        redact_sensitive_text(a) if isinstance(a, str) else redact_sensitive_data(a)
                        for a in record.args
                    )
                elif isinstance(record.args, dict):
                    record.args = {
                        k: (redact_sensitive_text(v) if isinstance(v, str) else redact_sensitive_data(v))
                        for k, v in record.args.items()
                    }
        except Exception:
            pass  # Avoid failing the logger if redaction meets unusual object types
        return True


class SensitiveDataFormatter(logging.Formatter):
    """Logging formatter that performs a secondary sanitization pass on the final formatted output."""

    def format(self, record: logging.LogRecord) -> str:
        formatted = super().format(record)
        return redact_sensitive_text(formatted)


def setup_logging() -> logging.Logger:
    logger = logging.getLogger("health_copilot")
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)

        # Attach sensitive data sanitizer filter and formatter
        sanitizer_filter = SensitiveDataSanitizerFilter()
        handler.addFilter(sanitizer_filter)

        formatter = SensitiveDataFormatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.propagate = False

    return logger


def setup_audit_logger() -> logging.Logger:
    """Dedicated logger for compliance and security audit events."""
    audit_log = logging.getLogger("health_copilot.audit")
    if not audit_log.handlers:
        audit_log.setLevel(logging.INFO)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)

        sanitizer_filter = SensitiveDataSanitizerFilter()
        handler.addFilter(sanitizer_filter)

        formatter = SensitiveDataFormatter(
            fmt="%(asctime)s [AUDIT] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        audit_log.addHandler(handler)
        audit_log.propagate = False

    return audit_log


logger = setup_logging()
audit_logger = setup_audit_logger()
