import uuid
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.sanitizer import sanitize_search_term
from app.models.user import User
from app.schemas.timeline import (
    TimelineResponse,
    TimelineSyncResponse,
)
from app.services.timeline_service import timeline_service

router = APIRouter()


@router.get(
    "",
    response_model=TimelineResponse,
    summary="Get unified healthcare timeline",
)
def get_timeline(
    category: Optional[str] = Query(
        "all",
        description="Filter category: 'all', 'documents', 'medications', 'laboratory', 'diagnoses', 'visits'",
    ),
    event_type: Optional[str] = Query(
        None,
        description="Specific event type: DOCUMENT, DIAGNOSIS, MEDICATION, LAB_RESULT, DIAGNOSTIC_REPORT, DISCHARGE, ENCOUNTER",
    ),
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Search term across titles, descriptions, and file names"),
    order: Optional[str] = Query("desc", description="Sort order: 'desc' (newest first) or 'asc' (chronological)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the user's unified healthcare timeline grounded in verified database records.
    Includes chronological ordering, date groupings, category filters, and metadata.
    """
    safe_search = sanitize_search_term(search)
    safe_order = "asc" if order and order.lower() == "asc" else "desc"
    return timeline_service.get_timeline(
        db=db,
        user_id=current_user.id,
        category=category,
        event_type=event_type,
        start_date=start_date,
        end_date=end_date,
        search=safe_search,
        order=safe_order,
    )


@router.post(
    "/sync",
    response_model=TimelineSyncResponse,
    summary="Synchronize timeline events from verified records",
)
def sync_timeline(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Scans all verified documents, observations, and extractions for the authenticated user
    and updates the timeline_events table.
    """
    synced_count = timeline_service.sync_user_timeline(db, current_user.id)
    return TimelineSyncResponse(
        status="synced",
        synced_events_count=synced_count,
        message=f"Successfully synchronized {synced_count} timeline events from verified records.",
    )
