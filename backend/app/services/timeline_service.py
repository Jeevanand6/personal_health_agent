import uuid
import re
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc, and_, or_

from app.models.user import User
from app.models.document import Document
from app.models.ai_extraction import AIExtraction
from app.models.observation_interpretation import ObservationInterpretation
from app.models.timeline_event import TimelineEvent, TimelineEventType
from app.schemas.timeline import (
    TimelineEventItem,
    TimelineEventGroup,
    TimelineSummaryStats,
    TimelineResponse,
)
from app.core.logging import logger


CATEGORY_MAPPING = {
    "all": None,
    "documents": [
        TimelineEventType.DOCUMENT.value,
        TimelineEventType.DIAGNOSTIC_REPORT.value,
        TimelineEventType.DISCHARGE.value,
    ],
    "medications": [TimelineEventType.MEDICATION.value],
    "laboratory": [TimelineEventType.LAB_RESULT.value],
    "diagnoses": [TimelineEventType.DIAGNOSIS.value],
    "visits": [TimelineEventType.ENCOUNTER.value],
}


class TimelineService:
    """
    Unified Healthcare Timeline Service.
    Aggregates and synchronizes timeline events strictly grounded in verified database records.
    Every timeline event is traceable to a source document.
    """

    def sync_user_timeline(self, db: Session, user_id: uuid.UUID) -> int:
        """
        Idempotently scans all verified documents, extractions, and interpretations
        for the given user and populates the timeline_events table.
        """
        documents: List[Document] = (
            db.query(Document)
            .filter(Document.user_id == user_id)
            .order_by(asc(Document.upload_date))
            .all()
        )

        existing_events = (
            db.query(TimelineEvent)
            .filter(TimelineEvent.user_id == user_id)
            .all()
        )
        # Unique fingerprint: (source_document_id, event_type, title)
        existing_keys = {
            (str(e.source_document_id), e.event_type, e.title.strip().lower())
            for e in existing_events
        }

        new_events_count = 0

        for doc in documents:
            doc_id_str = str(doc.id)
            doc_title = doc.original_filename or doc.filename or "Clinical Record"
            doc_type = (doc.document_type or "CLINICAL_RECORD").upper()

            extraction: Optional[AIExtraction] = (
                db.query(AIExtraction).filter(AIExtraction.document_id == doc.id).first()
            )
            structured_data: Dict[str, Any] = (
                extraction.structured_data if extraction and extraction.structured_data else {}
            )

            # Resolve effective event date
            event_dt = doc.upload_date or doc.created_at
            raw_date_str = structured_data.get("document_date")
            if raw_date_str:
                parsed_dt = self._parse_date_string(raw_date_str)
                if parsed_dt:
                    event_dt = parsed_dt

            def _extract_str(val: Any) -> Optional[str]:
                if isinstance(val, dict):
                    res = val.get("normalized_value") or val.get("raw_text")
                    return str(res).strip() if res else None
                return str(val).strip() if val is not None and str(val).strip() else None

            doctor_name = _extract_str(structured_data.get("doctor_name"))
            hospital_name = _extract_str(structured_data.get("hospital_name") or structured_data.get("clinic_name"))

            # 1. DOCUMENT EVENT
            doc_event_type = TimelineEventType.DOCUMENT.value
            if "DISCHARGE" in doc_type:
                doc_event_type = TimelineEventType.DISCHARGE.value
                doc_event_title = f"Hospital Discharge Summary: {doc_title}"
            elif "LAB" in doc_type or "DIAGNOSTIC" in doc_type:
                doc_event_type = TimelineEventType.DIAGNOSTIC_REPORT.value
                doc_event_title = f"Diagnostic Report Filed: {doc_title}"
            else:
                doc_event_title = f"Medical Record Uploaded: {doc_title}"

            doc_key = (doc_id_str, doc_event_type, doc_event_title.strip().lower())
            if doc_key not in existing_keys:
                desc_parts = [f"File: {doc_title} ({doc_type})"]
                if hospital_name:
                    desc_parts.append(f"Facility: {hospital_name}")
                if doctor_name:
                    desc_parts.append(f"Practitioner: {doctor_name}")

                db.add(
                    TimelineEvent(
                        id=uuid.uuid4(),
                        user_id=user_id,
                        event_type=doc_event_type,
                        event_date=event_dt,
                        title=doc_event_title,
                        description=" • ".join(desc_parts),
                        source_document_id=doc.id,
                        source_document_title=doc_title,
                        metadata_json={
                            "document_type": doc_type,
                            "file_size": doc.file_size,
                            "doctor_name": doctor_name,
                            "hospital_name": hospital_name,
                        },
                    )
                )
                existing_keys.add(doc_key)
                new_events_count += 1

            # 2. ENCOUNTER EVENT (if doctor or hospital or clinical consultation documented)
            if doctor_name or hospital_name:
                encounter_title = (
                    f"Consultation with {doctor_name}"
                    if doctor_name
                    else f"Medical Encounter at {hospital_name}"
                )[:240]
                encounter_key = (doc_id_str, TimelineEventType.ENCOUNTER.value, encounter_title.strip().lower())
                if encounter_key not in existing_keys:
                    enc_desc = f"Clinical encounter documented in {doc_title}."
                    if hospital_name:
                        enc_desc += f" Location: {hospital_name}."
                    if doctor_name:
                        enc_desc += f" Physician: {doctor_name}."

                    db.add(
                        TimelineEvent(
                            id=uuid.uuid4(),
                            user_id=user_id,
                            event_type=TimelineEventType.ENCOUNTER.value,
                            event_date=event_dt,
                            title=encounter_title,
                            description=enc_desc,
                            source_document_id=doc.id,
                            source_document_title=doc_title,
                            metadata_json={
                                "doctor_name": doctor_name,
                                "hospital_name": hospital_name,
                            },
                        )
                    )
                    existing_keys.add(encounter_key)
                    new_events_count += 1

            # 3. DIAGNOSES EVENTS
            diagnoses = structured_data.get("diagnoses") or []
            for diag in diagnoses:
                if isinstance(diag, str) and diag.strip():
                    diag_title = f"Diagnosis: {diag.strip()}"
                    diag_key = (doc_id_str, TimelineEventType.DIAGNOSIS.value, diag_title.strip().lower())
                    if diag_key not in existing_keys:
                        diag_desc = f"Documented clinical diagnosis: {diag.strip()}."
                        if doctor_name:
                            diag_desc += f" Attending: {doctor_name}."

                        db.add(
                            TimelineEvent(
                                id=uuid.uuid4(),
                                user_id=user_id,
                                event_type=TimelineEventType.DIAGNOSIS.value,
                                event_date=event_dt,
                                title=diag_title,
                                description=diag_desc,
                                source_document_id=doc.id,
                                source_document_title=doc_title,
                                metadata_json={
                                    "condition": diag.strip(),
                                    "doctor_name": doctor_name,
                                    "hospital_name": hospital_name,
                                },
                            )
                        )
                        existing_keys.add(diag_key)
                        new_events_count += 1

            # 4. MEDICATION EVENTS
            # CLINICAL SAFETY GATE: Prescriptions must be approved/verified by user before appearing on timeline
            is_prescription = (
                doc_type == "PRESCRIPTION"
                or (extraction and getattr(extraction, "extraction_type", "") == "PRESCRIPTION")
            )
            is_verified_doc = bool(extraction and getattr(extraction, "is_verified", False))

            meds = structured_data.get("medications") or []
            # Only sync medications if this is not a prescription or if the prescription has been verified
            if not is_prescription or is_verified_doc:
                for med in meds:
                    if isinstance(med, dict):
                        m_name = None
                        if isinstance(med.get("name_as_written"), dict):
                            m_name = med["name_as_written"].get("normalized_value") or med["name_as_written"].get("raw_text")
                        elif isinstance(med.get("name"), str):
                            m_name = med.get("name")

                        if m_name and m_name.strip():
                            def _str_val(v: Any) -> str:
                                if isinstance(v, dict):
                                    return v.get("normalized_value") or v.get("raw_text") or ""
                                return str(v) if v is not None else ""

                            dosage = _str_val(med.get("dosage"))
                            freq = _str_val(med.get("frequency"))
                            instructions = _str_val(med.get("instructions"))
                            med_title = f"Prescription: {m_name.strip()}" + (f" ({dosage})" if dosage else "")
                            med_key = (doc_id_str, TimelineEventType.MEDICATION.value, med_title.strip().lower())
                            if med_key not in existing_keys:
                                desc_lines = []
                                if dosage:
                                    desc_lines.append(f"Dosage: {dosage}")
                                if freq:
                                    desc_lines.append(f"Frequency: {freq}")
                                if instructions:
                                    desc_lines.append(f"Instructions: {instructions}")
                                med_desc = " | ".join(desc_lines) if desc_lines else "Prescribed medication on record."

                                db.add(
                                    TimelineEvent(
                                        id=uuid.uuid4(),
                                        user_id=user_id,
                                        event_type=TimelineEventType.MEDICATION.value,
                                        event_date=event_dt,
                                        title=med_title,
                                        description=med_desc,
                                        source_document_id=doc.id,
                                        source_document_title=doc_title,
                                        metadata_json={
                                            "medication_name": m_name.strip(),
                                            "dosage": dosage,
                                            "frequency": freq,
                                            "instructions": instructions,
                                            "is_verified": is_verified_doc,
                                        },
                                    )
                                )
                                existing_keys.add(med_key)
                                new_events_count += 1

            # 5. LABORATORY OBSERVATION EVENTS
            interpretations: List[ObservationInterpretation] = (
                db.query(ObservationInterpretation)
                .filter(ObservationInterpretation.document_id == doc.id)
                .all()
            )

            for interp in interpretations:
                test_name = interp.test_name
                val_str = interp.value
                unit_str = interp.unit or ""
                ref_str = interp.reference_range or "Not specified"
                status = interp.status or "UNKNOWN"
                severity = interp.severity or "INFORMATIONAL"

                lab_title = f"Lab Result: {test_name} ({val_str} {unit_str})".strip()
                lab_key = (doc_id_str, TimelineEventType.LAB_RESULT.value, lab_title.strip().lower())

                # Check if effective interpretation timestamp should be used
                interp_dt = interp.created_at if interp.created_at else event_dt

                if lab_key not in existing_keys:
                    lab_desc = (
                        f"Result: {val_str} {unit_str} | Status: {status} | "
                        f"Reference Range: {ref_str}. {interp.explanation}"
                    )
                    db.add(
                        TimelineEvent(
                            id=uuid.uuid4(),
                            user_id=user_id,
                            event_type=TimelineEventType.LAB_RESULT.value,
                            event_date=interp_dt,
                            title=lab_title,
                            description=lab_desc,
                            source_document_id=doc.id,
                            source_document_title=doc_title,
                            metadata_json={
                                "test_name": test_name,
                                "value": val_str,
                                "unit": unit_str,
                                "reference_range": ref_str,
                                "status": status,
                                "severity": severity,
                            },
                        )
                    )
                    existing_keys.add(lab_key)
                    new_events_count += 1

        if new_events_count > 0:
            db.commit()
            logger.info(f"Synchronized {new_events_count} new timeline events for user {user_id}")

        return new_events_count

    def get_timeline(
        self,
        db: Session,
        user_id: uuid.UUID,
        category: Optional[str] = "all",
        event_type: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        search: Optional[str] = None,
        order: str = "desc",
    ) -> TimelineResponse:
        """
        Retrieves sorted and filtered timeline events with date groupings and KPI statistics.
        """
        # Ensure user timeline is up-to-date with DB records
        self.sync_user_timeline(db, user_id)

        query = db.query(TimelineEvent).filter(TimelineEvent.user_id == user_id)

        # Filter by category
        if category and category.lower() in CATEGORY_MAPPING:
            allowed_types = CATEGORY_MAPPING[category.lower()]
            if allowed_types:
                query = query.filter(TimelineEvent.event_type.in_(allowed_types))

        # Filter by explicit event_type
        if event_type:
            query = query.filter(TimelineEvent.event_type == event_type.upper())

        # Date range filtering
        if start_date:
            start_dt = datetime.combine(start_date, datetime.min.time())
            query = query.filter(TimelineEvent.event_date >= start_dt)
        if end_date:
            end_dt = datetime.combine(end_date, datetime.max.time())
            query = query.filter(TimelineEvent.event_date <= end_dt)

        # Keyword search
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    TimelineEvent.title.ilike(term),
                    TimelineEvent.description.ilike(term),
                    TimelineEvent.source_document_title.ilike(term),
                )
            )

        # Sorting
        if order.lower() == "asc":
            query = query.order_by(asc(TimelineEvent.event_date), asc(TimelineEvent.created_at))
        else:
            query = query.order_by(desc(TimelineEvent.event_date), desc(TimelineEvent.created_at))

        events: List[TimelineEvent] = query.all()

        # Build stats
        total_events = len(events)
        by_type: Dict[str, int] = {}
        for ev in events:
            by_type[ev.event_type] = by_type.get(ev.event_type, 0) + 1

        earliest_date_str = None
        latest_date_str = None
        if events:
            # Sort chronologically to find bounds
            sorted_dates = sorted([ev.event_date for ev in events])
            earliest_date_str = sorted_dates[0].strftime("%Y-%m-%d")
            latest_date_str = sorted_dates[-1].strftime("%Y-%m-%d")

        stats = TimelineSummaryStats(
            total_events=total_events,
            by_type=by_type,
            earliest_date=earliest_date_str,
            latest_date=latest_date_str,
        )

        # Group events by date
        grouped_dict: Dict[str, List[TimelineEventItem]] = {}
        items_list: List[TimelineEventItem] = []

        for ev in events:
            item = TimelineEventItem.model_validate(ev)
            items_list.append(item)

            # Date grouping format: "YYYY-MM-DD" or "Month Year"
            d_key = ev.event_date.strftime("%Y-%m-%d")
            if d_key not in grouped_dict:
                grouped_dict[d_key] = []
            grouped_dict[d_key].append(item)

        groups: List[TimelineEventGroup] = []
        for d_key, grp_items in grouped_dict.items():
            try:
                parsed_d = datetime.strptime(d_key, "%Y-%m-%d")
                display_str = parsed_d.strftime("%B %d, %Y")
            except Exception:
                display_str = d_key

            groups.append(
                TimelineEventGroup(
                    date_group=d_key,
                    display_date=display_str,
                    event_count=len(grp_items),
                    events=grp_items,
                )
            )

        return TimelineResponse(
            events=items_list,
            grouped_events=groups,
            stats=stats,
            available_categories=[
                "all",
                "documents",
                "medications",
                "laboratory",
                "diagnoses",
                "visits",
            ],
        )

    def _parse_date_string(self, raw: str) -> Optional[datetime]:
        """Safely parses multiple date string patterns into datetime."""
        if not raw or not isinstance(raw, str):
            return None
        patterns = [
            "%Y-%m-%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
            "%d %b %Y",
            "%d %B %Y",
            "%b %d, %Y",
            "%B %d, %Y",
        ]
        for p in patterns:
            try:
                return datetime.strptime(raw.strip(), p)
            except ValueError:
                continue
        # Fallback regex for YYYY-MM-DD
        m = re.search(r"(\d{4})-(\d{2})-(\d{2})", raw)
        if m:
            try:
                return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            except Exception:
                pass
        return None


timeline_service = TimelineService()
