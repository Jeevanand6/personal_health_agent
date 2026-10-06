import uuid
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING
from pydantic import BaseModel

if TYPE_CHECKING:
    from app.schemas.ai_extraction import AIExtractionResponse


class DocumentExtractionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    raw_text: str
    cleaned_text: str
    ocr_confidence: float
    page_count: int
    language_detected: str
    processing_time: float
    ai_extraction: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class OCRTriggerResponse(BaseModel):
    document_id: uuid.UUID
    processing_status: str
    ocr_confidence: float
    language_detected: str
    page_count: int
    message: str
    extraction: Optional[DocumentExtractionResponse] = None
