import uuid
from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import String, Float, Integer, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.document import Document


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

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
    raw_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cleaned_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ocr_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    page_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    language_detected: Mapped[str] = mapped_column(
        String(50), nullable=False, default="en"
    )
    processing_time: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    document: Mapped["Document"] = relationship("Document", back_populates="extraction")
