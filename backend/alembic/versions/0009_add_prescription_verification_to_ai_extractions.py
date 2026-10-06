"""Add prescription verification and audit columns to ai_extractions table

Revision ID: 0009_add_prescription_verification_to_ai_extractions
Revises: 0008_create_copilot_chunks_and_chat_tables
Create Date: 2026-10-07 01:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0009_add_prescription_verification_to_ai_extractions"
down_revision: Union[str, None] = "0008_create_copilot_chunks_and_chat_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_extractions",
        sa.Column(
            "is_verified",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "ai_extractions",
        sa.Column(
            "verified_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.add_column(
        "ai_extractions",
        sa.Column(
            "verified_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "ai_extractions",
        sa.Column(
            "verification_audit",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.add_column(
        "ai_extractions",
        sa.Column(
            "extraction_type",
            sa.String(length=50),
            nullable=False,
            server_default="GENERAL_MEDICAL",
        ),
    )


def downgrade() -> None:
    op.drop_column("ai_extractions", "extraction_type")
    op.drop_column("ai_extractions", "verification_audit")
    op.drop_column("ai_extractions", "verified_by")
    op.drop_column("ai_extractions", "verified_at")
    op.drop_column("ai_extractions", "is_verified")
