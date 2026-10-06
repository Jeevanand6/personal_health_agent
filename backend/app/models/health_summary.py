import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text, JSON
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


class HealthSummary(Base):
    """
    AI-Powered Personal Health Summary Model.
    Grounded exclusively in verified structured medical records from the database.
    Contains traceable statements and source document references.
    """
    __tablename__ = "health_summaries"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    language = Column(String(10), nullable=False, default="en")
    summary = Column(JSON, nullable=False)
    source_documents = Column(JSON, nullable=False, default=list)

    model = Column(String(100), nullable=False, default="health-summary-engine-v1")
    confidence = Column(Float, nullable=False, default=0.95)
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    user = relationship("User", back_populates="summaries")

    def __repr__(self) -> str:
        return f"<HealthSummary user={self.user_id} lang={self.language} at={self.generated_at}>"
