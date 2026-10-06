import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SourceDocumentReference(BaseModel):
    document_id: str
    filename: str
    document_date: Optional[str] = None
    hospital_name: Optional[str] = None
    doctor_name: Optional[str] = None


class HealthSnapshotSection(BaseModel):
    headline: str
    patient_context: Dict[str, Any] = Field(default_factory=dict)
    overview_text: str
    total_records_analyzed: int
    active_medications_count: int
    lab_tests_count: int
    abnormal_findings_count: int
    source_document_ids: List[str] = Field(default_factory=list)


class MedicalRecordSummaryItem(BaseModel):
    document_id: str
    filename: str
    document_type: str
    document_date: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    key_findings: List[str] = Field(default_factory=list)


class MedicationSummaryItem(BaseModel):
    name: str
    dosage: Optional[str] = None
    route: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    source_document_id: str
    source_document_title: str


class LabObservationSummaryItem(BaseModel):
    test_name: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    status: str = Field(description="LOW | NORMAL | HIGH | UNKNOWN")
    test_date: Optional[str] = None
    source_document_id: str
    source_document_title: str


class AbnormalResultSummaryItem(BaseModel):
    test_name: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    status: str = Field(description="LOW | HIGH | UNKNOWN")
    severity: str = Field(description="INFORMATIONAL | REVIEW_RECOMMENDED | URGENT_REVIEW")
    statement: str
    action_guidance: str
    source_document_id: str
    source_document_title: str


class DiagnosisSummaryItem(BaseModel):
    condition_name: str
    recorded_date: Optional[str] = None
    doctor_name: Optional[str] = None
    hospital_name: Optional[str] = None
    source_document_id: str
    source_document_title: str


class ImportantDateItem(BaseModel):
    date: str
    event: str
    category: str = Field(description="LAB_TEST | PRESCRIPTION | CONSULTATION | RECORD_UPLOAD")
    source_document_id: Optional[str] = None


class DoctorQuestionItem(BaseModel):
    id: str
    category: str
    question: str
    context: str
    related_test_or_topic: Optional[str] = None
    source_document_id: Optional[str] = None


class StructuredHealthSummaryContent(BaseModel):
    language: str = "en"
    disclaimer: str
    health_snapshot: HealthSnapshotSection
    recent_medical_records: List[MedicalRecordSummaryItem] = Field(default_factory=list)
    medications: List[MedicationSummaryItem] = Field(default_factory=list)
    laboratory_observations: List[LabObservationSummaryItem] = Field(default_factory=list)
    abnormal_results: List[AbnormalResultSummaryItem] = Field(default_factory=list)
    recent_diagnoses: List[DiagnosisSummaryItem] = Field(default_factory=list)
    important_dates: List[ImportantDateItem] = Field(default_factory=list)
    doctor_questions: List[DoctorQuestionItem] = Field(default_factory=list)


class HealthSummaryResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    language: str
    summary: StructuredHealthSummaryContent
    source_documents: List[SourceDocumentReference]
    model: str
    confidence: float
    generated_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HealthSummaryGenerateRequest(BaseModel):
    language: str = Field(default="en", description="'en' for English, 'ta' for Tamil")
    force_refresh: bool = Field(default=False, description="Re-generate even if summary exists")
