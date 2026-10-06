import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class SourceReference(BaseModel):
    """Source attribution referencing verified medical records."""
    document_id: Optional[str] = None
    document_name: str
    page: Optional[int] = None
    relevance: float = 1.0
    snippet: Optional[str] = None
    source_type: str = "document_chunk"  # "document_chunk" | "observation" | "medication" | "timeline"

    model_config = {"from_attributes": True}


class CopilotChatRequest(BaseModel):
    """User inquiry to the Personal Health Copilot."""
    message: str = Field(..., min_length=1, max_length=4000, description="User question")
    document_id: Optional[uuid.UUID] = Field(
        None, description="Optional document UUID for document-specific mode"
    )
    session_id: Optional[uuid.UUID] = Field(
        None, description="Optional chat session UUID for conversation continuity"
    )
    language: str = Field(
        default="en", description="Preferred output language ('en' for English, 'ta' for Tamil)"
    )


class CopilotChatResponse(BaseModel):
    """Structured response from the Personal Health Copilot."""
    answer: str
    sources: List[SourceReference] = Field(default_factory=list)
    language: str = "en"
    disclaimer: str
    session_id: uuid.UUID
    message_id: uuid.UUID
    confidence: float = 1.0
    mode: str = "general"  # "general" | "personal_health" | "mixed_health" | "current_web" | "document_specific"

    model_config = {"from_attributes": True}


class ChatMessageItem(BaseModel):
    """Individual chat message item."""
    id: uuid.UUID
    role: str
    content: str
    sources: List[SourceReference] = Field(default_factory=list)
    disclaimer: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionSummary(BaseModel):
    """Summary of a copilot conversation session."""
    id: uuid.UUID
    title: str
    document_id: Optional[uuid.UUID] = None
    document_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0

    model_config = {"from_attributes": True}


class ChatSessionDetail(BaseModel):
    """Full detail of a chat session including message history."""
    id: uuid.UUID
    title: str
    document_id: Optional[uuid.UUID] = None
    document_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    messages: List[ChatMessageItem] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class DocumentIndexResponse(BaseModel):
    """Response after indexing document chunks for vector search."""
    document_id: uuid.UUID
    chunk_count: int
    message: str
