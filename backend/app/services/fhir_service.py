import uuid
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.user import User
from app.models.patient import Patient
from app.models.document import Document
from app.models.observation_interpretation import ObservationInterpretation
from app.models.ai_extraction import AIExtraction
from app.schemas.fhir import (
    MockAbhaMeta,
    FHIRCoding,
    FHIRCodeableConcept,
    FHIRReference,
    FHIRQuantity,
    FHIRIdentifier,
    FHIRPatientName,
    FHIRTelecom,
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
from app.core.logging import logger

# Terminology Mappings for Standard Interoperability
LOINC_OBSERVATIONS = {
    "hemoglobin": {"code": "718-7", "display": "Hemoglobin [Mass/volume] in Blood"},
    "fasting blood sugar": {"code": "1558-6", "display": "Fasting glucose [Mass/volume] in Serum or Plasma"},
    "fbs": {"code": "1558-6", "display": "Fasting glucose [Mass/volume] in Serum or Plasma"},
    "blood glucose": {"code": "2345-7", "display": "Glucose [Mass/volume] in Serum or Plasma"},
    "postprandial blood sugar": {"code": "1521-4", "display": "Glucose [Mass/volume] in Serum or Plasma --2 hours post meal"},
    "ppbs": {"code": "1521-4", "display": "Glucose [Mass/volume] in Serum or Plasma --2 hours post meal"},
    "hba1c": {"code": "4548-4", "display": "Hemoglobin A1c/Hemoglobin.total in Blood"},
    "serum creatinine": {"code": "2160-0", "display": "Creatinine [Mass/volume] in Serum or Plasma"},
    "creatinine": {"code": "2160-0", "display": "Creatinine [Mass/volume] in Serum or Plasma"},
    "total cholesterol": {"code": "2093-3", "display": "Cholesterol [Mass/volume] in Serum or Plasma"},
    "cholesterol": {"code": "2093-3", "display": "Cholesterol [Mass/volume] in Serum or Plasma"},
    "ldl cholesterol": {"code": "13457-7", "display": "Cholesterol in LDL [Mass/volume] in Serum or Plasma"},
    "ldl": {"code": "13457-7", "display": "Cholesterol in LDL [Mass/volume] in Serum or Plasma"},
    "hdl cholesterol": {"code": "2085-9", "display": "Cholesterol in HDL [Mass/volume] in Serum or Plasma"},
    "hdl": {"code": "2085-9", "display": "Cholesterol in HDL [Mass/volume] in Serum or Plasma"},
    "triglycerides": {"code": "2571-8", "display": "Triglyceride [Mass/volume] in Serum or Plasma"},
    "platelet count": {"code": "777-3", "display": "Platelets [#/volume] in Blood"},
    "rbc count": {"code": "789-8", "display": "Erythrocytes [#/volume] in Blood"},
    "wbc count": {"code": "6690-2", "display": "Leukocytes [#/volume] in Blood"},
    "total leukocyte count": {"code": "6690-2", "display": "Leukocytes [#/volume] in Blood"},
    "blood urea nitrogen": {"code": "3094-0", "display": "Urea nitrogen [Mass/volume] in Serum or Plasma"},
    "bun": {"code": "3094-0", "display": "Urea nitrogen [Mass/volume] in Serum or Plasma"},
    "serum bilirubin": {"code": "1975-2", "display": "Bilirubin.total [Mass/volume] in Serum or Plasma"},
    "alt / sgpt": {"code": "1742-6", "display": "Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
    "sgpt": {"code": "1742-6", "display": "Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
    "ast / sgot": {"code": "1920-8", "display": "Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
    "sgot": {"code": "1920-8", "display": "Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma"},
    "vitamin d": {"code": "14635-7", "display": "25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma"},
    "vitamin b12": {"code": "2132-9", "display": "Cobalamin (Vitamin B12) [Mass/volume] in Serum or Plasma"},
    "thyroid stimulating hormone": {"code": "3016-3", "display": "Thyrotropin [Units/volume] in Serum or Plasma"},
    "tsh": {"code": "3016-3", "display": "Thyrotropin [Units/volume] in Serum or Plasma"},
}

SNOMED_CONDITIONS = {
    "type 2 diabetes mellitus": {"code": "44054006", "display": "Type 2 diabetes mellitus"},
    "type 2 diabetes": {"code": "44054006", "display": "Type 2 diabetes mellitus"},
    "diabetes mellitus": {"code": "73211009", "display": "Diabetes mellitus"},
    "dyslipidemia": {"code": "370992007", "display": "Dyslipidemia"},
    "hyperlipidemia": {"code": "55822004", "display": "Hyperlipidemia"},
    "hypertension": {"code": "38341003", "display": "Hypertension"},
    "essential hypertension": {"code": "59621000", "display": "Essential hypertension"},
    "anemia": {"code": "271737000", "display": "Anemia"},
    "bronchitis": {"code": "32398004", "display": "Bronchitis"},
    "asthma": {"code": "195967001", "display": "Asthma"},
    "upper respiratory tract infection": {"code": "54150009", "display": "Upper respiratory tract infection"},
}

RXNORM_MEDICATIONS = {
    "metformin": {"code": "6809", "display": "Metformin"},
    "metformin hydrochloride": {"code": "6809", "display": "Metformin Hydrochloride"},
    "atorvastatin": {"code": "83367", "display": "Atorvastatin"},
    "atorvastatin calcium": {"code": "83367", "display": "Atorvastatin Calcium"},
    "azithromycin": {"code": "18631", "display": "Azithromycin"},
    "amoxicillin": {"code": "723", "display": "Amoxicillin"},
    "paracetamol": {"code": "161", "display": "Acetaminophen / Paracetamol"},
    "pantoprazole": {"code": "40790", "display": "Pantoprazole"},
    "omeprazole": {"code": "7646", "display": "Omeprazole"},
    "aspirin": {"code": "1191", "display": "Aspirin"},
    "amlodipine": {"code": "17767", "display": "Amlodipine"},
    "losartan": {"code": "5224", "display": "Losartan"},
}


class FHIRService:
    """
    ABDM-Ready FHIR R4 Healthcare Data Architecture Service.
    Transforms verified medical records stored in the database into
    standards-compliant FHIR R4 resources with explicit Mock ABHA attribution.
    """

    def _ensure_mock_abha_id(self, patient: Patient, user: User, db: Session) -> Tuple[str, str]:
        """
        Ensures a consistent mock ABHA ID matching the XX-XXXX-XXXX-XXXX format
        and handle ending with @abdm. Saves to the database if missing.
        """
        current_id = patient.abha_id
        if current_id and re.match(r"^\d{2}-\d{4}-\d{4}-\d{4}$", current_id):
            mock_id = current_id
        else:
            # Deterministically generate from UUID integer hash
            u_hash = abs(hash(str(user.id)))
            p1 = 91
            p2 = 1000 + (u_hash % 9000)
            p3 = 1000 + ((u_hash // 9000) % 9000)
            p4 = 1000 + ((u_hash // (9000 * 9000)) % 9000)
            mock_id = f"{p1}-{p2:04d}-{p3:04d}-{p4:04d}"
            patient.abha_id = mock_id
            db.add(patient)
            db.commit()

        email_prefix = user.email.split("@")[0].replace(".", "_")
        mock_addr = patient.abha_address or f"{email_prefix}@abdm"
        if not patient.abha_address:
            patient.abha_address = mock_addr
            db.add(patient)
            db.commit()

        return mock_id, mock_addr

    def get_mock_abha_meta(self, patient: Patient, user: User, db: Session) -> MockAbhaMeta:
        mock_id, mock_addr = self._ensure_mock_abha_id(patient, user, db)
        return MockAbhaMeta(
            mock_abha_id=mock_id,
            mock_abha_address=mock_addr,
            badge="DEMO / MOCK ABHA ID",
            disclaimer=(
                "DEMO / MOCK ABHA ID: This identifier is an illustrative mock generated "
                "for hackathon prototype testing. The application is NOT officially integrated "
                "with Ayushman Bharat Digital Mission (ABDM). Do not use for real clinical care."
            ),
            is_official_abdm=False,
        )

    def get_fhir_patient(self, db: Session, user: User) -> FHIRPatient:
        """Constructs a compliant FHIR R4 Patient representation."""
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        if not patient:
            # Create patient profile if missing
            mock_id = f"91-{1000 + (abs(hash(str(user.id))) % 9000):04d}-4521-8890"
            patient = Patient(
                user_id=user.id,
                abha_id=mock_id,
                abha_address=f"{user.email.split('@')[0]}@abdm",
                preferred_language="en",
            )
            db.add(patient)
            db.commit()
            db.refresh(patient)

        mock_meta = self.get_mock_abha_meta(patient, user, db)

        # Names split
        name_parts = user.full_name.strip().split()
        family = name_parts[-1] if len(name_parts) > 1 else ""
        given = name_parts[:-1] if len(name_parts) > 1 else name_parts

        identifiers = [
            FHIRIdentifier(
                use="secondary",
                system="https://healthid.ndhm.gov.in",
                value=mock_meta.mock_abha_id,
                type=FHIRCodeableConcept(
                    coding=[
                        FHIRCoding(
                            system="http://terminology.hl7.org/CodeSystem/v2-0203",
                            code="MR",
                            display="Medical Record Number",
                        )
                    ],
                    text="DEMO / MOCK ABHA ID",
                ),
            ),
            FHIRIdentifier(
                use="official",
                system="https://healthcopilot.local/fhir/patients",
                value=str(patient.id),
                type=FHIRCodeableConcept(text="Internal Patient UUID"),
            ),
        ]

        telecom = [
            FHIRTelecom(system="email", value=user.email, use="home"),
        ]
        if patient.contact_number:
            telecom.append(FHIRTelecom(system="phone", value=patient.contact_number, use="mobile"))

        gender_fhir = None
        if patient.gender:
            g = patient.gender.lower()
            if g in ["male", "female", "other", "unknown"]:
                gender_fhir = g
            elif "m" in g:
                gender_fhir = "male"
            elif "f" in g:
                gender_fhir = "female"
            else:
                gender_fhir = "unknown"

        lang_code = patient.preferred_language or "en"
        lang_display = "Tamil" if lang_code == "ta" else "English"

        return FHIRPatient(
            id=str(patient.id),
            identifier=identifiers,
            active=user.is_active,
            name=[
                FHIRPatientName(
                    use="official",
                    text=user.full_name,
                    family=family,
                    given=given,
                )
            ],
            telecom=telecom,
            gender=gender_fhir,
            birthDate=patient.date_of_birth.isoformat() if patient.date_of_birth else None,
            communication=[
                {
                    "language": {
                        "coding": [
                            {
                                "system": "urn:ietf:bcp:47",
                                "code": lang_code,
                                "display": lang_display,
                            }
                        ],
                        "text": lang_display,
                    },
                    "preferred": True,
                }
            ],
            meta={
                "versionId": "1",
                "lastUpdated": datetime.utcnow().isoformat() + "Z",
                "tag": [
                    {
                        "system": "https://abdm.gov.in/hackathon",
                        "code": "prototype",
                        "display": "DEMO / MOCK ABHA ID - Hackathon Prototype",
                    }
                ],
            },
            mock_abha_meta=mock_meta,
        )

    def get_fhir_observations(self, db: Session, user: User) -> List[FHIRObservation]:
        """Constructs FHIR R4 Observations from verified ObservationInterpretation rows."""
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        patient_ref = f"Patient/{patient.id}" if patient else f"Patient/{user.id}"

        records = (
            db.query(ObservationInterpretation)
            .filter(ObservationInterpretation.user_id == user.id)
            .order_by(desc(ObservationInterpretation.created_at))
            .all()
        )

        observations: List[FHIRObservation] = []
        for r in records:
            norm_key = r.test_name.strip().lower()
            loinc_match = None
            for k, val in LOINC_OBSERVATIONS.items():
                if k in norm_key:
                    loinc_match = val
                    break

            codings = []
            if loinc_match:
                codings.append(
                    FHIRCoding(
                        system="http://loinc.org",
                        code=loinc_match["code"],
                        display=loinc_match["display"],
                    )
                )
            codings.append(
                FHIRCoding(
                    system="https://healthcopilot.local/fhir/code-system/tests",
                    code=r.test_name.strip().replace(" ", "-").lower(),
                    display=r.test_name.strip(),
                )
            )

            # Interpretations code: High / Low / Normal
            interp_codings = []
            if r.status == "HIGH":
                interp_codings.append(
                    FHIRCoding(
                        system="http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        code="H",
                        display="High",
                    )
                )
            elif r.status == "LOW":
                interp_codings.append(
                    FHIRCoding(
                        system="http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        code="L",
                        display="Low",
                    )
                )
            elif r.status == "NORMAL":
                interp_codings.append(
                    FHIRCoding(
                        system="http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                        code="N",
                        display="Normal",
                    )
                )

            # Reference ranges
            ref_ranges = []
            if r.reference_range:
                ref_ranges.append(
                    {
                        "text": r.reference_range,
                        "type": {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/referencerange-meaning",
                                    "code": "normal",
                                    "display": "Normal Range",
                                }
                            ]
                        },
                    }
                )

            val_quantity = None
            val_string = None
            if r.numeric_value is not None:
                val_quantity = FHIRQuantity(
                    value=r.numeric_value,
                    unit=r.unit,
                    system="http://unitsofmeasure.org",
                    code=r.unit,
                )
            else:
                val_string = r.value

            obs = FHIRObservation(
                id=str(r.id),
                status="final",
                category=[
                    FHIRCodeableConcept(
                        coding=[
                            FHIRCoding(
                                system="http://terminology.hl7.org/CodeSystem/observation-category",
                                code="laboratory",
                                display="Laboratory",
                            )
                        ],
                        text="Laboratory",
                    )
                ],
                code=FHIRCodeableConcept(coding=codings, text=r.test_name.strip()),
                subject=FHIRReference(reference=patient_ref, type="Patient"),
                effectiveDateTime=r.created_at.isoformat() + "Z",
                valueQuantity=val_quantity,
                valueString=val_string,
                interpretation=[FHIRCodeableConcept(coding=interp_codings, text=r.status)],
                referenceRange=ref_ranges,
                note=[
                    {"text": r.explanation},
                    {"text": f"Grounded verification source: {r.source}"},
                ],
                derivedFrom=[
                    FHIRReference(
                        reference=f"DocumentReference/{r.document_id}",
                        type="DocumentReference",
                    )
                ],
            )
            observations.append(obs)

        return observations

    def get_fhir_medications(self, db: Session, user: User) -> List[FHIRMedicationRequest]:
        """Constructs FHIR R4 MedicationRequest from verified AIExtraction prescriptions."""
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        patient_ref = f"Patient/{patient.id}" if patient else f"Patient/{user.id}"

        # Fetch all user documents with AI Extractions
        extractions = (
            db.query(AIExtraction)
            .join(Document, AIExtraction.document_id == Document.id)
            .filter(Document.user_id == user.id)
            .order_by(desc(AIExtraction.created_at))
            .all()
        )

        medication_requests: List[FHIRMedicationRequest] = []
        seen_meds = set()

        for ext in extractions:
            doc = db.query(Document).filter(Document.id == ext.document_id).first()
            # CLINICAL SAFETY GATE: Unverified prescriptions must not produce FHIR MedicationRequest records
            is_prescription = (
                (doc and doc.document_type == "PRESCRIPTION")
                or getattr(ext, "extraction_type", "") == "PRESCRIPTION"
            )
            if is_prescription and not getattr(ext, "is_verified", False):
                continue

            sdata = ext.structured_data or {}
            raw_meds = sdata.get("medications", [])
            
            raw_date = sdata.get("document_date") or sdata.get("prescription_date")
            if isinstance(raw_date, dict):
                doc_date = raw_date.get("normalized_value") or raw_date.get("raw_text") or (ext.created_at.strftime("%Y-%m-%d") if ext.created_at else None)
            elif isinstance(raw_date, str) and raw_date.strip():
                doc_date = raw_date.strip()
            else:
                doc_date = (ext.created_at.strftime("%Y-%m-%d") if ext.created_at else None)

            raw_doc_name = sdata.get("doctor_name")
            if isinstance(raw_doc_name, dict):
                doctor_name = (raw_doc_name.get("normalized_value") or raw_doc_name.get("raw_text") or "Treating Physician").strip()
            elif isinstance(raw_doc_name, str) and raw_doc_name.strip():
                doctor_name = raw_doc_name.strip()
            else:
                doctor_name = "Treating Physician"

            for idx, med in enumerate(raw_meds):
                med_name = ""
                if isinstance(med.get("name_as_written"), dict):
                    med_name = (med["name_as_written"].get("normalized_value") or med["name_as_written"].get("raw_text") or "").strip()
                elif isinstance(med.get("name"), str):
                    med_name = med.get("name", "").strip()

                # Skip invalid or header lines
                if not med_name or "PRESCRIBED" in med_name.upper() or len(med_name) < 2:
                    continue

                clean_name = re.sub(r"^\d+[\.\)]\s*", "", med_name).strip()
                if not clean_name:
                    continue

                med_key = f"{ext.document_id}_{clean_name.lower()}"
                if med_key in seen_meds:
                    continue
                seen_meds.add(med_key)

                # Match RxNorm
                rx_match = None
                for k, val in RXNORM_MEDICATIONS.items():
                    if k in clean_name.lower():
                        rx_match = val
                        break

                codings = []
                if rx_match:
                    codings.append(
                        FHIRCoding(
                            system="http://www.nlm.nih.gov/research/umls/rxnorm",
                            code=rx_match["code"],
                            display=rx_match["display"],
                        )
                    )

                dosage_text = med.get("dosage") or "As directed"
                frequency_text = med.get("frequency") or "Regular"
                route_text = med.get("route") or "Oral"
                instructions = med.get("instructions") or "Take as prescribed by doctor"

                dosage_instruction = [
                    {
                        "text": f"{dosage_text}, {route_text}, {frequency_text}. Instructions: {instructions}",
                        "route": {"text": route_text},
                        "timing": {"code": {"text": frequency_text}},
                        "patientInstruction": instructions,
                    }
                ]

                # Deterministic UUID for the medication request
                med_req_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ext.document_id}_med_{idx}_{clean_name}"))

                med_req = FHIRMedicationRequest(
                    id=med_req_id,
                    status="active",
                    intent="order",
                    medicationCodeableConcept=FHIRCodeableConcept(
                        coding=codings,
                        text=clean_name,
                    ),
                    subject=FHIRReference(reference=patient_ref, type="Patient"),
                    authoredOn=doc_date,
                    requester=FHIRReference(display=doctor_name, type="Practitioner"),
                    dosageInstruction=dosage_instruction,
                    supportingInformation=[
                        FHIRReference(
                            reference=f"DocumentReference/{ext.document_id}",
                            type="DocumentReference",
                            display=doc.original_filename if doc else "Medical Document",
                        )
                    ],
                )
                medication_requests.append(med_req)

        return medication_requests

    def get_fhir_conditions(self, db: Session, user: User) -> List[FHIRCondition]:
        """Constructs FHIR R4 Conditions from verified AIExtraction diagnoses."""
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        patient_ref = f"Patient/{patient.id}" if patient else f"Patient/{user.id}"

        extractions = (
            db.query(AIExtraction)
            .join(Document, AIExtraction.document_id == Document.id)
            .filter(Document.user_id == user.id)
            .order_by(desc(AIExtraction.created_at))
            .all()
        )

        conditions: List[FHIRCondition] = []
        seen_conditions = set()

        for ext in extractions:
            doc = db.query(Document).filter(Document.id == ext.document_id).first()
            sdata = ext.structured_data or {}
            raw_diagnoses = sdata.get("diagnoses", [])
            doc_date = sdata.get("document_date") or (ext.created_at.strftime("%Y-%m-%d") if ext.created_at else None)

            for idx, diag in enumerate(raw_diagnoses):
                diag_name = str(diag).strip()
                if not diag_name or diag_name.startswith("/") or "DIAGNOSIS" in diag_name.upper() and len(diag_name) <= 12:
                    continue

                clean_diag = re.sub(r"^\d+[\.\)]\s*", "", diag_name).strip()
                if not clean_diag or clean_diag.lower() in seen_conditions:
                    continue
                seen_conditions.add(clean_diag.lower())

                snomed_match = None
                for k, val in SNOMED_CONDITIONS.items():
                    if k in clean_diag.lower():
                        snomed_match = val
                        break

                codings = []
                if snomed_match:
                    codings.append(
                        FHIRCoding(
                            system="http://snomed.info/sct",
                            code=snomed_match["code"],
                            display=snomed_match["display"],
                        )
                    )

                cond_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ext.document_id}_cond_{idx}_{clean_diag}"))

                cond = FHIRCondition(
                    id=cond_id,
                    clinicalStatus=FHIRCodeableConcept(
                        coding=[
                            FHIRCoding(
                                system="http://terminology.hl7.org/CodeSystem/condition-clinical",
                                code="active",
                                display="Active",
                            )
                        ],
                        text="Active",
                    ),
                    verificationStatus=FHIRCodeableConcept(
                        coding=[
                            FHIRCoding(
                                system="http://terminology.hl7.org/CodeSystem/condition-ver-status",
                                code="confirmed",
                                display="Confirmed",
                            )
                        ],
                        text="Confirmed",
                    ),
                    category=[
                        FHIRCodeableConcept(
                            coding=[
                                FHIRCoding(
                                    system="http://terminology.hl7.org/CodeSystem/condition-category",
                                    code="encounter-diagnosis",
                                    display="Encounter Diagnosis",
                                )
                            ],
                            text="Encounter Diagnosis",
                        )
                    ],
                    code=FHIRCodeableConcept(coding=codings, text=clean_diag),
                    subject=FHIRReference(reference=patient_ref, type="Patient"),
                    recordedDate=doc_date,
                    evidence=[
                        {
                            "detail": [
                                {
                                    "reference": f"DocumentReference/{ext.document_id}",
                                    "display": doc.original_filename if doc else "Diagnostic Report",
                                }
                            ]
                        }
                    ],
                )
                conditions.append(cond)

        return conditions

    def get_fhir_diagnostic_reports(self, db: Session, user: User) -> List[FHIRDiagnosticReport]:
        """Constructs FHIR R4 DiagnosticReports aggregating laboratory observations per document."""
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        patient_ref = f"Patient/{patient.id}" if patient else f"Patient/{user.id}"

        lab_docs = (
            db.query(Document)
            .filter(Document.user_id == user.id)
            .order_by(desc(Document.created_at))
            .all()
        )

        reports: List[FHIRDiagnosticReport] = []

        for doc in lab_docs:
            # Find observations linked to this document
            obs_list = (
                db.query(ObservationInterpretation)
                .filter(ObservationInterpretation.document_id == doc.id)
                .all()
            )

            # Extractions for performer / hospital name
            ai_ext = doc.ai_extraction
            hosp_name = "Clinical Laboratory"
            doc_date = doc.created_at.isoformat() + "Z"
            if ai_ext and ai_ext.structured_data:
                hosp = ai_ext.structured_data.get("hospital_name")
                if hosp:
                    hosp_name = hosp.strip().replace("\n", ", ")
                dd = ai_ext.structured_data.get("document_date")
                if dd:
                    doc_date = dd

            obs_refs = [
                FHIRReference(
                    reference=f"Observation/{o.id}",
                    display=f"{o.test_name}: {o.value} ({o.status})",
                    type="Observation",
                )
                for o in obs_list
            ]

            report_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc.id}_diagnostic_report"))

            rep = FHIRDiagnosticReport(
                id=report_id,
                status="final",
                category=[
                    FHIRCodeableConcept(
                        coding=[
                            FHIRCoding(
                                system="http://terminology.hl7.org/CodeSystem/v2-0074",
                                code="LAB",
                                display="Laboratory",
                            )
                        ],
                        text="Laboratory Report",
                    )
                ],
                code=FHIRCodeableConcept(
                    text=doc.original_filename.replace(".pdf", "").replace(".png", "")
                ),
                subject=FHIRReference(reference=patient_ref, type="Patient"),
                effectiveDateTime=doc_date,
                issued=doc.created_at.isoformat() + "Z",
                performer=[FHIRReference(display=hosp_name, type="Organization")],
                result=obs_refs,
                presentedForm=[
                    {
                        "contentType": doc.mime_type or "application/pdf",
                        "url": f"/api/documents/{doc.id}/download",
                        "title": doc.original_filename,
                        "size": doc.file_size or 0,
                    }
                ],
            )
            reports.append(rep)

        return reports

    def get_fhir_document_references(self, db: Session, user: User) -> List[FHIRDocumentReference]:
        """Constructs FHIR R4 DocumentReference resources for all user clinical documents."""
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        patient_ref = f"Patient/{patient.id}" if patient else f"Patient/{user.id}"

        docs = (
            db.query(Document)
            .filter(Document.user_id == user.id)
            .order_by(desc(Document.created_at))
            .all()
        )

        doc_refs: List[FHIRDocumentReference] = []

        for d in docs:
            doc_type_code = d.document_type or "CLINICAL_NOTE"
            doc_type_display = (
                "Laboratory Report" if doc_type_code == "LAB_REPORT"
                else "Prescription" if doc_type_code == "PRESCRIPTION"
                else "Diagnostic Imaging" if doc_type_code == "SCAN_IMAGING"
                else "Clinical Discharge Summary" if doc_type_code == "DISCHARGE_SUMMARY"
                else "Clinical Note"
            )

            # Doctor name if extracted
            author_display = "Attending Physician"
            if d.ai_extraction and d.ai_extraction.structured_data:
                doc_name = d.ai_extraction.structured_data.get("doctor_name")
                if doc_name:
                    author_display = doc_name

            doc_ref = FHIRDocumentReference(
                id=str(d.id),
                status="current",
                docStatus="final",
                type=FHIRCodeableConcept(
                    coding=[
                        FHIRCoding(
                            system="https://healthcopilot.local/fhir/code-system/doc-types",
                            code=doc_type_code,
                            display=doc_type_display,
                        )
                    ],
                    text=doc_type_display,
                ),
                subject=FHIRReference(reference=patient_ref, type="Patient"),
                date=d.created_at.isoformat() + "Z",
                author=[FHIRReference(display=author_display, type="Practitioner")],
                content=[
                    {
                        "attachment": {
                            "contentType": d.mime_type or "application/pdf",
                            "url": f"/api/documents/{d.id}/download",
                            "title": d.original_filename,
                            "size": d.file_size or 0,
                        }
                    }
                ],
            )
            doc_refs.append(doc_ref)

        return doc_refs

    def get_fhir_encounters(self, db: Session, user: User) -> List[FHIREncounter]:
        """Constructs FHIR R4 Encounter resources synthesized from consultations & reports."""
        patient = db.query(Patient).filter(Patient.user_id == user.id).first()
        patient_ref = f"Patient/{patient.id}" if patient else f"Patient/{user.id}"

        docs = (
            db.query(Document)
            .filter(Document.user_id == user.id)
            .order_by(desc(Document.created_at))
            .all()
        )

        encounters: List[FHIREncounter] = []

        for d in docs:
            doc_name = "Attending Physician"
            hosp_name = "Outpatient Clinic"
            enc_date = d.created_at.strftime("%Y-%m-%d")

            if d.ai_extraction and d.ai_extraction.structured_data:
                sdata = d.ai_extraction.structured_data
                if sdata.get("doctor_name"):
                    doc_name = sdata.get("doctor_name")
                if sdata.get("hospital_name"):
                    hosp_name = sdata.get("hospital_name").strip().replace("\n", ", ")
                if sdata.get("document_date"):
                    enc_date = sdata.get("document_date")

            enc_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{d.id}_encounter"))

            enc = FHIREncounter(
                id=enc_id,
                status="finished",
                class_={
                    "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                    "code": "AMB",
                    "display": "ambulatory",
                },
                subject=FHIRReference(reference=patient_ref, type="Patient"),
                participant=[
                    {
                        "individual": {
                            "display": doc_name,
                            "type": "Practitioner",
                        }
                    }
                ],
                period={"start": enc_date},
                serviceProvider=FHIRReference(display=hosp_name, type="Organization"),
                diagnosis=[
                    {
                        "condition": {
                            "reference": f"DocumentReference/{d.id}",
                            "display": f"Consultation associated with {d.original_filename}",
                        }
                    }
                ],
            )
            encounters.append(enc)

        return encounters

    def get_fhir_bundle(self, db: Session, user: User) -> FHIRBundle:
        """
        Creates a complete, valid structured FHIR R4 Bundle (type: 'collection')
        containing Patient, Observations, Medications, Conditions, DiagnosticReports,
        DocumentReferences, and Encounters.
        """
        patient_res = self.get_fhir_patient(db, user)
        obs_res = self.get_fhir_observations(db, user)
        med_res = self.get_fhir_medications(db, user)
        cond_res = self.get_fhir_conditions(db, user)
        diag_res = self.get_fhir_diagnostic_reports(db, user)
        doc_res = self.get_fhir_document_references(db, user)
        enc_res = self.get_fhir_encounters(db, user)

        all_resources: List[Dict[str, Any]] = []

        # 1. Patient
        patient_dict = patient_res.model_dump(by_alias=True)
        all_resources.append(patient_dict)

        # 2. Observations
        for o in obs_res:
            all_resources.append(o.model_dump(by_alias=True))

        # 3. Medications
        for m in med_res:
            all_resources.append(m.model_dump(by_alias=True))

        # 4. Conditions
        for c in cond_res:
            all_resources.append(c.model_dump(by_alias=True))

        # 5. DiagnosticReports
        for dr in diag_res:
            all_resources.append(dr.model_dump(by_alias=True))

        # 6. DocumentReferences
        for doc in doc_res:
            all_resources.append(doc.model_dump(by_alias=True))

        # 7. Encounters
        for enc in enc_res:
            all_resources.append(enc.model_dump(by_alias=True))

        entries: List[FHIRBundleEntry] = [
            FHIRBundleEntry(
                fullUrl=f"urn:uuid:{res.get('id', uuid.uuid4())}",
                resource=res,
            )
            for res in all_resources
        ]

        bundle_id = str(uuid.uuid4())
        timestamp_str = datetime.utcnow().isoformat() + "Z"

        return FHIRBundle(
            id=bundle_id,
            type="collection",
            timestamp=timestamp_str,
            total=len(entries),
            meta={
                "lastUpdated": timestamp_str,
                "profile": [
                    "https://nrces.in/ndhm/fhir/r4/StructureDefinition/HealthRecordBundle"
                ],
                "tag": [
                    {
                        "system": "https://abdm.gov.in/hackathon",
                        "code": "prototype",
                        "display": "DEMO / MOCK ABHA ID - Hackathon Prototype",
                    }
                ],
                "security": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
                        "code": "R",
                        "display": "Restricted",
                    }
                ],
            },
            entry=entries,
            resources=all_resources,
        )


fhir_service = FHIRService()
