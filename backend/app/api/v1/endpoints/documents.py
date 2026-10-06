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
    UploadFile,
    status,
)
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.core.security import decode_access_token
from app.models.user import User
from app.models.document import Document
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentType,
    ProcessingStatus,
)
from app.services.storage_service import storage_service
from app.core.logging import logger

router = APIRouter()


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
    summary="Upload a medical document with security validation",
)
async def upload_document(
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
    summary="Retrieve metadata for a specific document",
)
def get_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.user_id == current_user.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )

    return _to_document_response(doc)


@router.get(
    "/{document_id}/file",
    summary="Preview or download an authenticated medical document",
)
def download_document_file(
    document_id: uuid.UUID,
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

    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.user_id == effective_user_id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )

    if not os.path.exists(doc.storage_path):
        logger.error(f"File missing on disk for document {doc.id} at {doc.storage_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file is unavailable in storage.",
        )

    return FileResponse(
        path=doc.storage_path,
        media_type=doc.mime_type,
        filename=doc.original_filename,
        content_disposition_type="inline",
    )


@router.delete(
    "/{document_id}",
    summary="Delete a medical document and purge its file",
)
def delete_document(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    doc = (
        db.query(Document)
        .filter(
            Document.id == document_id,
            Document.user_id == current_user.id,
        )
        .first()
    )

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found or access denied.",
        )

    # 1. Delete physical file from disk volume
    storage_service.delete_file(doc.storage_path)

    # 2. Delete database record
    db.delete(doc)
    db.commit()

    logger.info(f"Deleted document {document_id} by user {current_user.id}")

    return {
        "status": "success",
        "detail": "Document successfully deleted.",
        "id": str(document_id),
    }
