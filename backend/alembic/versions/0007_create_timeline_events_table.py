"""Create timeline_events table

Revision ID: 0007_create_timeline_events_table
Revises: 0006_create_health_summaries_table
Create Date: 2026-10-06 18:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0007_create_timeline_events_table"
down_revision: Union[str, None] = "0006_create_health_summaries_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "timeline_events",
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
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("event_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "source_document_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_document_title", sa.String(length=255), nullable=False, server_default=""),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
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
        "ix_timeline_events_user_id",
        "timeline_events",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_timeline_events_event_type",
        "timeline_events",
        ["event_type"],
        unique=False,
    )
    op.create_index(
        "ix_timeline_events_event_date",
        "timeline_events",
        ["event_date"],
        unique=False,
    )
    op.create_index(
        "ix_timeline_events_source_document_id",
        "timeline_events",
        ["source_document_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_timeline_events_source_document_id", table_name="timeline_events")
    op.drop_index("ix_timeline_events_event_date", table_name="timeline_events")
    op.drop_index("ix_timeline_events_event_type", table_name="timeline_events")
    op.drop_index("ix_timeline_events_user_id", table_name="timeline_events")
    op.drop_table("timeline_events")
