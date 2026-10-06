from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.deps import get_db, get_current_user
from app.core.rate_limit import get_client_ip
from app.models.user import User
from app.models.health_summary import HealthSummary
from app.schemas.health_summary import (
    HealthSummaryResponse,
    HealthSummaryGenerateRequest,
)
from app.services.health_summary_service import health_summary_service
from app.services.audit_service import audit_service, AuditEventType

router = APIRouter()


@router.get(
    "",
    response_model=HealthSummaryResponse,
    summary="Get user's latest AI Health Summary",
)
def get_health_summary(
    request: Request,
    language: str = Query("en", description="Preferred language ('en' or 'ta')"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves the most recent Personal Health Summary for the authenticated user.
    If no summary exists yet, one is automatically generated from verified database records.
    """
    lang = "ta" if language.lower() in ["ta", "tamil"] else "en"
    summary = health_summary_service.get_latest_summary(db, current_user.id, language=lang)

    if not summary:
        summary = health_summary_service.generate_health_summary(
            db, user_id=current_user.id, language=lang, force_refresh=True
        )
        audit_service.log_event(
            db=db,
            event_type=AuditEventType.AI_PROCESSING,
            status="SUCCESS",
            user_id=current_user.id,
            resource_id=str(summary.id) if hasattr(summary, "id") else None,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent"),
            details={"pipeline": "health_summary_generation", "language": lang, "trigger": "initial_get"},
        )

    return summary


@router.post(
    "/generate",
    response_model=HealthSummaryResponse,
    summary="Generate or refresh user's AI Health Summary with audit logging",
)
def generate_health_summary(
    payload: HealthSummaryGenerateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Synthesizes and stores an AI-Powered Personal Health Summary strictly grounded
    in verified structured medical records from the database.
    Supports English ('en') and Tamil ('ta').
    """
    summary = health_summary_service.generate_health_summary(
        db=db,
        user_id=current_user.id,
        language=payload.language,
        force_refresh=payload.force_refresh,
    )

    # Record AI_PROCESSING audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.AI_PROCESSING,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(summary.id) if hasattr(summary, "id") else None,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={
            "pipeline": "health_summary_generation",
            "language": payload.language,
            "force_refresh": payload.force_refresh,
        },
    )

    return summary


@router.get(
    "/history",
    response_model=List[HealthSummaryResponse],
    summary="List past generated health summaries",
)
def get_health_summary_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns audit history of all generated health summaries for the current user.
    """
    summaries = (
        db.query(HealthSummary)
        .filter(HealthSummary.user_id == current_user.id)
        .order_by(desc(HealthSummary.generated_at))
        .limit(20)
        .all()
    )
    return summaries
