import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.user import User
from app.models.patient import Patient
from app.models.document import Document
from app.models.ai_extraction import AIExtraction
from app.models.observation_interpretation import ObservationInterpretation
from app.models.health_summary import HealthSummary
from app.schemas.health_summary import (
    SourceDocumentReference,
    HealthSnapshotSection,
    MedicalRecordSummaryItem,
    MedicationSummaryItem,
    LabObservationSummaryItem,
    AbnormalResultSummaryItem,
    DiagnosisSummaryItem,
    ImportantDateItem,
    DoctorQuestionItem,
    StructuredHealthSummaryContent,
)
from app.core.logging import logger

DISCLAIMER_EN = "This summary is for informational purposes and does not replace professional medical advice."
DISCLAIMER_TA = "இந்த சுருக்கம் தகவல் நோக்கங்களுக்காக மட்டுமே மற்றும் தொழில்முறை மருத்துவ ஆலோசனையை மாற்றாது."


class HealthSummaryService:
    """
    AI-Powered Personal Health Summary Engine.
    Grounded exclusively in verified structured medical records from the database.
    
    SAFETY CONSTRAINTS:
    - Never diagnose
    - Never prescribe
    - Never change medication
    - Never predict disease
    - Never claim certainty
    - Never invent medical history
    - Every generated statement must be traceable to source records with source document IDs.
    - Standardized non-diagnostic guidance phrasing.
    - Supports English ('en') and Tamil ('ta').
    """

    def get_latest_summary(self, db: Session, user_id: uuid.UUID, language: str = "en") -> Optional[HealthSummary]:
        """
        Retrieves the most recent summary for a user in the requested language,
        or the most recent summary overall if language not matched.
        """
        summary = (
            db.query(HealthSummary)
            .filter(HealthSummary.user_id == user_id, HealthSummary.language == language)
            .order_by(desc(HealthSummary.generated_at))
            .first()
        )
        if not summary and language != "en":
            # Fallback to English if Tamil not yet generated
            summary = (
                db.query(HealthSummary)
                .filter(HealthSummary.user_id == user_id)
                .order_by(desc(HealthSummary.generated_at))
                .first()
            )
        return summary

    def generate_health_summary(
        self,
        db: Session,
        user_id: uuid.UUID,
        language: str = "en",
        force_refresh: bool = False,
    ) -> HealthSummary:
        """
        Aggregates verified database records and generates a traceable,
        non-diagnostic Personal Health Summary in the chosen language.
        """
        lang = "ta" if language.lower() in ["ta", "tamil"] else "en"

        # Check existing recent summary if not force refreshing
        if not force_refresh:
            existing = self.get_latest_summary(db, user_id, lang)
            if existing and existing.language == lang:
                logger.info(f"Returning cached health summary {existing.id} for user {user_id}")
                return existing

        # 1. Fetch Patient profile
        patient = db.query(Patient).filter(Patient.user_id == user_id).first()
        patient_info: Dict[str, Any] = {
            "gender": patient.gender if patient and patient.gender else "Not specified",
            "blood_group": patient.blood_group if patient and patient.blood_group else "Not specified",
            "age": None,
        }
        if patient and patient.date_of_birth:
            try:
                today = datetime.utcnow().date()
                age_calc = today.year - patient.date_of_birth.year - (
                    (today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day)
                )
                patient_info["age"] = str(age_calc)
            except Exception:
                pass

        # 2. Fetch User's verified documents
        documents: List[Document] = (
            db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(desc(Document.upload_date))
            .all()
        )

        source_doc_refs: List[SourceDocumentReference] = []
        recent_medical_records: List[MedicalRecordSummaryItem] = []
        medications: List[MedicationSummaryItem] = []
        lab_observations: List[LabObservationSummaryItem] = []
        abnormal_results: List[AbnormalResultSummaryItem] = []
        recent_diagnoses: List[DiagnosisSummaryItem] = []
        important_dates: List[ImportantDateItem] = []
        doctor_questions: List[DoctorQuestionItem] = []

        seen_medication_names = set()
        seen_diagnosis_names = set()
        seen_lab_tests = set()
        source_doc_ids_all = []

        for doc in documents:
            doc_id_str = str(doc.id)
            source_doc_ids_all.append(doc_id_str)
            filename = doc.original_filename or doc.filename or "Medical Document"
            doc_type = doc.document_type or "CLINICAL_RECORD"
            
            # Fetch structured extraction
            extraction: Optional[AIExtraction] = (
                db.query(AIExtraction).filter(AIExtraction.document_id == doc.id).first()
            )
            structured_data = extraction.structured_data if extraction and extraction.structured_data else {}

            def _extract_str(val: Any) -> Optional[str]:
                if isinstance(val, dict):
                    return val.get("normalized_value") or val.get("raw_text") or None
                return str(val) if val is not None else None

            raw_date = _extract_str(structured_data.get("document_date") or structured_data.get("prescription_date"))
            doc_date = raw_date or doc.upload_date.strftime("%Y-%m-%d")
            hospital_name = _extract_str(structured_data.get("hospital_name") or structured_data.get("clinic_name"))
            doctor_name = _extract_str(structured_data.get("doctor_name"))

            source_doc_refs.append(
                SourceDocumentReference(
                    document_id=doc_id_str,
                    filename=filename,
                    document_date=doc_date,
                    hospital_name=hospital_name,
                    doctor_name=doctor_name,
                )
            )

            # Key findings for document card
            key_findings: List[str] = []

            # Process Diagnoses from structured data
            raw_diagnoses = structured_data.get("diagnoses") or []
            for diag in raw_diagnoses:
                if isinstance(diag, str) and diag.strip():
                    clean_diag = diag.strip()
                    key_findings.append(f"Recorded condition: {clean_diag}" if lang == "en" else f"பதிவு செய்யப்பட்ட நிலை: {clean_diag}")
                    if clean_diag.lower() not in seen_diagnosis_names:
                        seen_diagnosis_names.add(clean_diag.lower())
                        recent_diagnoses.append(
                            DiagnosisSummaryItem(
                                condition_name=clean_diag,
                                recorded_date=doc_date,
                                doctor_name=doctor_name,
                                hospital_name=hospital_name,
                                source_document_id=doc_id_str,
                                source_document_title=filename,
                            )
                        )

            # Process Medications from structured data
            # CLINICAL SAFETY GATE: Prescriptions must be verified by user before being listed as active medications
            is_prescription = (
                doc_type == "PRESCRIPTION"
                or (extraction and getattr(extraction, "extraction_type", "") == "PRESCRIPTION")
            )
            is_verified_doc = bool(extraction and getattr(extraction, "is_verified", False))

            raw_meds = structured_data.get("medications") or []
            if not is_prescription or is_verified_doc:
                for med in raw_meds:
                    if isinstance(med, dict):
                        name = None
                        if isinstance(med.get("name_as_written"), dict):
                            name = med["name_as_written"].get("normalized_value") or med["name_as_written"].get("raw_text")
                        elif isinstance(med.get("name"), str):
                            name = med.get("name")

                        if name and name.strip():
                            clean_name = name.strip()

                            def _get_val(fld: Any) -> Optional[str]:
                                if isinstance(fld, dict):
                                    return fld.get("normalized_value") or fld.get("raw_text")
                                return str(fld) if fld is not None else None

                            dosage = _get_val(med.get("dosage"))
                            freq = _get_val(med.get("frequency"))
                            instructions = _get_val(med.get("instructions"))
                            route = _get_val(med.get("route"))
                            duration = _get_val(med.get("duration"))

                            med_finding = f"Prescribed: {clean_name}" + (f" ({dosage})" if dosage else "")
                            if lang == "ta":
                                med_finding = f"மருந்து: {clean_name}" + (f" ({dosage})" if dosage else "")
                            key_findings.append(med_finding)

                            med_key = f"{clean_name.lower()}_{dosage or ''}"
                            if med_key not in seen_medication_names:
                                seen_medication_names.add(med_key)
                                medications.append(
                                    MedicationSummaryItem(
                                        name=clean_name,
                                        dosage=dosage,
                                        route=route,
                                        frequency=freq,
                                        duration=duration,
                                        instructions=instructions,
                                        source_document_id=doc_id_str,
                                        source_document_title=filename,
                                    )
                                )

            # Process Interpretations from DB (ObservationInterpretation)
            interpretations: List[ObservationInterpretation] = (
                db.query(ObservationInterpretation)
                .filter(ObservationInterpretation.document_id == doc.id)
                .all()
            )

            for interp in interpretations:
                test_name = interp.test_name
                val_str = interp.value
                unit_str = interp.unit or ""
                ref_range = interp.reference_range or "Not specified"
                status = interp.status or "UNKNOWN"
                severity = interp.severity or "INFORMATIONAL"

                lab_observations.append(
                    LabObservationSummaryItem(
                        test_name=test_name,
                        value=val_str,
                        unit=unit_str,
                        reference_range=ref_range,
                        status=status,
                        test_date=doc_date,
                        source_document_id=doc_id_str,
                        source_document_title=filename,
                    )
                )

                if status in ["LOW", "HIGH"] or severity in ["REVIEW_RECOMMENDED", "URGENT_REVIEW"]:
                    # Create traceable statement
                    if lang == "ta":
                        status_ta = "குறைவாக" if status == "LOW" else "அதிகமாக"
                        ta_test_name = test_name
                        if "hemoglobin" in test_name.lower():
                            ta_test_name = "ஹீமோகுளோபின்"
                        elif "fasting blood sugar" in test_name.lower() or "glucose" in test_name.lower():
                            ta_test_name = "இரத்த சர்க்கரை"
                        elif "creatinine" in test_name.lower():
                            ta_test_name = "சீரம் கிரியேட்டினின்"
                        elif "cholesterol" in test_name.lower():
                            ta_test_name = "கொலஸ்ட்ரால்"

                        statement = (
                            f"உங்கள் அறிக்கையில் குறிப்பிடப்பட்டுள்ள இயல்பான வரம்பை விட {ta_test_name} அளவு {status_ta} உள்ளது"
                            + (f" ({val_str} {unit_str}, குறிப்பு வரம்பு: {ref_range})." if val_str else ".")
                        )
                        action_guidance = (
                            "உங்களுக்கு ஏதேனும் சந்தேகங்கள் இருந்தால் இந்த முடிவு குறித்து உங்கள் மருத்துவரிடம் கலந்துரையாடுங்கள்."
                        )
                    else:
                        status_en = "below" if status == "LOW" else "above"
                        statement = (
                            f"Your {test_name.lower()} value is {status_en} the reference range shown in the report"
                            + (f" ({val_str} {unit_str}, reference range: {ref_range})." if val_str else ".")
                        )
                        action_guidance = (
                            "Discuss this result with your healthcare professional if you have concerns."
                        )

                    abnormal_results.append(
                        AbnormalResultSummaryItem(
                            test_name=test_name,
                            value=val_str,
                            unit=unit_str,
                            reference_range=ref_range,
                            status=status,
                            severity=severity,
                            statement=statement,
                            action_guidance=action_guidance,
                            source_document_id=doc_id_str,
                            source_document_title=filename,
                        )
                    )

            if not key_findings:
                if interpretations:
                    key_findings.append(
                        f"Included {len(interpretations)} lab test observations"
                        if lang == "en"
                        else f"{len(interpretations)} ஆய்வக சோதனைகள் சேர்க்கப்பட்டுள்ளன"
                    )
                else:
                    key_findings.append(
                        "Clinical document uploaded and processed"
                        if lang == "en"
                        else "மருத்துவ ஆவணம் பதிவேற்றப்பட்டு செயலாக்கப்பட்டது"
                    )

            recent_medical_records.append(
                MedicalRecordSummaryItem(
                    document_id=doc_id_str,
                    filename=filename,
                    document_type=doc_type,
                    document_date=doc_date,
                    doctor_name=doctor_name,
                    hospital_name=hospital_name,
                    key_findings=key_findings[:5],
                )
            )

            # Record important dates
            if doc_date:
                cat = "LAB_TEST" if interpretations else ("PRESCRIPTION" if raw_meds else "CONSULTATION")
                if lang == "ta":
                    ev = f"{filename} - {doc_type} பதிவு"
                else:
                    ev = f"Medical Record: {filename} ({doc_type})"
                important_dates.append(
                    ImportantDateItem(
                        date=doc_date,
                        event=ev,
                        category=cat,
                        source_document_id=doc_id_str,
                    )
                )

        # Sort dates descending
        important_dates.sort(key=lambda x: x.date, reverse=True)

        # 3. Generate tailored, non-diagnostic doctor questions based on verified findings
        q_idx = 1

        # Questions for abnormal laboratory results
        for ab in abnormal_results:
            t_name = ab.test_name
            t_val = f"{ab.value} {ab.unit or ''}".strip()
            
            if lang == "ta":
                q_text = f"எனது {t_name} மதிப்பு ({t_val}) குறித்து நாம் ஏதேனும் பின்தொடர் பரிசோதனை அல்லது வாழ்க்கை முறை மாற்றங்கள் செய்ய வேண்டுமா?"
                q_ctx = f"அறிக்கையில் குறிப்பு வரம்பை விட {ab.status} என பதிவு செய்யப்பட்டுள்ளது."
            else:
                q_text = f"Considering my {t_name} reading of {t_val}, are there any follow-up tests or lifestyle adjustments you would recommend?"
                q_ctx = f"Recorded as {ab.status} compared with the laboratory reference range ({ab.reference_range})."

            doctor_questions.append(
                DoctorQuestionItem(
                    id=f"q_{q_idx}",
                    category="LABORATORY",
                    question=q_text,
                    context=q_ctx,
                    related_test_or_topic=t_name,
                    source_document_id=ab.source_document_id,
                )
            )
            q_idx += 1

        # Questions for medications
        for med in medications[:3]:
            m_name = med.name
            m_dose = f" ({med.dosage})" if med.dosage else ""
            if lang == "ta":
                q_text = f"{m_name}{m_dose} மருந்தை நான் தொடர்ந்து உட்கொள்ள வேண்டுமா மற்றும் ஏதேனும் பக்க விளைவுகளை கவனிக்க வேண்டுமா?"
                q_ctx = f"மருத்துவ பதிவுகளில் குறிப்பிடப்பட்டுள்ள மருந்து."
            else:
                q_text = f"How long should I continue taking {m_name}{m_dose}, and are there any specific precautions or side effects to watch for?"
                q_ctx = f"Active medication documented in medical records."

            doctor_questions.append(
                DoctorQuestionItem(
                    id=f"q_{q_idx}",
                    category="MEDICATION",
                    question=q_text,
                    context=q_ctx,
                    related_test_or_topic=m_name,
                    source_document_id=med.source_document_id,
                )
            )
            q_idx += 1

        # General follow-up questions
        if lang == "ta":
            doctor_questions.append(
                DoctorQuestionItem(
                    id=f"q_{q_idx}",
                    category="GENERAL",
                    question="எனது தற்போதைய முடிவுகளைக் கருத்தில் கொண்டு, எனது அடுத்த வழக்கமான பரிசோதனையை எப்போது திட்டமிட வேண்டும்?",
                    context="தொடர்ச்சியான சுகாதார கண்காணிப்பு.",
                    related_test_or_topic="Routine Follow-up",
                    source_document_id=source_doc_ids_all[0] if source_doc_ids_all else None,
                )
            )
        else:
            doctor_questions.append(
                DoctorQuestionItem(
                    id=f"q_{q_idx}",
                    category="GENERAL",
                    question="Based on my cumulative test results, when would you recommend scheduling my next routine follow-up evaluation?",
                    context="Periodic longitudinal health monitoring.",
                    related_test_or_topic="Routine Follow-up",
                    source_document_id=source_doc_ids_all[0] if source_doc_ids_all else None,
                )
            )

        # 4. Construct Health Snapshot Section
        total_docs = len(documents)
        total_meds = len(medications)
        total_labs = len(lab_observations)
        total_abnormals = len(abnormal_results)

        if lang == "ta":
            headline = f"தனிப்பட்ட சுகாதார சுருக்கம் ({total_docs} ஆவணங்கள் பகுப்பாய்வு செய்யப்பட்டன)"
            overview_text = (
                f"உங்கள் சரிபார்க்கப்பட்ட மருத்துவ தரவுத்தள பதிவுகளிலிருந்து தொகுக்கப்பட்டது. "
                f"மொத்தம் {total_docs} மருத்துவ ஆவணங்கள், {total_meds} மருந்துகள், மற்றும் {total_labs} ஆய்வக பரிசோதனை முடிவுகள் பகுப்பாய்வு செய்யப்பட்டுள்ளன. "
                f"{total_abnormals} ஆய்வக முடிவுகள் குறிப்பு வரம்புகளுக்கு வெளியே உள்ளன, அவை மருத்துவரிடம் விவாதிக்க பரிந்துரைக்கப்படுகின்றன."
            )
        else:
            headline = f"Personal Health Overview ({total_docs} Verified Documents Analyzed)"
            overview_text = (
                f"Synthesized from your verified medical database records. "
                f"A total of {total_docs} clinical document(s), {total_meds} active medication(s), "
                f"and {total_labs} laboratory observation(s) were analyzed. "
                f"{total_abnormals} result(s) are outside reported reference ranges and recommended for physician review."
            )

        health_snapshot = HealthSnapshotSection(
            headline=headline,
            patient_context=patient_info,
            overview_text=overview_text,
            total_records_analyzed=total_docs,
            active_medications_count=total_meds,
            lab_tests_count=total_labs,
            abnormal_findings_count=total_abnormals,
            source_document_ids=source_doc_ids_all,
        )

        disclaimer = DISCLAIMER_TA if lang == "ta" else DISCLAIMER_EN

        structured_summary_content = StructuredHealthSummaryContent(
            language=lang,
            disclaimer=disclaimer,
            health_snapshot=health_snapshot,
            recent_medical_records=recent_medical_records,
            medications=medications,
            laboratory_observations=lab_observations,
            abnormal_results=abnormal_results,
            recent_diagnoses=recent_diagnoses,
            important_dates=important_dates,
            doctor_questions=doctor_questions,
        )

        # Store in database
        db_summary = HealthSummary(
            id=uuid.uuid4(),
            user_id=user_id,
            language=lang,
            summary=structured_summary_content.model_dump(),
            source_documents=[ref.model_dump() for ref in source_doc_refs],
            model="health-summary-engine-v1",
            confidence=0.96,
            generated_at=datetime.utcnow(),
        )

        db.add(db_summary)
        db.commit()
        db.refresh(db_summary)

        logger.info(f"Generated and saved HealthSummary {db_summary.id} for user {user_id} in {lang}")
        return db_summary


health_summary_service = HealthSummaryService()
