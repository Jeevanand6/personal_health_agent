import random
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core.security import get_password_hash, verify_password, create_access_token, validate_password_strength
from app.core.sanitizer import sanitize_text
from app.core.rate_limit import get_client_ip
from app.core.config import settings
from app.models.user import User
from app.models.patient import Patient
from app.models.audit_log import AuditLog
from app.services.audit_service import audit_service, AuditEventType
from app.schemas.auth import (
    UserRegisterRequest,
    UserLoginRequest,
    UserLanguageUpdateRequest,
    TokenResponse,
    UserResponse,
    PatientResponse,
)
from app.core.logging import logger

router = APIRouter()


def _generate_mock_abha_id() -> str:
    """Generates an illustrative mock ABHA (Ayushman Bharat Health Account) identifier."""
    return f"91-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}-{random.randint(1000, 9999)}"


def _build_user_response(user: User, patient: Patient | None) -> UserResponse:
    patient_resp = None
    if patient:
        patient_resp = PatientResponse(
            id=patient.id,
            abha_id=patient.abha_id,
            abha_address=patient.abha_address,
            date_of_birth=patient.date_of_birth,
            gender=patient.gender,
            blood_group=patient.blood_group,
            contact_number=patient.contact_number,
            preferred_language=patient.preferred_language,
            created_at=patient.created_at,
        )

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        patient=patient_resp,
    )


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user and generate a patient profile with strict password validation",
)
def register_user(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.lower().strip()

    # 1. Enforce OWASP Password Strength
    is_strong, strength_msg = validate_password_strength(payload.password, normalized_email)
    if not is_strong:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=strength_msg,
        )

    # 2. Check duplicate email
    existing_user = db.query(User).filter(User.email == normalized_email).first()
    if existing_user:
        logger.warning(f"Registration failed: duplicate email {normalized_email}")
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists.",
        )

    # 3. Sanitize inputs to prevent XSS
    sanitized_full_name = sanitize_text(payload.full_name, max_length=150, escape_html=True)

    # 4. Hash password securely using Argon2id
    hashed_pwd = get_password_hash(payload.password)

    # 5. Create User
    new_user = User(
        email=normalized_email,
        hashed_password=hashed_pwd,
        full_name=sanitized_full_name,
        role="patient",
        is_active=True,
    )
    db.add(new_user)
    db.flush()  # Obtain new_user.id for FK

    # Generate Mock ABHA Identifier & Address for demonstration
    username_prefix = normalized_email.split("@")[0].replace(".", "_")
    mock_abha = _generate_mock_abha_id()
    mock_address = f"{username_prefix}@abdm"

    # Create linked Patient record
    new_patient = Patient(
        user_id=new_user.id,
        abha_id=mock_abha,
        abha_address=mock_address,
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
        blood_group=payload.blood_group,
        contact_number=payload.contact_number,
        preferred_language=payload.preferred_language,
    )
    db.add(new_patient)
    db.commit()
    db.refresh(new_user)
    db.refresh(new_patient)

    # Issue JWT access token
    access_token = create_access_token(
        subject=new_user.id,
        email=new_user.email,
    )

    logger.info(f"Registered user: {new_user.email} (Patient ID: {new_patient.id})")

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_build_user_response(new_user, new_patient),
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and issue JWT access token with audit logging",
)
def login_user(
    payload: UserLoginRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    normalized_email = payload.email.lower().strip()
    client_ip = get_client_ip(request)
    user_agent = request.headers.get("user-agent", "unknown")

    user = db.query(User).filter(User.email == normalized_email).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        logger.warning(f"Failed login attempt for {normalized_email}")
        audit_service.log_event(
            db=db,
            event_type=AuditEventType.LOGIN,
            status="FAILURE",
            user_id=None,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"email": normalized_email, "reason": "invalid_credentials"},
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        audit_service.log_event(
            db=db,
            event_type=AuditEventType.LOGIN,
            status="FAILURE",
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            details={"email": normalized_email, "reason": "account_deactivated"},
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    # Retrieve patient profile
    patient = db.query(Patient).filter(Patient.user_id == user.id).first()

    access_token = create_access_token(
        subject=user.id,
        email=user.email,
    )

    # Record successful LOGIN audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.LOGIN,
        status="SUCCESS",
        user_id=user.id,
        ip_address=client_ip,
        user_agent=user_agent,
        details={"email": user.email},
    )

    logger.info(f"User authenticated: {user.email}")

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=_build_user_response(user, patient),
    )


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Retrieve current authenticated user profile",
)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    return _build_user_response(current_user, patient)


@router.patch(
    "/me/language",
    response_model=UserResponse,
    summary="Update preferred language for current authenticated patient",
)
def update_user_language(
    payload: UserLanguageUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        patient = Patient(
            user_id=current_user.id,
            preferred_language=payload.preferred_language,
        )
        db.add(patient)
    else:
        patient.preferred_language = payload.preferred_language

    db.commit()
    db.refresh(patient)
    logger.info(f"Updated preferred language for user {current_user.email} to {payload.preferred_language}")
    return _build_user_response(current_user, patient)


@router.get(
    "/me/audit-logs",
    summary="Retrieve personal security audit trail for authenticated user",
)
def get_user_audit_trail(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = audit_service.get_user_audit_logs(db, current_user.id, limit=50)
    return [
        {
            "id": str(log.id),
            "event_type": log.event_type,
            "status": log.status,
            "resource_id": log.resource_id,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "details": log.details,
        }
        for log in logs
    ]
