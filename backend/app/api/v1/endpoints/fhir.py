import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Response, Query, Request
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.core.rate_limit import get_client_ip
from app.models.user import User
from app.services.fhir_service import fhir_service
from app.services.audit_service import audit_service, AuditEventType
from app.schemas.fhir import (
    FHIRPatient,
    FHIRObservation,
    FHIRMedicationRequest,
    FHIRCondition,
    FHIRDiagnosticReport,
    FHIRDocumentReference,
    FHIREncounter,
    FHIRBundle,
    FHIRBundleEntry,
)

router = APIRouter()


def _wrap_searchset_bundle(
    resources: List[Any],
    resource_type_name: str,
) -> Dict[str, Any]:
    """Helper to return a valid FHIR searchset Bundle containing matched resources."""
    bundle_id = str(uuid.uuid4())
    ts = datetime.utcnow().isoformat() + "Z"

    entries = []
    res_dicts = []
    for r in resources:
        r_dict = r.model_dump(by_alias=True) if hasattr(r, "model_dump") else dict(r)
        res_dicts.append(r_dict)
        entries.append(
            {
                "fullUrl": f"urn:uuid:{r_dict.get('id', uuid.uuid4())}",
                "resource": r_dict,
            }
        )

    return {
        "resourceType": "Bundle",
        "id": bundle_id,
        "type": "searchset",
        "timestamp": ts,
        "total": len(entries),
        "meta": {
            "lastUpdated": ts,
            "tag": [
                {
                    "system": "https://abdm.gov.in/hackathon",
                    "code": "prototype",
                    "display": "DEMO / MOCK ABHA ID - Hackathon Prototype",
                }
            ],
        },
        "entry": entries,
        # Helper for simplified frontends
        "resources": res_dicts,
    }


@router.get(
    "/patient",
    response_model=FHIRPatient,
    summary="Get FHIR R4 Patient representation with Mock ABHA identifier",
)
def get_fhir_patient(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the authenticated user's demographics and identifiers as a standard
    FHIR R4 Patient resource. Includes deterministic Mock ABHA ID marked clearly as DEMO.
    """
    return fhir_service.get_fhir_patient(db, current_user)


@router.get(
    "/observations",
    summary="Get FHIR R4 Observations for laboratory investigations",
)
def get_fhir_observations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns verified laboratory observations formatted as FHIR R4 Observation resources,
    complete with LOINC code mappings, numerical quantities, and status interpretations.
    """
    obs = fhir_service.get_fhir_observations(db, current_user)
    return _wrap_searchset_bundle(obs, "Observation")


@router.get(
    "/medications",
    summary="Get FHIR R4 MedicationRequest resources for active prescriptions",
)
def get_fhir_medications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns extracted clinical prescriptions represented as FHIR R4 MedicationRequest resources,
    linked to source prescription documents with dosage and prescribing physician.
    """
    meds = fhir_service.get_fhir_medications(db, current_user)
    return _wrap_searchset_bundle(meds, "MedicationRequest")


@router.get(
    "/conditions",
    summary="Get FHIR R4 Condition resources for diagnosed medical conditions",
)
def get_fhir_conditions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns extracted medical diagnoses mapped to FHIR R4 Condition resources
    with SNOMED CT terminology and source document references.
    """
    conditions = fhir_service.get_fhir_conditions(db, current_user)
    return _wrap_searchset_bundle(conditions, "Condition")


@router.get(
    "/diagnostic-reports",
    summary="Get FHIR R4 DiagnosticReport resources",
)
def get_fhir_diagnostic_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns diagnostic laboratory documents represented as FHIR R4 DiagnosticReports,
    referencing observation results and original document attachments.
    """
    reports = fhir_service.get_fhir_diagnostic_reports(db, current_user)
    return _wrap_searchset_bundle(reports, "DiagnosticReport")


@router.get(
    "/document-references",
    summary="Get FHIR R4 DocumentReference resources for uploaded medical records",
)
def get_fhir_document_references(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns user health documents mapped to FHIR R4 DocumentReference resources
    with MIME type, size, author, and secure access URLs.
    """
    docs = fhir_service.get_fhir_document_references(db, current_user)
    return _wrap_searchset_bundle(docs, "DocumentReference")


@router.get(
    "/encounters",
    summary="Get FHIR R4 Encounter resources for clinical visits",
)
def get_fhir_encounters(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns clinical consultations and laboratory visits mapped to FHIR R4 Encounter resources.
    """
    encounters = fhir_service.get_fhir_encounters(db, current_user)
    return _wrap_searchset_bundle(encounters, "Encounter")


@router.get(
    "/export",
    response_model=FHIRBundle,
    summary="Export complete FHIR R4 Bundle containing all patient health data with audit logging",
)
def export_fhir_bundle(
    request: Request,
    download: bool = Query(False, description="Set true to prompt browser file download"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates and returns a fully compliant, structured FHIR R4 Collection Bundle
    containing all user healthcare resources (Patient, Observations, Medications,
    Conditions, DiagnosticReports, DocumentReferences, Encounters).
    """
    bundle = fhir_service.get_fhir_bundle(db, current_user)

    # Record DATA_EXPORT audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DATA_EXPORT,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=bundle.id if hasattr(bundle, "id") else None,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={
            "export_format": "FHIR_R4_Bundle",
            "is_download": download,
            "total_resources": getattr(bundle, "total", None),
        },
    )

    if download:
        content = bundle.model_dump_json(indent=2, by_alias=True)
        filename = f"fhir_bundle_abdm_mock_{current_user.id}.json"
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    return bundle


@router.get(
    "/bundle",
    response_model=FHIRBundle,
    summary="Get complete FHIR R4 Bundle with audit logging",
)
def get_fhir_bundle(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Convenience alias for /export returning the full FHIR R4 Bundle."""
    bundle = fhir_service.get_fhir_bundle(db, current_user)

    # Record DATA_EXPORT audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DATA_EXPORT,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=bundle.id if hasattr(bundle, "id") else None,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={
            "export_format": "FHIR_R4_Bundle",
            "is_download": False,
            "total_resources": getattr(bundle, "total", None),
        },
    )

    return bundle
