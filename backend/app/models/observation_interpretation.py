import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.orm import relationship

from app.db.base import Base


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
                return str(uuid.UUID(value))
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(value)
        return value


class ObservationStatus(str):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    UNKNOWN = "UNKNOWN"


class InterpretationSeverity(str):
    NORMAL = "NORMAL"
    INFORMATIONAL = "INFORMATIONAL"
    REVIEW_RECOMMENDED = "REVIEW_RECOMMENDED"
    URGENT_REVIEW = "URGENT_REVIEW"


class ObservationInterpretation(Base):
    """
    Safe Laboratory Observation Interpretation Model.
    Stores objective, non-diagnostic clinical range interpretations,
    severity evaluations, and verified reference sources.
    """
    __tablename__ = "observation_interpretations"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    observation_id = Column(String(100), nullable=False, index=True)
    document_id = Column(GUID(), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    test_name = Column(String(255), nullable=False, index=True)
    value = Column(String(100), nullable=False)
    numeric_value = Column(Float, nullable=True)
    unit = Column(String(50), nullable=True)
    reference_range = Column(String(100), nullable=True)

    status = Column(String(20), nullable=False, default=ObservationStatus.UNKNOWN)
    severity = Column(String(30), nullable=False, default=InterpretationSeverity.INFORMATIONAL)
    explanation = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False, default=0.0)
    source = Column(String(255), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    document = relationship("Document", back_populates="interpretations")
    user = relationship("User", back_populates="interpretations")

    def __repr__(self) -> str:
        return f"<ObservationInterpretation {self.test_name}: {self.status} ({self.severity})>"
