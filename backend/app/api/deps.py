import uuid
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.patient import Patient
from app.models.document import Document
from app.core.logging import logger

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/auth/login",
    auto_error=False,
)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates the JWT access token and retrieves the current authenticated user.
    Enforces token type, active user status, and format validation.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials or session has expired.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    # Enforce access token type
    if payload.get("type") != "access":
        logger.warning("Token rejected: incorrect token type claim.")
        raise credentials_exception

    user_id_str: Optional[str] = payload.get("sub")
    if not user_id_str:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    return user


def get_current_active_patient(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Patient:
    """Retrieves the primary patient profile associated with the authenticated user."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found for the authenticated user.",
        )
    return patient


def verify_document_ownership(
    db: Session,
    document_id: uuid.UUID,
    user_id: uuid.UUID,
) -> Document:
    """
    Multi-tenant isolation barrier (IDOR Protection):
    Validates that a document exists AND belongs to the requesting user.
    If the document does not exist OR belongs to another tenant/user,
    a 404 NOT FOUND is returned to prevent resource existence enumeration.
    """
    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.user_id == user_id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )

    return doc


def require_role(required_role: str):
    """Role-based authorization dependency factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role.lower() != required_role.lower() and current_user.role.lower() != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires '{required_role}' privileges.",
            )
        return current_user
    return role_checker


__all__ = [
    "get_db",
    "get_current_user",
    "get_current_active_patient",
    "verify_document_ownership",
    "require_role",
]
