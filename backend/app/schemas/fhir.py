from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MockAbhaMeta(BaseModel):
    """
    Standardized Metadata for ABDM Sandbox / Hackathon Demonstration.
    Explicitly clarifies mock status to adhere to healthcare regulatory safety.
    """
    mock_abha_id: str = Field(..., description="Demonstration ABHA identifier in XX-XXXX-XXXX-XXXX format")
    mock_abha_address: str = Field(..., description="Demonstration ABHA handle ending in @abdm")
    badge: str = Field(default="DEMO / MOCK ABHA ID", description="Prominent visual disclaimer tag")
    disclaimer: str = Field(
        default=(
            "DEMO / MOCK ABHA ID: This identifier is an illustrative mock generated "
            "for hackathon prototype testing. The application is NOT officially integrated "
            "with Ayushman Bharat Digital Mission (ABDM). Do not use for real clinical care."
        ),
        description="Mandatory regulatory disclaimer"
    )
    is_official_abdm: bool = Field(
        default=False,
        description="Explicit flag confirming this is not an official government ABDM integration"
    )


class FHIRCoding(BaseModel):
    system: Optional[str] = None
    code: Optional[str] = None
    display: Optional[str] = None


class FHIRCodeableConcept(BaseModel):
    coding: List[FHIRCoding] = Field(default_factory=list)
    text: Optional[str] = None


class FHIRReference(BaseModel):
    reference: Optional[str] = None
    display: Optional[str] = None
    type: Optional[str] = None


class FHIRQuantity(BaseModel):
    value: Optional[float] = None
    unit: Optional[str] = None
    system: Optional[str] = "http://unitsofmeasure.org"
    code: Optional[str] = None


class FHIRIdentifier(BaseModel):
    use: Optional[str] = "secondary"
    system: Optional[str] = "https://healthid.ndhm.gov.in"
    value: str
    type: Optional[FHIRCodeableConcept] = None


class FHIRPatientName(BaseModel):
    use: Optional[str] = "official"
    text: str
    family: Optional[str] = None
    given: List[str] = Field(default_factory=list)


class FHIRTelecom(BaseModel):
    system: str  # phone | email
    value: str
    use: Optional[str] = "home"


class FHIRPatient(BaseModel):
    resourceType: str = Field(default="Patient", frozen=True)
    id: str
    identifier: List[FHIRIdentifier] = Field(default_factory=list)
    active: bool = True
    name: List[FHIRPatientName] = Field(default_factory=list)
    telecom: List[FHIRTelecom] = Field(default_factory=list)
    gender: Optional[str] = None
    birthDate: Optional[str] = None
    communication: List[Dict[str, Any]] = Field(default_factory=list)
    meta: Dict[str, Any] = Field(default_factory=dict)
    mock_abha_meta: MockAbhaMeta


class FHIRObservation(BaseModel):
    resourceType: str = Field(default="Observation", frozen=True)
    id: str
    status: str = "final"
    category: List[FHIRCodeableConcept] = Field(default_factory=list)
    code: FHIRCodeableConcept
    subject: FHIRReference
    effectiveDateTime: Optional[str] = None
    valueQuantity: Optional[FHIRQuantity] = None
    valueString: Optional[str] = None
    interpretation: List[FHIRCodeableConcept] = Field(default_factory=list)
    referenceRange: List[Dict[str, Any]] = Field(default_factory=list)
    note: List[Dict[str, str]] = Field(default_factory=list)
    derivedFrom: List[FHIRReference] = Field(default_factory=list)


class FHIRMedicationRequest(BaseModel):
    resourceType: str = Field(default="MedicationRequest", frozen=True)
    id: str
    status: str = "active"
    intent: str = "order"
    medicationCodeableConcept: FHIRCodeableConcept
    subject: FHIRReference
    authoredOn: Optional[str] = None
    requester: Optional[FHIRReference] = None
    dosageInstruction: List[Dict[str, Any]] = Field(default_factory=list)
    supportingInformation: List[FHIRReference] = Field(default_factory=list)


class FHIRCondition(BaseModel):
    resourceType: str = Field(default="Condition", frozen=True)
    id: str
    clinicalStatus: FHIRCodeableConcept
    verificationStatus: FHIRCodeableConcept
    category: List[FHIRCodeableConcept] = Field(default_factory=list)
    code: FHIRCodeableConcept
    subject: FHIRReference
    recordedDate: Optional[str] = None
    evidence: List[Dict[str, Any]] = Field(default_factory=list)


class FHIRDiagnosticReport(BaseModel):
    resourceType: str = Field(default="DiagnosticReport", frozen=True)
    id: str
    status: str = "final"
    category: List[FHIRCodeableConcept] = Field(default_factory=list)
    code: FHIRCodeableConcept
    subject: FHIRReference
    effectiveDateTime: Optional[str] = None
    issued: Optional[str] = None
    performer: List[FHIRReference] = Field(default_factory=list)
    result: List[FHIRReference] = Field(default_factory=list)
    presentedForm: List[Dict[str, Any]] = Field(default_factory=list)


class FHIRDocumentReference(BaseModel):
    resourceType: str = Field(default="DocumentReference", frozen=True)
    id: str
    status: str = "current"
    docStatus: str = "final"
    type: FHIRCodeableConcept
    subject: FHIRReference
    date: Optional[str] = None
    author: List[FHIRReference] = Field(default_factory=list)
    content: List[Dict[str, Any]] = Field(default_factory=list)


class FHIREncounter(BaseModel):
    resourceType: str = Field(default="Encounter", frozen=True)
    id: str
    status: str = "finished"
    class_: Dict[str, Any] = Field(default_factory=dict, serialization_alias="class")
    subject: FHIRReference
    participant: List[Dict[str, Any]] = Field(default_factory=list)
    period: Dict[str, Any] = Field(default_factory=dict)
    serviceProvider: Optional[FHIRReference] = None
    diagnosis: List[Dict[str, Any]] = Field(default_factory=list)


class FHIRBundleEntry(BaseModel):
    fullUrl: str
    resource: Dict[str, Any]


class FHIRBundle(BaseModel):
    resourceType: str = Field(default="Bundle", frozen=True)
    id: str
    type: str = "collection"  # "collection" | "searchset"
    timestamp: str
    total: int
    meta: Dict[str, Any] = Field(default_factory=dict)
    entry: List[FHIRBundleEntry] = Field(default_factory=list)
    resources: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Helper list of unwrapped resources for convenient client access"
    )
