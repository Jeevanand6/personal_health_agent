import uuid
from datetime import datetime
from typing import Any, Dict, TYPE_CHECKING
from sqlalchemy import String, Float, DateTime, ForeignKey, func, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.document import Document


class AIExtraction(Base):
    __tablename__ = "ai_extractions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    raw_response: Mapped[str] = mapped_column(Text, nullable=False, default="")
    structured_data: Mapped[Dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    model_name: Mapped[str] = mapped_column(
        String(100), nullable=False, default="gemini-3.8-flash"
    )
    confidence_score: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    processing_time: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    document: Mapped["Document"] = relationship("Document", back_populates="ai_extraction")
