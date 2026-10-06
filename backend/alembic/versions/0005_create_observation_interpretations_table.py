"""Create observation_interpretations table

Revision ID: 0005_create_observation_interpretations_table
Revises: 0004_create_ai_extractions_table
Create Date: 2026-10-06 16:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0005_create_observation_interpretations_table"
down_revision: Union[str, None] = "0004_create_ai_extractions_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "observation_interpretations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "observation_id",
            sa.String(length=100),
            nullable=False,
        ),
        sa.Column(
            "document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("test_name", sa.String(length=255), nullable=False),
        sa.Column("value", sa.String(length=100), nullable=False),
        sa.Column("numeric_value", sa.Float(), nullable=True),
        sa.Column("unit", sa.String(length=50), nullable=True),
        sa.Column("reference_range", sa.String(length=100), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="UNKNOWN"),
        sa.Column("severity", sa.String(length=30), nullable=False, server_default="INFORMATIONAL"),
        sa.Column("explanation", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("source", sa.String(length=255), nullable=False),
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
        "ix_observation_interpretations_document_id",
        "observation_interpretations",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        "ix_observation_interpretations_user_id",
        "observation_interpretations",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_observation_interpretations_test_name",
        "observation_interpretations",
        ["test_name"],
        unique=False,
    )
    op.create_index(
        "ix_observation_interpretations_observation_id",
        "observation_interpretations",
        ["observation_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_observation_interpretations_observation_id", table_name="observation_interpretations")
    op.drop_index("ix_observation_interpretations_test_name", table_name="observation_interpretations")
    op.drop_index("ix_observation_interpretations_user_id", table_name="observation_interpretations")
    op.drop_index("ix_observation_interpretations_document_id", table_name="observation_interpretations")
    op.drop_table("observation_interpretations")
