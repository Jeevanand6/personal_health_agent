import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.guid import GUID

if TYPE_CHECKING:
    from app.models.document import Document
    from app.models.user import User


class DocumentChunk(Base):
    """
    Document Chunk Model for Semantic Vector Retrieval and Grounded RAG.
    Each chunk retains strict user_id multi-tenant isolation, document_id,
    page_number, and embedding vector.
    """
    __tablename__ = "document_chunks"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    document_id = Column(
        GUID(),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index = Column(Integer, nullable=False, default=0)
    content = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    embedding = Column(JSON, nullable=True)  # Vector as float list for multi-engine compatibility
    metadata_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    document = relationship("Document", back_populates="chunks")
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<DocumentChunk id={self.id} doc={self.document_id} idx={self.chunk_index}>"
