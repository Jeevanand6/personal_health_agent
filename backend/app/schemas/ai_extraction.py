import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MedicationItem(BaseModel):
    name: Optional[str] = None
    dosage: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ObservationItem(BaseModel):
    test_name: Optional[str] = None
    value: Optional[str] = None
    numeric_value: Optional[float] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    abnormal_flag: str = Field(default="UNKNOWN", description="LOW | NORMAL | HIGH | UNKNOWN")
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class StructuredMedicalData(BaseModel):
    patient_name: Optional[str] = None
    patient_age: Optional[str] = None
    patient_gender: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    document_date: Optional[str] = None
    diagnoses: List[str] = Field(default_factory=list)
    medications: List[MedicationItem] = Field(default_factory=list)
    laboratory_tests: List[str] = Field(default_factory=list)
    observations: List[ObservationItem] = Field(default_factory=list)
    reference_ranges: List[str] = Field(default_factory=list)
    units: List[str] = Field(default_factory=list)
    abnormal_flags: List[str] = Field(default_factory=list)
    clinical_notes: Optional[str] = None
    field_confidences: Dict[str, float] = Field(default_factory=dict)
    overall_confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class AIExtractionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    model_name: str
    confidence_score: float
    processing_time: float
    structured_data: StructuredMedicalData
    raw_response: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AIExtractTriggerResponse(BaseModel):
    document_id: uuid.UUID
    status: str
    message: str
    extraction: Optional[AIExtractionResponse] = None
