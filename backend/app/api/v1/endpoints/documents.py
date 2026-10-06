import os
import uuid
from typing import List, Optional
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, verify_document_ownership
from app.core.security import decode_access_token
from app.core.rate_limit import get_client_ip
from app.models.user import User
from app.models.document import Document
from app.models.extraction import DocumentExtraction
from app.models.ai_extraction import AIExtraction
from app.models.observation_interpretation import ObservationInterpretation
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentType,
    ProcessingStatus,
)
from app.schemas.extraction import DocumentExtractionResponse, OCRTriggerResponse
from app.schemas.ai_extraction import (
    AIExtractionResponse,
    AIExtractTriggerResponse,
    StructuredMedicalData,
)
from app.schemas.observation_interpretation import (
    ObservationInterpretationItem,
    ObservationInterpretationListResponse,
    InterpretTriggerResponse,
)
from app.services.storage_service import storage_service
from app.services.ocr_service import ocr_service
from app.services.ai_extraction_service import ai_extraction_service
from app.services.lab_interpretation_engine import lab_interpretation_engine
from app.services.audit_service import audit_service, AuditEventType
from app.schemas.copilot import DocumentIndexResponse
from app.services.copilot_retrieval import copilot_retrieval_service
from app.core.logging import logger

router = APIRouter()


def _to_ai_extraction_response(ai_ext: AIExtraction) -> AIExtractionResponse:
    structured = (
        StructuredMedicalData.model_validate(ai_ext.structured_data)
        if isinstance(ai_ext.structured_data, dict)
        else StructuredMedicalData()
    )
    return AIExtractionResponse(
        id=ai_ext.id,
        document_id=ai_ext.document_id,
        model_name=ai_ext.model_name,
        confidence_score=ai_ext.confidence_score,
        processing_time=ai_ext.processing_time,
        structured_data=structured,
        raw_response=ai_ext.raw_response,
        created_at=ai_ext.created_at,
        updated_at=ai_ext.updated_at,
    )


def _to_extraction_response(
    ext: DocumentExtraction, ai_ext: Optional[AIExtraction] = None
) -> DocumentExtractionResponse:
    ai_resp = _to_ai_extraction_response(ai_ext) if ai_ext else None
    return DocumentExtractionResponse(
        id=ext.id,
        document_id=ext.document_id,
        raw_text=ext.raw_text,
        cleaned_text=ext.cleaned_text,
        ocr_confidence=ext.ocr_confidence,
        page_count=ext.page_count,
        language_detected=ext.language_detected,
        processing_time=ext.processing_time,
        ai_extraction=ai_resp,
        created_at=ext.created_at,
        updated_at=ext.updated_at,
    )


def _to_document_response(doc: Document) -> DocumentResponse:
    return DocumentResponse(
        id=doc.id,
        original_filename=doc.original_filename,
        mime_type=doc.mime_type,
        file_size=doc.file_size,
        document_type=doc.document_type,
        processing_status=doc.processing_status,
        upload_date=doc.upload_date,
        created_at=doc.created_at,
        file_url=f"/api/documents/{doc.id}/file",
    )


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a medical document with security validation and audit logging",
)
async def upload_document(
    request: Request,
    file: UploadFile = File(..., description="PDF, JPG, JPEG, or PNG file"),
    document_type: str = Form(
        default="UNKNOWN",
        description="PRESCRIPTION, LAB_REPORT, DIAGNOSTIC_REPORT, DISCHARGE_SUMMARY, OTHER, UNKNOWN",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Validate requested document type enum
    normalized_doc_type = document_type.upper().strip()
    if normalized_doc_type not in DocumentType.__members__:
        normalized_doc_type = DocumentType.UNKNOWN.value

    # Validate and save file securely
    file_info = await storage_service.save_uploaded_file(file, current_user.id)

    # Insert document record in database
    new_doc = Document(
        id=file_info["id"],
        user_id=current_user.id,
        filename=file_info["filename"],
        original_filename=file_info["original_filename"],
        mime_type=file_info["mime_type"],
        file_size=file_info["file_size"],
        storage_path=file_info["storage_path"],
        document_type=normalized_doc_type,
        processing_status=ProcessingStatus.UPLOADED.value,
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Record DOCUMENT_UPLOAD audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_UPLOAD,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(new_doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={
            "original_filename": new_doc.original_filename,
            "mime_type": new_doc.mime_type,
            "file_size": new_doc.file_size,
            "document_type": new_doc.document_type,
        },
    )

    logger.info(
        f"Document uploaded: {new_doc.id} ({new_doc.original_filename}) for user {current_user.id}"
    )

    return _to_document_response(new_doc)


@router.get(
    "",
    response_model=DocumentListResponse,
    summary="List all documents for the authenticated user",
)
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    docs = (
        db.query(Document)
        .filter(Document.user_id == current_user.id)
        .order_by(Document.upload_date.desc())
        .all()
    )

    items = [_to_document_response(d) for d in docs]
    return DocumentListResponse(documents=items, total=len(items))


@router.get(
    "/{document_id}",
    response_model=DocumentResponse,
    summary="Retrieve metadata for a specific document with ownership check",
)
def get_document(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    # Record DOCUMENT_VIEW audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_VIEW,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={"view_type": "metadata"},
    )

    return _to_document_response(doc)


@router.get(
    "/{document_id}/file",
    summary="Preview or download an authenticated medical document",
)
def download_document_file(
    document_id: uuid.UUID,
    request: Request,
    token: Optional[str] = Query(None, description="Auth token for inline browser preview"),
    current_user: Optional[User] = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Resolve user from header or query token (supporting iframe/img preview)
    effective_user_id = None
    if current_user:
        effective_user_id = current_user.id
    elif token:
        payload = decode_access_token(token)
        if payload and payload.get("sub"):
            try:
                effective_user_id = uuid.UUID(payload.get("sub"))
            except ValueError:
                pass

    if not effective_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to preview this document.",
        )

    # Enforce multi-tenant document ownership
    doc = verify_document_ownership(db, document_id, effective_user_id)

    if not storage_service.validate_stored_file(doc.storage_path):
        logger.error(f"File missing or unsafe on disk for document {doc.id} at {doc.storage_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file is unavailable in storage.",
        )

    # Record DOCUMENT_VIEW audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_VIEW,
        status="SUCCESS",
        user_id=effective_user_id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={"view_type": "file_content", "mime_type": doc.mime_type},
    )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type,
        filename=doc.original_filename,
        content_disposition_type="inline",
    )


@router.delete(
    "/{document_id}",
    summary="Delete a medical document and purge its file with ownership check",
)
def delete_document(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    # 1. Delete physical file from disk volume
    storage_service.delete_file(doc.storage_path)

    # 2. Delete database record
    db.delete(doc)
    db.commit()

    # Record DOCUMENT_DELETE audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_DELETE,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(document_id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={"original_filename": doc.original_filename},
    )

    logger.info(f"Deleted document {document_id} by user {current_user.id}")

    return {
        "status": "success",
        "detail": "Document successfully deleted.",
        "id": str(document_id),
    }


@router.post(
    "/{document_id}/ocr",
    response_model=OCRTriggerResponse,
    summary="Trigger PaddleOCR extraction pipeline for a medical document",
)
async def run_document_ocr(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    # Set status to PROCESSING
    doc.processing_status = ProcessingStatus.PROCESSING.value
    db.commit()
    db.refresh(doc)

    logger.info(
        f"Starting OCR extraction for document {doc.id} ({doc.original_filename})"
    )

    # Run OCR processing pipeline
    result = await ocr_service.process_document(doc.storage_path, doc.mime_type)

    # Update document status based on OCR result
    doc_status = result.get("status", ProcessingStatus.FAILED.value)
    doc.processing_status = doc_status

    extraction_record = None
    if result.get("success"):
        # Upsert extraction record
        existing_ext = (
            db.query(DocumentExtraction)
            .filter(DocumentExtraction.document_id == doc.id)
            .first()
        )
        if existing_ext:
            existing_ext.raw_text = result["raw_text"]
            existing_ext.cleaned_text = result["cleaned_text"]
            existing_ext.ocr_confidence = result["ocr_confidence"]
            existing_ext.page_count = result["page_count"]
            existing_ext.language_detected = result["language_detected"]
            existing_ext.processing_time = result["processing_time"]
            extraction_record = existing_ext
        else:
            new_ext = DocumentExtraction(
                document_id=doc.id,
                raw_text=result["raw_text"],
                cleaned_text=result["cleaned_text"],
                ocr_confidence=result["ocr_confidence"],
                page_count=result["page_count"],
                language_detected=result["language_detected"],
                processing_time=result["processing_time"],
            )
            db.add(new_ext)
            extraction_record = new_ext

    db.commit()
    db.refresh(doc)
    if extraction_record:
        db.refresh(extraction_record)

    # Record AI_PROCESSING audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.AI_PROCESSING,
        status="SUCCESS" if result.get("success") else "FAILURE",
        user_id=current_user.id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={
            "pipeline": "ocr_extraction",
            "status": doc.processing_status,
            "ocr_confidence": result.get("ocr_confidence", 0.0),
            "page_count": result.get("page_count", 1),
        },
    )

    logger.info(
        f"OCR finished for {doc.id}: status={doc.processing_status}, "
        f"confidence={result.get('ocr_confidence', 0.0)}, lang={result.get('language_detected')}"
    )

    return OCRTriggerResponse(
        document_id=doc.id,
        processing_status=doc.processing_status,
        ocr_confidence=result.get("ocr_confidence", 0.0),
        language_detected=result.get("language_detected", "en"),
        page_count=result.get("page_count", 1),
        message=result.get("error") or "OCR text extraction completed successfully.",
        extraction=_to_extraction_response(extraction_record)
        if extraction_record
        else None,
    )


@router.get(
    "/{document_id}/extraction",
    response_model=DocumentExtractionResponse,
    summary="Retrieve OCR extraction data for a specific document with ownership check",
)
def get_document_extraction(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    extraction = (
        db.query(DocumentExtraction)
        .filter(DocumentExtraction.document_id == document_id)
        .first()
    )

    if not extraction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No OCR extraction available for this document. Please trigger OCR processing first.",
        )

    ai_ext = (
        db.query(AIExtraction)
        .filter(AIExtraction.document_id == document_id)
        .first()
    )

    # Record DOCUMENT_VIEW audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_VIEW,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={"view_type": "ocr_extraction"},
    )

    return _to_extraction_response(extraction, ai_ext)


@router.post(
    "/{document_id}/extract",
    response_model=AIExtractTriggerResponse,
    summary="Extract structured medical information using AI pipeline with ownership check",
)
async def extract_structured_document_info(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    # 1. If OCR has not been performed yet, run OCR pipeline first
    extraction = (
        db.query(DocumentExtraction)
        .filter(DocumentExtraction.document_id == document_id)
        .first()
    )

    if not extraction or not extraction.cleaned_text.strip():
        logger.info(
            f"Document {doc.id} requires OCR before AI extraction. Running OCR..."
        )
        ocr_result = await ocr_service.process_document(
            doc.storage_path, doc.mime_type
        )
        if not ocr_result.get("success") or not ocr_result.get("cleaned_text"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=ocr_result.get("error")
                or "Cannot extract structured AI information because document OCR was illegible.",
            )

        # Save or update OCR extraction
        if extraction:
            extraction.raw_text = ocr_result["raw_text"]
            extraction.cleaned_text = ocr_result["cleaned_text"]
            extraction.ocr_confidence = ocr_result["ocr_confidence"]
            extraction.page_count = ocr_result["page_count"]
            extraction.language_detected = ocr_result["language_detected"]
            extraction.processing_time = ocr_result["processing_time"]
        else:
            extraction = DocumentExtraction(
                document_id=doc.id,
                raw_text=ocr_result["raw_text"],
                cleaned_text=ocr_result["cleaned_text"],
                ocr_confidence=ocr_result["ocr_confidence"],
                page_count=ocr_result["page_count"],
                language_detected=ocr_result["language_detected"],
                processing_time=ocr_result["processing_time"],
            )
            db.add(extraction)
        doc.processing_status = ocr_result["status"]
        db.commit()
        db.refresh(extraction)

    ocr_text = extraction.cleaned_text or extraction.raw_text

    # 2. Run structured AI extraction
    ai_result = await ai_extraction_service.extract_structured_data(ocr_text)

    if not ai_result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=ai_result.get("error")
            or "AI structured information extraction failed.",
        )

    # 3. Upsert ai_extractions record
    existing_ai = (
        db.query(AIExtraction)
        .filter(AIExtraction.document_id == doc.id)
        .first()
    )

    if existing_ai:
        existing_ai.raw_response = ai_result["raw_response"]
        existing_ai.structured_data = ai_result["structured_data"]
        existing_ai.model_name = ai_result["model_name"]
        existing_ai.confidence_score = ai_result["confidence_score"]
        existing_ai.processing_time = ai_result["processing_time"]
        ai_record = existing_ai
    else:
        ai_record = AIExtraction(
            document_id=doc.id,
            raw_response=ai_result["raw_response"],
            structured_data=ai_result["structured_data"],
            model_name=ai_result["model_name"],
            confidence_score=ai_result["confidence_score"],
            processing_time=ai_result["processing_time"],
        )
        db.add(ai_record)

    db.commit()
    db.refresh(ai_record)

    # Record AI_PROCESSING audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.AI_PROCESSING,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={
            "pipeline": "ai_structured_extraction",
            "model": ai_record.model_name,
            "confidence_score": ai_record.confidence_score,
        },
    )

    logger.info(
        f"AI Structured extraction completed for {doc.id} via {ai_record.model_name} "
        f"(confidence: {ai_record.confidence_score})"
    )

    return AIExtractTriggerResponse(
        document_id=doc.id,
        status="COMPLETED",
        message="Structured medical information extracted successfully.",
        extraction=_to_ai_extraction_response(ai_record),
    )


@router.get(
    "/{document_id}/ai-extraction",
    response_model=AIExtractionResponse,
    summary="Retrieve AI structured medical extraction for a document with ownership check",
)
def get_document_ai_extraction(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    ai_ext = (
        db.query(AIExtraction)
        .filter(AIExtraction.document_id == document_id)
        .first()
    )

    if not ai_ext:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI structured extraction has not been performed on this document yet.",
        )

    # Record DOCUMENT_VIEW audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_VIEW,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={"view_type": "ai_extraction"},
    )

    return _to_ai_extraction_response(ai_ext)


@router.post(
    "/{document_id}/interpret",
    response_model=InterpretTriggerResponse,
    summary="Safely interpret laboratory observations from a medical document with ownership check",
)
async def interpret_document_laboratory_results(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    ai_ext = (
        db.query(AIExtraction)
        .filter(AIExtraction.document_id == document_id)
        .first()
    )

    # If AI extraction hasn't been performed yet, trigger it
    if not ai_ext:
        logger.info(f"Document {doc.id} requires AI extraction before interpretation. Triggering...")
        await extract_structured_document_info(document_id, request, current_user, db)
        ai_ext = (
            db.query(AIExtraction)
            .filter(AIExtraction.document_id == document_id)
            .first()
        )

    if not ai_ext or not isinstance(ai_ext.structured_data, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract structured data to interpret laboratory observations.",
        )

    structured_dict = ai_ext.structured_data
    observations = structured_dict.get("observations", [])

    patient_context = {
        "patient_gender": structured_dict.get("patient_gender"),
        "patient_age": structured_dict.get("patient_age"),
    }

    interpreted_items: List[ObservationInterpretation] = []

    for idx, obs in enumerate(observations):
        obs_dict = dict(obs) if isinstance(obs, dict) else obs.model_dump()
        if not obs_dict.get("observation_id"):
            obs_dict["observation_id"] = f"{document_id}_{idx}"

        interp_data = lab_interpretation_engine.interpret_observation(
            observation=obs_dict,
            patient_context=patient_context,
        )

        test_name = interp_data["test_name"]
        obs_id_str = interp_data["observation_id"]

        # Check existing interpretation for this document and observation
        existing_interp = (
            db.query(ObservationInterpretation)
            .filter(
                ObservationInterpretation.document_id == doc.id,
                ObservationInterpretation.observation_id == obs_id_str,
            )
            .first()
        )

        if not existing_interp:
            existing_interp = (
                db.query(ObservationInterpretation)
                .filter(
                    ObservationInterpretation.document_id == doc.id,
                    ObservationInterpretation.test_name == test_name,
                )
                .first()
            )

        if existing_interp:
            existing_interp.value = interp_data["value"]
            existing_interp.numeric_value = interp_data["numeric_value"]
            existing_interp.unit = interp_data["unit"]
            existing_interp.reference_range = interp_data["reference_range"]
            existing_interp.status = interp_data["status"]
            existing_interp.severity = interp_data["severity"]
            existing_interp.explanation = interp_data["explanation"]
            existing_interp.confidence = interp_data["confidence"]
            existing_interp.source = interp_data["source"]
            interpreted_items.append(existing_interp)
        else:
            new_interp = ObservationInterpretation(
                observation_id=obs_id_str,
                document_id=doc.id,
                user_id=current_user.id,
                test_name=test_name,
                value=interp_data["value"],
                numeric_value=interp_data["numeric_value"],
                unit=interp_data["unit"],
                reference_range=interp_data["reference_range"],
                status=interp_data["status"],
                severity=interp_data["severity"],
                explanation=interp_data["explanation"],
                confidence=interp_data["confidence"],
                source=interp_data["source"],
            )
            db.add(new_interp)
            interpreted_items.append(new_interp)

    db.commit()
    for item in interpreted_items:
        db.refresh(item)

    response_items = [
        ObservationInterpretationItem.model_validate(item) for item in interpreted_items
    ]

    # Record AI_PROCESSING audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.AI_PROCESSING,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={
            "pipeline": "lab_interpretation",
            "count": len(response_items),
        },
    )

    logger.info(
        f"Interpreted {len(interpreted_items)} laboratory observations for document {doc.id}"
    )

    return InterpretTriggerResponse(
        document_id=doc.id,
        status="COMPLETED",
        message=f"Successfully interpreted {len(response_items)} laboratory observations.",
        total_interpreted=len(response_items),
        interpretations=response_items,
    )


@router.get(
    "/{document_id}/interpretations",
    response_model=ObservationInterpretationListResponse,
    summary="Retrieve all safe laboratory interpretations for a document with ownership check",
)
def get_document_laboratory_interpretations(
    document_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)

    records = (
        db.query(ObservationInterpretation)
        .filter(ObservationInterpretation.document_id == document_id)
        .order_by(ObservationInterpretation.created_at.asc())
        .all()
    )

    summary = {
        "LOW": sum(1 for r in records if r.status == "LOW"),
        "NORMAL": sum(1 for r in records if r.status == "NORMAL"),
        "HIGH": sum(1 for r in records if r.status == "HIGH"),
        "UNKNOWN": sum(1 for r in records if r.status == "UNKNOWN"),
        "URGENT_REVIEW": sum(1 for r in records if r.severity == "URGENT_REVIEW"),
        "REVIEW_RECOMMENDED": sum(1 for r in records if r.severity == "REVIEW_RECOMMENDED"),
    }

    items = [ObservationInterpretationItem.model_validate(r) for r in records]

    # Record DOCUMENT_VIEW audit event
    audit_service.log_event(
        db=db,
        event_type=AuditEventType.DOCUMENT_VIEW,
        status="SUCCESS",
        user_id=current_user.id,
        resource_id=str(doc.id),
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        details={"view_type": "laboratory_interpretations", "count": len(items)},
    )

    return ObservationInterpretationListResponse(
        document_id=doc.id,
        total=len(items),
        summary=summary,
        interpretations=items,
    )


@router.post(
    "/{document_id}/index",
    response_model=DocumentIndexResponse,
    summary="Index an authorized document's OCR text into vector chunks for semantic retrieval",
)
async def index_document_chunks(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = verify_document_ownership(db, document_id, current_user.id)
    count = await copilot_retrieval_service.index_document_chunks(
        db=db, document_id=doc.id, user_id=current_user.id
    )
    return DocumentIndexResponse(
        document_id=doc.id,
        chunk_count=count,
        message=f"Indexed {count} vector chunk(s) for document {doc.id}.",
    )
