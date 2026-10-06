"""Create ai_extractions table

Revision ID: 0004_create_ai_extractions_table
Revises: 0003_create_document_extractions_table
Create Date: 2026-10-06 16:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0004_create_ai_extractions_table"
down_revision: Union[str, None] = "0003_create_document_extractions_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_extractions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            unique=True,
            nullable=False,
        ),
        sa.Column("raw_response", sa.Text(), nullable=False, server_default=""),
        sa.Column("structured_data", sa.JSON(), nullable=False),
        sa.Column(
            "model_name",
            sa.String(length=100),
            nullable=False,
            server_default="gemini-3.8-flash",
        ),
        sa.Column("confidence_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("processing_time", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_ai_extractions_document_id",
        "ai_extractions",
        ["document_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_ai_extractions_document_id", table_name="ai_extractions")
    op.drop_table("ai_extractions")
