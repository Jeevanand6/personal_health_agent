import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel


class DocumentType(str, Enum):
    PRESCRIPTION = "PRESCRIPTION"
    LAB_REPORT = "LAB_REPORT"
    DIAGNOSTIC_REPORT = "DIAGNOSTIC_REPORT"
    DISCHARGE_SUMMARY = "DISCHARGE_SUMMARY"
    OTHER = "OTHER"
    UNKNOWN = "UNKNOWN"


class ProcessingStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class DocumentResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    mime_type: str
    file_size: int
    document_type: str
    processing_status: str
    upload_date: datetime
    created_at: datetime
    file_url: str

    model_config = {"from_attributes": True}


class DocumentListResponse(BaseModel):
    documents: List[DocumentResponse]
    total: int


class DocumentUpdateRequest(BaseModel):
    document_type: Optional[DocumentType] = None
