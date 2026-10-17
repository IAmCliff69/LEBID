"""add auth_events table

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
Create Date: 2026-10-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d0e1f2a3b4c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "auth_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_auth_events_email_type_created",
        "auth_events",
        ["email", "event_type", "created_at"],
    )
    op.create_index(
        "ix_auth_events_ip_type_created",
        "auth_events",
        ["ip_address", "event_type", "created_at"],
    )
    op.create_index(
        "ix_auth_events_user_type_created",
        "auth_events",
        ["user_id", "event_type", "created_at"],
    )
    op.create_index("ix_auth_events_created_at", "auth_events", ["created_at"])


def downgrade() -> None:
    op.drop_table("auth_events")