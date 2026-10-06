import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ObservationInterpretationItem(BaseModel):
    id: uuid.UUID
    observation_id: str
    document_id: uuid.UUID
    user_id: uuid.UUID
    test_name: str
    value: str
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    status: str = Field(description="LOW | NORMAL | HIGH | UNKNOWN")
    severity: str = Field(description="NORMAL | INFORMATIONAL | REVIEW_RECOMMENDED | URGENT_REVIEW")
    explanation: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    source: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ObservationInterpretationListResponse(BaseModel):
    document_id: Optional[uuid.UUID] = None
    total: int
    summary: Dict[str, int]
    interpretations: List[ObservationInterpretationItem]


class InterpretTriggerResponse(BaseModel):
    document_id: uuid.UUID
    status: str
    message: str
    total_interpreted: int
    interpretations: List[ObservationInterpretationItem]


class LabTrendPoint(BaseModel):
    date: str
    timestamp: str
    value: float
    unit: Optional[str] = None
    status: str
    severity: str
    reference_min: Optional[float] = None
    reference_max: Optional[float] = None
    document_id: uuid.UUID
    original_filename: Optional[str] = None


class LabTrendSeries(BaseModel):
    test_name: str
    unit: Optional[str] = None
    latest_value: Optional[float] = None
    latest_status: str
    latest_severity: str
    reference_range: Optional[str] = None
    points: List[LabTrendPoint]


class LabDashboardResponse(BaseModel):
    total_tests: int
    normal_count: int
    review_recommended_count: int
    urgent_review_count: int
    unknown_count: int
    recent_interpretations: List[ObservationInterpretationItem]
    trends: List[LabTrendSeries]
