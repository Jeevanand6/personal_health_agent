"""Create document extractions table

Revision ID: 0003_create_document_extractions_table
Revises: 0002_create_documents_table
Create Date: 2026-10-06 15:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0003_create_document_extractions_table"
down_revision: Union[str, None] = "0002_create_documents_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "document_extractions",
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
        sa.Column("raw_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("cleaned_text", sa.Text(), nullable=False, server_default=""),
        sa.Column("ocr_confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("page_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("language_detected", sa.String(length=50), nullable=False, server_default="en"),
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
        "ix_document_extractions_document_id",
        "document_extractions",
        ["document_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_document_extractions_document_id",
        table_name="document_extractions",
    )
    op.drop_table("document_extractions")
