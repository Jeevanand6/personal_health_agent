import uuid
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.base import Base


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.document import Document
    from app.models.observation_interpretation import ObservationInterpretation
    from app.models.health_summary import HealthSummary
    from app.models.timeline_event import TimelineEvent
    from app.models.chat_session import ChatSession


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="patient", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    patients: Mapped[list["Patient"]] = relationship(
        "Patient", back_populates="user", cascade="all, delete-orphan"
    )

    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="user", cascade="all, delete-orphan"
    )

    interpretations: Mapped[list["ObservationInterpretation"]] = relationship(
        "ObservationInterpretation", back_populates="user", cascade="all, delete-orphan"
    )

    summaries: Mapped[list["HealthSummary"]] = relationship(
        "HealthSummary", back_populates="user", cascade="all, delete-orphan"
    )

    timeline_events: Mapped[list["TimelineEvent"]] = relationship(
        "TimelineEvent", back_populates="user", cascade="all, delete-orphan"
    )

    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        "ChatSession", back_populates="user", cascade="all, delete-orphan"
    )

