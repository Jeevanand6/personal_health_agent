import uuid
from typing import List, Optional
from collections import defaultdict
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.document import Document
from app.models.observation_interpretation import ObservationInterpretation
from app.schemas.observation_interpretation import (
    ObservationInterpretationItem,
    ObservationInterpretationListResponse,
    LabDashboardResponse,
    LabTrendSeries,
    LabTrendPoint,
)
from app.services.lab_interpretation_engine import lab_interpretation_engine

router = APIRouter()


@router.get(
    "/dashboard",
    response_model=LabDashboardResponse,
    summary="Get user laboratory dashboard with KPI metrics, recent results, and trends",
)
def get_user_lab_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns aggregated laboratory dashboard data for the authenticated patient:
    - Overall summary metrics (Normal, Review Recommended, Urgent, Unknown)
    - Recent interpreted observations
    - Trend timelines grouped by investigation
    """
    # Query all user interpretations
    records = (
        db.query(ObservationInterpretation)
        .filter(ObservationInterpretation.user_id == current_user.id)
        .order_by(desc(ObservationInterpretation.created_at))
        .all()
    )

    total_tests = len(records)
    normal_count = sum(1 for r in records if r.status == "NORMAL")
    review_recommended_count = sum(1 for r in records if r.severity == "REVIEW_RECOMMENDED")
    urgent_review_count = sum(1 for r in records if r.severity == "URGENT_REVIEW")
    unknown_count = sum(1 for r in records if r.status == "UNKNOWN")

    # Recent interpretations (up to 25)
    recent_items = [ObservationInterpretationItem.model_validate(r) for r in records[:25]]

    # Group into trend series by test_name
    test_groups = defaultdict(list)
    for r in records:
        if r.numeric_value is not None:
            norm_name = r.test_name.strip()
            test_groups[norm_name].append(r)

    trends: List[LabTrendSeries] = []

    for test_name, group_records in test_groups.items():
        # Sort chronologically ascending for trend graphing
        sorted_records = sorted(group_records, key=lambda x: x.created_at)
        latest_rec = sorted_records[-1]

        points: List[LabTrendPoint] = []
        for rec in sorted_records:
            ref_min, ref_max = lab_interpretation_engine.parse_reference_range(rec.reference_range)
            # Find doc filename if possible
            doc = db.query(Document).filter(Document.id == rec.document_id).first()
            fname = doc.original_filename if doc else None

            points.append(
                LabTrendPoint(
                    date=rec.created_at.strftime("%b %d, %Y"),
                    timestamp=rec.created_at.isoformat(),
                    value=rec.numeric_value or 0.0,
                    unit=rec.unit,
                    status=rec.status,
                    severity=rec.severity,
                    reference_min=ref_min,
                    reference_max=ref_max,
                    document_id=rec.document_id,
                    original_filename=fname,
                )
            )

        trends.append(
            LabTrendSeries(
                test_name=test_name,
                unit=latest_rec.unit,
                latest_value=latest_rec.numeric_value,
                latest_status=latest_rec.status,
                latest_severity=latest_rec.severity,
                reference_range=latest_rec.reference_range,
                points=points,
            )
        )

    return LabDashboardResponse(
        total_tests=total_tests,
        normal_count=normal_count,
        review_recommended_count=review_recommended_count,
        urgent_review_count=urgent_review_count,
        unknown_count=unknown_count,
        recent_interpretations=recent_items,
        trends=trends,
    )


@router.get(
    "/interpretations",
    response_model=ObservationInterpretationListResponse,
    summary="List all user lab interpretations with optional filtering",
)
def list_user_lab_interpretations(
    status_filter: Optional[str] = Query(None, alias="status", description="LOW | NORMAL | HIGH | UNKNOWN"),
    severity_filter: Optional[str] = Query(None, alias="severity", description="NORMAL | INFORMATIONAL | REVIEW_RECOMMENDED | URGENT_REVIEW"),
    test_name: Optional[str] = Query(None, description="Search by test name substring"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ObservationInterpretation).filter(
        ObservationInterpretation.user_id == current_user.id
    )

    if status_filter:
        query = query.filter(ObservationInterpretation.status == status_filter.upper())
    if severity_filter:
        query = query.filter(ObservationInterpretation.severity == severity_filter.upper())
    if test_name:
        query = query.filter(ObservationInterpretation.test_name.ilike(f"%{test_name}%"))

    records = query.order_by(desc(ObservationInterpretation.created_at)).all()

    summary = {
        "LOW": sum(1 for r in records if r.status == "LOW"),
        "NORMAL": sum(1 for r in records if r.status == "NORMAL"),
        "HIGH": sum(1 for r in records if r.status == "HIGH"),
        "UNKNOWN": sum(1 for r in records if r.status == "UNKNOWN"),
        "URGENT_REVIEW": sum(1 for r in records if r.severity == "URGENT_REVIEW"),
        "REVIEW_RECOMMENDED": sum(1 for r in records if r.severity == "REVIEW_RECOMMENDED"),
    }

    items = [ObservationInterpretationItem.model_validate(r) for r in records]

    return ObservationInterpretationListResponse(
        document_id=None,
        total=len(items),
        summary=summary,
        interpretations=items,
    )


@router.get(
    "/trends",
    response_model=List[LabTrendSeries],
    summary="Retrieve longitudinal trends grouped by laboratory test",
)
def get_user_lab_trends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    dash = get_user_lab_dashboard(current_user=current_user, db=db)
    return dash.trends
