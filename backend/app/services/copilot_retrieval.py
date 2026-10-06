import math
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.document import Document
from app.models.document_chunk import DocumentChunk
from app.models.extraction import DocumentExtraction
from app.models.ai_extraction import AIExtraction
from app.models.observation_interpretation import ObservationInterpretation
from app.models.timeline_event import TimelineEvent
from app.services.llm_provider import LLMProviderFactory
from app.core.logging import logger


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """Compute cosine similarity between two float vectors."""
    if not vec_a or not vec_b or len(vec_a) != len(vec_b):
        return 0.0
    dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
    norm_a = math.sqrt(sum(a * a for a in vec_a))
    norm_b = math.sqrt(sum(b * b for b in vec_b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot_product / (norm_a * norm_b)


class CopilotRetrievalService:
    """
    Healthcare RAG Retrieval Service.
    Enforces strict user isolation (WHERE user_id = authenticated_user_id).
    Retrieves from:
    1. Semantic Document Chunks (OCR vector search)
    2. Structured Medications & Diagnoses (AIExtraction)
    3. Structured Laboratory Observations (ObservationInterpretation)
    4. Healthcare Timeline Events (TimelineEvent)
    """

    @staticmethod
    def chunk_text(text: str, max_chunk_size: int = 600, overlap: int = 100) -> List[str]:
        """
        Splits medical text into coherent chunks based on section headers and paragraphs.
        """
        if not text or not text.strip():
            return []

        clean_text = text.strip()
        # If text is already concise, return as single chunk
        if len(clean_text) <= max_chunk_size:
            return [clean_text]

        # Split on medical section boundaries or double newlines
        paragraphs = [p.strip() for p in clean_text.split("\n\n") if p.strip()]
        chunks: List[str] = []
        current_chunk = ""

        for para in paragraphs:
            if len(current_chunk) + len(para) + 2 <= max_chunk_size:
                current_chunk = f"{current_chunk}\n\n{para}".strip() if current_chunk else para
            else:
                if current_chunk:
                    chunks.append(current_chunk)
                if len(para) > max_chunk_size:
                    # Break long paragraph by sentences or linebreaks
                    lines = [l.strip() for l in para.split("\n") if l.strip()]
                    sub_chunk = ""
                    for line in lines:
                        if len(sub_chunk) + len(line) + 1 <= max_chunk_size:
                            sub_chunk = f"{sub_chunk} {line}".strip() if sub_chunk else line
                        else:
                            if sub_chunk:
                                chunks.append(sub_chunk)
                            sub_chunk = line
                    if sub_chunk:
                        current_chunk = sub_chunk
                    else:
                        current_chunk = ""
                else:
                    current_chunk = para

        if current_chunk and current_chunk not in chunks:
            chunks.append(current_chunk)

        return chunks if chunks else [clean_text[:max_chunk_size]]

    async def index_document_chunks(
        self, db: Session, document_id: uuid.UUID, user_id: uuid.UUID
    ) -> int:
        """
        Chunks the OCR text of an authorized document, computes vector embeddings,
        and saves DocumentChunk records in the database.
        """
        doc = (
            db.query(Document)
            .filter(Document.id == document_id, Document.user_id == user_id)
            .first()
        )
        if not doc:
            logger.warning(f"Document {document_id} not found or unauthorized for user {user_id}")
            return 0

        # Retrieve OCR extraction
        extraction = (
            db.query(DocumentExtraction)
            .filter(DocumentExtraction.document_id == document_id)
            .first()
        )
        raw_text = ""
        if extraction and extraction.cleaned_text:
            raw_text = extraction.cleaned_text
        elif extraction and extraction.raw_text:
            raw_text = extraction.raw_text

        if not raw_text.strip():
            logger.info(f"No OCR text available to index for document {document_id}")
            return 0

        # Purge existing chunks for fresh index
        db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
        db.commit()

        chunks = self.chunk_text(raw_text)
        provider = LLMProviderFactory.get_provider()

        created_chunks: List[DocumentChunk] = []
        for idx, chunk_text in enumerate(chunks):
            embedding_vec = await provider.create_embedding(chunk_text)
            new_chunk = DocumentChunk(
                document_id=doc.id,
                user_id=user_id,
                chunk_index=idx,
                content=chunk_text,
                page_number=1,  # Page 1 default
                embedding=embedding_vec,
                metadata_json={
                    "filename": doc.original_filename,
                    "document_type": doc.document_type,
                    "length": len(chunk_text),
                },
            )
            db.add(new_chunk)
            created_chunks.append(new_chunk)

        db.commit()
        logger.info(
            f"Successfully indexed {len(created_chunks)} chunks for document {document_id}"
        )
        return len(created_chunks)

    async def retrieve_semantic_chunks(
        self,
        db: Session,
        user_id: uuid.UUID,
        query: str,
        document_id: Optional[uuid.UUID] = None,
        top_k: int = 4,
    ) -> List[Tuple[DocumentChunk, float]]:
        """
        Performs semantic vector search over document chunks strictly isolated by user_id.
        Optionally filters to a single document_id (Mode A).
        """
        # Ensure document chunks exist; if none exist yet for this document, attempt indexing
        query_builder = db.query(DocumentChunk).filter(DocumentChunk.user_id == user_id)
        if document_id:
            query_builder = query_builder.filter(DocumentChunk.document_id == document_id)

        all_chunks = query_builder.all()

        # If zero chunks found for document, attempt on-demand indexing
        if not all_chunks and document_id:
            await self.index_document_chunks(db, document_id, user_id)
            all_chunks = query_builder.all()

        if not all_chunks:
            return []

        # Generate query embedding
        provider = LLMProviderFactory.get_provider()
        query_vec = await provider.create_embedding(query)

        scored_chunks: List[Tuple[DocumentChunk, float]] = []
        for chunk in all_chunks:
            if chunk.embedding and isinstance(chunk.embedding, list):
                score = cosine_similarity(query_vec, chunk.embedding)
            else:
                # Fallback keyword match score
                q_words = set(query.lower().split())
                c_words = set(chunk.content.lower().split())
                score = len(q_words.intersection(c_words)) / max(len(q_words), 1)
            scored_chunks.append((chunk, round(score, 4)))

        # Sort descending by similarity
        scored_chunks.sort(key=lambda x: x[1], reverse=True)
        return scored_chunks[:top_k]

    def retrieve_structured_metadata(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all structured clinical metadata (doctor, hospital, patient, diagnoses, dates, notes)
        from AIExtraction records strictly scoped to the authenticated user.
        """
        import re

        query = (
            db.query(AIExtraction, Document)
            .join(Document, AIExtraction.document_id == Document.id)
            .filter(Document.user_id == user_id)
        )
        if document_id:
            query = query.filter(AIExtraction.document_id == document_id)

        records = query.order_by(desc(AIExtraction.created_at)).all()
        metadata_list: List[Dict[str, Any]] = []

        for ai_ext, doc in records:
            data = ai_ext.structured_data if isinstance(ai_ext.structured_data, dict) else {}
            doc_name = doc.original_filename

            doctor = data.get("doctor_name")
            hospital = data.get("hospital_name")
            patient = data.get("patient_name")
            doc_date = data.get("document_date")
            diagnoses = data.get("diagnoses") or []
            clinical_notes = data.get("clinical_notes")
            confidence = ai_ext.confidence_score or 0.90

            # Fallback check on DocumentExtraction text if doctor was not structured in AIExtraction
            if not doctor:
                ext = db.query(DocumentExtraction).filter(DocumentExtraction.document_id == doc.id).first()
                if ext and (ext.cleaned_text or ext.raw_text):
                    txt = ext.cleaned_text or ext.raw_text
                    doc_match = re.search(r"(?:Doctor|Dr\.?|Consultant)\s*[:\-]?\s*(?:Dr\.?\s*)?([A-Za-z.\s]{2,40})", txt, re.IGNORECASE)
                    if doc_match:
                        cand = doc_match.group(1).split("\n")[0].strip()
                        cand = re.sub(r"\b(MBBS|MD|MS|DNB|Date|Reg|No)\b.*", "", cand, flags=re.IGNORECASE).strip()
                        if len(cand) > 2:
                            doctor = f"Dr. {cand}" if not cand.lower().startswith("dr.") else cand

            metadata_list.append({
                "document_id": str(doc.id),
                "document_name": doc_name,
                "document_type": doc.document_type,
                "doctor_name": doctor,
                "hospital_name": hospital,
                "patient_name": patient,
                "document_date": doc_date,
                "diagnoses": diagnoses if isinstance(diagnoses, list) else [diagnoses] if diagnoses else [],
                "clinical_notes": clinical_notes,
                "confidence": confidence,
                "created_at": ai_ext.created_at,
            })

        return metadata_list

    def retrieve_doctors(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves verified doctor/physician information from user records."""
        metadata = self.retrieve_structured_metadata(db=db, user_id=user_id, document_id=document_id)
        doctors: List[Dict[str, Any]] = []
        seen = set()

        for m in metadata:
            doc_name = m.get("doctor_name")
            if doc_name and doc_name.strip():
                clean_name = doc_name.strip()
                key = (clean_name.lower(), m["document_id"])
                if key not in seen:
                    seen.add(key)
                    doctors.append({
                        "doctor_name": clean_name,
                        "hospital_name": m.get("hospital_name"),
                        "document_id": m["document_id"],
                        "document_name": m["document_name"],
                        "document_date": m.get("document_date"),
                        "confidence": m.get("confidence", 0.95),
                    })
        return doctors

    def retrieve_diagnoses(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves clinical diagnoses recorded in user records."""
        metadata = self.retrieve_structured_metadata(db=db, user_id=user_id, document_id=document_id)
        diag_list: List[Dict[str, Any]] = []
        for m in metadata:
            for d in m.get("diagnoses", []):
                if d and isinstance(d, str) and d.strip():
                    diag_list.append({
                        "diagnosis": d.strip(),
                        "document_id": m["document_id"],
                        "document_name": m["document_name"],
                        "document_date": m.get("document_date"),
                        "confidence": m.get("confidence", 0.95),
                    })
        return diag_list

    def retrieve_document_dates(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves document dates and visit dates recorded in user records."""
        metadata = self.retrieve_structured_metadata(db=db, user_id=user_id, document_id=document_id)
        dates: List[Dict[str, Any]] = []
        for m in metadata:
            d_val = m.get("document_date")
            if d_val:
                dates.append({
                    "date": str(d_val),
                    "document_id": m["document_id"],
                    "document_name": m["document_name"],
                    "document_type": m.get("document_type"),
                })
        return dates

    def retrieve_clinical_notes(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieves physician instructions, advice, and clinical remarks."""
        metadata = self.retrieve_structured_metadata(db=db, user_id=user_id, document_id=document_id)
        notes: List[Dict[str, Any]] = []
        for m in metadata:
            n_val = m.get("clinical_notes")
            if n_val and isinstance(n_val, str) and n_val.strip():
                notes.append({
                    "notes": n_val.strip(),
                    "doctor_name": m.get("doctor_name"),
                    "document_id": m["document_id"],
                    "document_name": m["document_name"],
                })
        return notes

    def retrieve_medications(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
        target_med_name: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Retrieves verified prescribed medications from AIExtraction records.
        Supports filtering by target medicine name.
        """
        query = (
            db.query(AIExtraction, Document)
            .join(Document, AIExtraction.document_id == Document.id)
            .filter(Document.user_id == user_id)
        )
        if document_id:
            query = query.filter(AIExtraction.document_id == document_id)

        records = query.order_by(desc(AIExtraction.created_at)).all()
        meds_list: List[Dict[str, Any]] = []

        for ai_ext, doc in records:
            if isinstance(ai_ext.structured_data, dict):
                extracted_meds = ai_ext.structured_data.get("medications", [])
                for med in extracted_meds:
                    if isinstance(med, dict) and med.get("name"):
                        m_name = med.get("name")
                        if target_med_name:
                            # Filter specifically for the requested medication
                            if target_med_name.lower() not in m_name.lower():
                                continue

                        med_item = dict(med)
                        med_item["source_document_id"] = str(doc.id)
                        med_item["source_document_name"] = doc.original_filename
                        med_item["extraction_date"] = ai_ext.created_at.strftime("%Y-%m-%d")
                        meds_list.append(med_item)

        return meds_list

    def retrieve_observations(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
        test_keyword: Optional[str] = None,
        abnormal_only: bool = False,
    ) -> List[ObservationInterpretation]:
        """
        Retrieves structured laboratory observations for the user.
        Supports clinical synonyms (e.g. glucose <=> sugar <=> fbs).
        If abnormal_only=True, returns strictly abnormal/flagged values.
        """
        from sqlalchemy import or_

        query = db.query(ObservationInterpretation).filter(
            ObservationInterpretation.user_id == user_id
        )
        if document_id:
            query = query.filter(ObservationInterpretation.document_id == document_id)

        if abnormal_only:
            query = query.filter(
                or_(
                    ObservationInterpretation.status.in_(["HIGH", "LOW", "ABNORMAL", "CRITICAL"]),
                    ObservationInterpretation.severity.in_(["HIGH", "CRITICAL", "REVIEW_RECOMMENDED"]),
                )
            )

        if test_keyword:
            kw = test_keyword.lower().strip()
            if kw in ["glucose", "sugar"]:
                query = query.filter(
                    or_(
                        ObservationInterpretation.test_name.ilike("%glucose%"),
                        ObservationInterpretation.test_name.ilike("%sugar%"),
                        ObservationInterpretation.test_name.ilike("%fbs%"),
                        ObservationInterpretation.test_name.ilike("%ppbs%"),
                    )
                )
            elif kw in ["hba1c", "a1c", "glycated hemoglobin"]:
                query = query.filter(
                    or_(
                        ObservationInterpretation.test_name.ilike("%hba1c%"),
                        ObservationInterpretation.test_name.ilike("%a1c%"),
                        ObservationInterpretation.test_name.ilike("%glycated%"),
                    )
                )
            elif kw in ["hemoglobin", "hb"]:
                query = query.filter(
                    or_(
                        ObservationInterpretation.test_name.ilike("%hemoglobin%"),
                        ObservationInterpretation.test_name.ilike("%hb%"),
                    )
                )
            elif kw in ["creatinine", "serum creatinine"]:
                query = query.filter(
                    ObservationInterpretation.test_name.ilike("%creatinine%")
                )
            elif kw in ["cholesterol", "lipid", "ldl", "hdl", "triglycerides"]:
                query = query.filter(
                    or_(
                        ObservationInterpretation.test_name.ilike("%cholesterol%"),
                        ObservationInterpretation.test_name.ilike("%lipid%"),
                        ObservationInterpretation.test_name.ilike("%ldl%"),
                        ObservationInterpretation.test_name.ilike("%hdl%"),
                        ObservationInterpretation.test_name.ilike("%triglyceride%"),
                    )
                )
            elif kw in ["blood pressure", "bp"]:
                query = query.filter(
                    or_(
                        ObservationInterpretation.test_name.ilike("%blood pressure%"),
                        ObservationInterpretation.test_name.ilike("%bp%"),
                        ObservationInterpretation.test_name.ilike("%systolic%"),
                    )
                )
            else:
                query = query.filter(
                    ObservationInterpretation.test_name.ilike(f"%{test_keyword}%")
                )

        results = query.order_by(desc(ObservationInterpretation.created_at)).all()
        # Strictly return results without broad substitution when a specific keyword is queried
        return results

    def retrieve_timeline(
        self,
        db: Session,
        user_id: uuid.UUID,
        document_id: Optional[uuid.UUID] = None,
        limit: int = 10,
    ) -> List[TimelineEvent]:
        """
        Retrieves recent healthcare timeline events for chronological context.
        """
        query = db.query(TimelineEvent).filter(TimelineEvent.user_id == user_id)
        if document_id:
            query = query.filter(TimelineEvent.source_document_id == document_id)

        return query.order_by(desc(TimelineEvent.event_date)).limit(limit).all()


copilot_retrieval_service = CopilotRetrievalService()
