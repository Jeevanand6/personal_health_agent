import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class PrescriptionField(BaseModel):
    """
    Structured representation of a single field extracted from a prescription.
    Preserves exact raw text recognized, normalized value if verified,
    source page/image, and explicit uncertainty indicators.
    """
    raw_text: Optional[str] = Field(
        default=None,
        description="Exact text recognized on the prescription, without guessing or hallucinating.",
    )
    normalized_value: Optional[str] = Field(
        default=None,
        description="Cleaned, standardized representation if clearly justified; None if illegible or absent.",
    )
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0.",
    )
    is_uncertain: bool = Field(
        default=False,
        description="Flagged true if confidence is low, text is handwriting-ambiguous, or illegible.",
    )
    uncertainty_reason: Optional[str] = Field(
        default=None,
        description="Specific reason for uncertainty (e.g., 'Illegible doctor handwriting', 'Smudged ink').",
    )
    source_page: int = Field(
        default=1,
        ge=1,
        description="1-indexed source document page number.",
    )
    is_corrected_by_user: bool = Field(
        default=False,
        description="Indicates whether this field was manually corrected during human verification.",
    )
    original_value: Optional[str] = Field(
        default=None,
        description="Retains original machine extraction when edited by user for auditing purposes.",
    )


class PrescribedMedication(BaseModel):
    """
    Medication item prescribed by the physician.
    Preserves verbatim handwritten name, strength, dosage, route, frequency, duration, and instructions.
    """
    name_as_written: PrescriptionField = Field(
        ...,
        description="Medication name exactly as written on the prescription.",
    )
    generic_name: Optional[PrescriptionField] = Field(
        default=None,
        description="Pharmacological generic active ingredient if identifiable.",
    )
    strength: Optional[PrescriptionField] = Field(
        default=None,
        description="Medication strength (e.g., '500 mg', '10 mg/5ml').",
    )
    dosage: Optional[PrescriptionField] = Field(
        default=None,
        description="Prescribed dose (e.g., '1 tablet', '2 puffs', '5 ml').",
    )
    dosage_form: Optional[PrescriptionField] = Field(
        default=None,
        description="Formulation (e.g., 'Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment').",
    )
    route: Optional[PrescriptionField] = Field(
        default=None,
        description="Route of administration (e.g., 'Oral', 'Topical', 'Inhalation').",
    )
    frequency: Optional[PrescriptionField] = Field(
        default=None,
        description="Administration frequency or Indian clinical shorthand (e.g., '1-0-1', 'OD', 'BD', 'TDS', 'SOS').",
    )
    duration: Optional[PrescriptionField] = Field(
        default=None,
        description="Duration of treatment (e.g., '5 days', '2 weeks', '1 month').",
    )
    instructions: Optional[PrescriptionField] = Field(
        default=None,
        description="Patient administration instructions (e.g., 'After food', 'Before breakfast', 'At bedtime').",
    )
    is_uncertain: bool = Field(
        default=False,
        description="Set to true if medication name or dosage cannot be confirmed with high certainty.",
    )


class StructuredPrescriptionData(BaseModel):
    """
    Complete structured prescription payload adhering to clinical safety guidelines.
    Never invents missing values; preserves verbatim recognized text and uncertainty flags.
    """
    doctor_name: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="Not specified on document"),
        description="Treating doctor's name.",
    )
    clinic_name: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="Not specified on document"),
        description="Clinic, hospital, or healthcare institution name.",
    )
    patient_name: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="Not specified on document"),
        description="Patient full name.",
    )
    patient_age: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="Not specified on document"),
        description="Patient age as recorded.",
    )
    patient_sex: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="Not specified on document"),
        description="Patient sex/gender as recorded (e.g., Male, Female, Other).",
    )
    prescription_date: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="Not specified on document"),
        description="Date prescription was written.",
    )
    diagnosis: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="No diagnosis noted"),
        description="Clinical diagnosis, symptoms, or provisional findings.",
    )
    notes: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="No additional clinical notes"),
        description="Physician clinical remarks, diet advice, or investigation orders.",
    )
    medications: List[PrescribedMedication] = Field(
        default_factory=list,
        description="List of prescribed medications extracted from the document.",
    )
    instructions_and_follow_up: PrescriptionField = Field(
        default_factory=lambda: PrescriptionField(uncertainty_reason="No follow-up details noted"),
        description="Follow-up date, return instructions, or lifestyle precautions.",
    )
    overall_confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Overall confidence score across all extracted fields.",
    )
    is_uncertain: bool = Field(
        default=False,
        description="Flagged true if any critical field has uncertainty or low confidence.",
    )
    model_metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Metadata on OCR model, fine-tuned weights, backend used, and image preprocessing stats.",
    )

    @field_validator("overall_confidence", mode="before")
    @classmethod
    def round_confidence(cls, v: Any) -> float:
        try:
            return round(float(v), 4)
        except (ValueError, TypeError):
            return 0.0


class FieldCorrectionItem(BaseModel):
    """Audit log item representing a human correction to an extracted field."""
    field_path: str = Field(..., description="Dot-path of the field, e.g. 'doctor_name' or 'medications[0].dosage'")
    original_value: Optional[str] = Field(None, description="Original raw recognized value from OCR/AI")
    corrected_value: Optional[str] = Field(None, description="Corrected value provided by the user")
    reason: Optional[str] = Field(None, description="User note or reason for correction")
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class PrescriptionVerificationRequest(BaseModel):
    """Request payload submitted by user upon approving or correcting a prescription."""
    approved_data: StructuredPrescriptionData = Field(
        ...,
        description="User-reviewed and verified structured prescription data.",
    )
    corrections: List[FieldCorrectionItem] = Field(
        default_factory=list,
        description="List of specific fields that were modified by the user compared to the raw extraction.",
    )
    notes: Optional[str] = Field(
        default=None,
        description="Optional reviewer notes or confirmation remarks.",
    )


class PrescriptionVerificationAudit(BaseModel):
    """Stored audit trail of human verification for clinical accountability."""
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    verified_by_user_id: Optional[str] = None
    corrections_count: int = 0
    corrections: List[Dict[str, Any]] = Field(default_factory=list)
    original_raw_extraction: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None


class PrescriptionExtractionResponse(BaseModel):
    """Full API response for prescription extraction and verification status."""
    document_id: uuid.UUID
    extraction_id: Optional[uuid.UUID] = None
    is_verified: bool = False
    verified_at: Optional[datetime] = None
    processing_status: str
    structured_data: StructuredPrescriptionData
    raw_response: str = ""
    model_name: str
    confidence_score: float
    processing_time: float
    verification_audit: Dict[str, Any] = Field(default_factory=dict)
    preprocessing_metadata: Dict[str, Any] = Field(default_factory=dict)
    message: str = "Prescription extraction completed."
