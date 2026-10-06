import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, verify_document_ownership
from app.models.user import User
from app.schemas.copilot import (
    CopilotChatRequest,
    CopilotChatResponse,
    ChatSessionSummary,
    ChatSessionDetail,
    DocumentIndexResponse,
)
from app.services.copilot_service import copilot_service
from app.services.copilot_retrieval import copilot_retrieval_service
from app.core.logging import logger

router = APIRouter()


@router.post(
    "/chat",
    response_model=CopilotChatResponse,
    summary="Consult the Personal Health Copilot (Mode A: Document-Specific or Mode B: Health Records)",
)
async def chat_with_copilot(
    payload: CopilotChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Submits a user query to the Personal Health Copilot.
    - If document_id is specified: restricts grounded retrieval strictly to that authorized document.
    - If document_id is omitted: searches across user's authorized health records.
    - Supports Tamil ('ta') and English ('en').
    """
    try:
        response = await copilot_service.chat(
            db=db,
            current_user=current_user,
            payload=payload,
        )
        return response
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error processing Copilot consultation: {exc}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while generating a response from the Health Copilot. Please try again.",
        )


@router.get(
    "/sessions",
    response_model=List[ChatSessionSummary],
    summary="List all consultation sessions for the authenticated user",
)
def list_chat_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns a list of conversation sessions belonging to the authenticated user.
    """
    return copilot_service.list_sessions(db=db, user_id=current_user.id)


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionDetail,
    summary="Get full conversation history for a specific session",
)
def get_chat_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Retrieves full details and message history for an authorized conversation session.
    """
    session = copilot_service.get_session(db=db, session_id=session_id, user_id=current_user.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation session not found or unauthorized.",
        )
    return session


@router.delete(
    "/sessions/{session_id}",
    summary="Delete a consultation session and its messages",
)
def delete_chat_session(
    session_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Deletes a conversation session belonging to the authenticated user.
    """
    success = copilot_service.delete_session(db=db, session_id=session_id, user_id=current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consultation session not found or unauthorized.",
        )
    return {"status": "success", "message": "Session deleted successfully."}


@router.post(
    "/index/{document_id}",
    response_model=DocumentIndexResponse,
    summary="Index an authorized document's OCR text into vector chunks for semantic retrieval",
)
async def index_document_vector_chunks(
    document_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Chunks and embeds the OCR text of an authorized document for semantic vector search.
    """
    # Enforce multi-tenant ownership check (raises 404 if unauthorized)
    verify_document_ownership(db, document_id, current_user.id)

    count = await copilot_retrieval_service.index_document_chunks(
        db=db, document_id=document_id, user_id=current_user.id
    )

    return DocumentIndexResponse(
        document_id=document_id,
        chunk_count=count,
        message=f"Indexed {count} vector chunk(s) for document {document_id}.",
    )
