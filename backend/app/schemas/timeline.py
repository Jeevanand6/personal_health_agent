import uuid
from datetime import datetime, date
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TimelineEventItem(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    event_type: str = Field(description="DOCUMENT | DIAGNOSIS | MEDICATION | LAB_RESULT | DIAGNOSTIC_REPORT | DISCHARGE | ENCOUNTER")
    event_date: datetime
    title: str
    description: str
    source_document_id: uuid.UUID
    source_document_title: str = ""
    metadata_json: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = {"from_attributes": True}


class TimelineEventGroup(BaseModel):
    date_group: str
    display_date: str
    event_count: int
    events: List[TimelineEventItem]


class TimelineSummaryStats(BaseModel):
    total_events: int
    by_type: Dict[str, int] = Field(default_factory=dict)
    earliest_date: Optional[str] = None
    latest_date: Optional[str] = None


class TimelineResponse(BaseModel):
    events: List[TimelineEventItem]
    grouped_events: List[TimelineEventGroup]
    stats: TimelineSummaryStats
    available_categories: List[str] = Field(
        default=["all", "documents", "medications", "laboratory", "diagnoses", "visits"]
    )


class TimelineSyncResponse(BaseModel):
    status: str
    synced_events_count: int
    message: str
