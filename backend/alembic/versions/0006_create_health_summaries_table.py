"""Create health_summaries table

Revision ID: 0006_create_health_summaries_table
Revises: 0005_create_observation_interpretations_table
Create Date: 2026-10-06 17:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006_create_health_summaries_table"
down_revision: Union[str, None] = "0005_create_observation_interpretations_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "health_summaries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("language", sa.String(length=10), nullable=False, server_default="en"),
        sa.Column("summary", sa.JSON(), nullable=False),
        sa.Column("source_documents", sa.JSON(), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False, server_default="health-summary-engine-v1"),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0.95"),
        sa.Column(
            "generated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
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
        "ix_health_summaries_user_id",
        "health_summaries",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_health_summaries_generated_at",
        "health_summaries",
        ["generated_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_health_summaries_generated_at", table_name="health_summaries")
    op.drop_index("ix_health_summaries_user_id", table_name="health_summaries")
    op.drop_table("health_summaries")
