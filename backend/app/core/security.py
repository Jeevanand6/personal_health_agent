import re
import secrets
import threading
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional, Set, Tuple, Union
from jose import JWTError, jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError
from app.core.config import settings
from app.core.logging import logger

# Initialize Argon2 PasswordHasher with standard OWASP recommended parameters
_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)

# Dummy hash used for constant-time mitigation when user doesn't exist
_DUMMY_ARGON2_HASH = _password_hasher.hash("dummy_constant_time_defense_pw")

ALGORITHM = "HS256"

# In-memory revoked token (JTI) store with thread safety
_revoked_tokens_lock = threading.Lock()
_revoked_token_jtis: Set[str] = set()


def revoke_token(jti: str) -> None:
    """Revokes a JWT token by adding its unique JTI to the revocation list."""
    if jti:
        with _revoked_tokens_lock:
            _revoked_token_jtis.add(str(jti))
        logger.info(f"JWT revoked for JTI: {jti}")


def is_token_revoked(jti: str) -> bool:
    """Checks whether a token JTI has been revoked."""
    if not jti:
        return False
    with _revoked_tokens_lock:
        return str(jti) in _revoked_token_jtis


COMMON_WEAK_PASSWORDS = {
    "password",
    "password123",
    "password1234",
    "admin123",
    "administrator",
    "12345678",
    "123456789",
    "qwertyuiop",
    "letmein123",
    "healthcare123",
    "welcome123",
}


def validate_password_strength(password: str, email: Optional[str] = None) -> Tuple[bool, str]:
    """
    Enforces OWASP password security guidelines:
    - Minimum 8 characters, maximum 128 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one numerical digit (0-9)
    - At least one special character (!@#$%^&*...)
    - Not in common weak passwords dictionary
    - Does not contain the user's email username
    """
    if not password:
        return False, "Password cannot be empty."

    if len(password) < 8:
        return False, "Password must be at least 8 characters long."

    if len(password) > 128:
        return False, "Password must not exceed 128 characters."

    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter (A-Z)."

    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter (a-z)."

    if not re.search(r"[0-9]", password):
        return False, "Password must contain at least one numerical digit (0-9)."

    if not re.search(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?~`]", password):
        return False, "Password must contain at least one special character (e.g. !@#$%^&*)."

    if password.lower() in COMMON_WEAK_PASSWORDS:
        return False, "This password is too common and easily guessed. Please choose a stronger password."

    if email and "@" in email:
        username = email.split("@")[0].lower()
        if len(username) >= 3 and username in password.lower():
            return False, "Password must not contain parts of your email address."

    return True, "Password meets security requirements."


def get_password_hash(password: str) -> str:
    """Hashes a password using Argon2id with OWASP-recommended parameters."""
    return _password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plain-text password against an Argon2 hash.
    Employs dummy verification on failure to mitigate side-channel timing attacks.
    """
    if not hashed_password or not plain_password:
        try:
            _password_hasher.verify(_DUMMY_ARGON2_HASH, "dummy_pw")
        except Exception:
            pass
        return False

    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        return False
    except Exception as exc:
        logger.error(f"Password verification unexpected error: {exc}")
        return False


def create_access_token(
    subject: Union[str, Any],
    email: str,
    expires_delta: Optional[timedelta] = None,
    token_type: str = "access",
) -> str:
    """
    Generates a cryptographically signed JWT access token.
    Includes JTI (unique token ID), IAT (issued-at), NBF (not-before), EXP (expiration),
    and strictly validates token type.
    """
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    jti = str(uuid.uuid4())
    to_encode: Dict[str, Any] = {
        "sub": str(subject),
        "email": email,
        "exp": expire,
        "iat": now,
        "nbf": now,
        "jti": jti,
        "type": token_type,
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decodes and validates a JWT access token.
    Enforces algorithm verification, expiration, claim validation, and checks revocation.
    """
    if not token or not isinstance(token, str):
        return None

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM],
            options={
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_nbf": True,
            },
        )

        # Enforce token type is access token
        if payload.get("type") != "access":
            logger.warning("JWT validation failed: Invalid token type claim.")
            return None

        # Enforce sub exists and is non-empty
        if not payload.get("sub"):
            logger.warning("JWT validation failed: Missing subject claim.")
            return None

        # Check if JTI is revoked
        jti = payload.get("jti")
        if jti and is_token_revoked(jti):
            logger.warning(f"JWT validation failed: Token JTI {jti} has been revoked.")
            return None

        return payload
    except JWTError as exc:
        logger.warning(f"JWT validation failed: {exc}")
        return None
    except Exception as exc:
        logger.error(f"Unexpected error during JWT decoding: {exc}")
        return None
