import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, BigInteger, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.extraction import DocumentExtraction
    from app.models.ai_extraction import AIExtraction
    from app.models.observation_interpretation import ObservationInterpretation
    from app.models.timeline_event import TimelineEvent


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    document_type: Mapped[str] = mapped_column(
        String(50), default="UNKNOWN", nullable=False
    )
    processing_status: Mapped[str] = mapped_column(
        String(50), default="UPLOADED", nullable=False
    )
    upload_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
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

    user: Mapped["User"] = relationship("User", back_populates="documents")
    extraction: Mapped[Optional["DocumentExtraction"]] = relationship(
        "DocumentExtraction",
        back_populates="document",
        uselist=False,
        cascade="all, delete-orphan",
    )
    ai_extraction: Mapped[Optional["AIExtraction"]] = relationship(
        "AIExtraction",
        back_populates="document",
        uselist=False,
        cascade="all, delete-orphan",
    )
    interpretations: Mapped[list["ObservationInterpretation"]] = relationship(
        "ObservationInterpretation",
        back_populates="document",
        cascade="all, delete-orphan",
    )
    timeline_events: Mapped[list["TimelineEvent"]] = relationship(
        "TimelineEvent",
        back_populates="document",
        cascade="all, delete-orphan",
    )
