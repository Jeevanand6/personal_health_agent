import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON, func
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.guid import GUID

if TYPE_CHECKING:
    from app.models.user import User
    from app.models.document import Document


class ChatSession(Base):
    """
    Personal Health Copilot Chat Session Model.
    Tracks user conversation history, optional binding to a specific document,
    and timestamps for multi-turn clinical inquiry.
    """
    __tablename__ = "chat_sessions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(255), nullable=False, default="Health Consultation")
    document_id = Column(
        GUID(),
        ForeignKey("documents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="chat_sessions")
    document = relationship("Document")
    messages = relationship(
        "ChatMessage",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at.asc()",
    )

    def __repr__(self) -> str:
        return f"<ChatSession id={self.id} title={self.title[:30]} user={self.user_id}>"


class ChatMessage(Base):
    """
    Individual Chat Message in a Copilot Session.
    Stores role (user/assistant/system), text content, source references,
    and mandatory medical safety disclaimers.
    """
    __tablename__ = "chat_messages"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    session_id = Column(
        GUID(),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        GUID(),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role = Column(String(20), nullable=False)  # "user" | "assistant" | "system"
    content = Column(Text, nullable=False)
    sources_json = Column(JSON, nullable=True)  # List of source attribution dicts
    disclaimer = Column(Text, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    session = relationship("ChatSession", back_populates="messages")
    user = relationship("User")

    def __repr__(self) -> str:
        return f"<ChatMessage id={self.id} role={self.role} session={self.session_id}>"
