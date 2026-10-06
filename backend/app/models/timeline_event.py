import uuid
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional, TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.orm import relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.document import Document


class GUID(TypeDecorator):
    """Platform-independent GUID type."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(str(value)))
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(str(value))
        return value


class TimelineEventType(str, Enum):
    DOCUMENT = "DOCUMENT"
    DIAGNOSIS = "DIAGNOSIS"
    MEDICATION = "MEDICATION"
    LAB_RESULT = "LAB_RESULT"
    DIAGNOSTIC_REPORT = "DIAGNOSTIC_REPORT"
    DISCHARGE = "DISCHARGE"
    ENCOUNTER = "ENCOUNTER"


class TimelineEvent(Base):
    """
    Unified Healthcare Timeline Event Model.
    Grounded strictly in verified medical database records.
    Every event MUST have a valid source document.
    """
    __tablename__ = "timeline_events"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(50), nullable=False, index=True)
    event_date = Column(DateTime(timezone=True), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False, default="")
    source_document_id = Column(GUID(), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    source_document_title = Column(String(255), nullable=False, default="")
    metadata_json = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="timeline_events")
    document = relationship("Document", back_populates="timeline_events")

    def __repr__(self) -> str:
        return f"<TimelineEvent type={self.event_type} date={self.event_date} title={self.title[:30]}>"
