import html
import os
import re
from typing import Optional


def sanitize_text(text: Optional[str], max_length: int = 1000, escape_html: bool = True) -> str:
    """
    Sanitizes string inputs to prevent XSS, null-byte injection, and control character exploits.
    """
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)

    # 1. Remove null bytes and non-printable control characters (preserve standard whitespace)
    cleaned = "".join(ch for ch in text if ch == "\n" or ch == "\r" or ch == "\t" or (ord(ch) >= 32 and ord(ch) != 127))

    # 2. Escape HTML entities to prevent Cross-Site Scripting (XSS)
    if escape_html:
        cleaned = html.escape(cleaned, quote=True)

    # 3. Truncate to maximum allowable length
    return cleaned[:max_length].strip()


def sanitize_filename(filename: Optional[str], max_length: int = 255) -> str:
    """
    Strips directory separators, relative path markers (..), null bytes, and non-printable
    characters from uploaded filenames to guarantee path traversal protection.
    """
    if not filename:
        return "unnamed_document"

    # Take base component
    clean = os.path.basename(filename).strip()

    # Strip null bytes and path separators
    clean = clean.replace("\x00", "").replace("/", "").replace("\\", "").replace("..", "")

    # Retain only printable safe characters
    clean = re.sub(r'[^\w\s\-\.\(\)\[\]]', '', clean)
    clean = clean.strip()

    if not clean:
        clean = "unnamed_document"

    return clean[:max_length]


def sanitize_search_term(term: Optional[str], max_length: int = 100) -> Optional[str]:
    """
    Sanitizes search query parameters, stripping control characters and restricting length.
    """
    if not term:
        return None
    cleaned = "".join(ch for ch in term if ord(ch) >= 32 and ord(ch) != 127)
    cleaned = cleaned.replace("\x00", "").strip()
    return cleaned[:max_length] if cleaned else None


def is_safe_path(target_path: str, base_dir: str) -> bool:
    """
    Validates that a resolved file path resides strictly within the expected base directory,
    preventing path traversal attacks.
    """
    try:
        abs_target = os.path.abspath(target_path)
        abs_base = os.path.abspath(base_dir)
        return os.path.commonpath([abs_target, abs_base]) == abs_base
    except (ValueError, TypeError):
        return False
