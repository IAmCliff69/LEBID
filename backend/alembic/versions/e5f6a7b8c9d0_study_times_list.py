"""study preferences: one study time becomes a list of study times

Revision ID: e5f6a7b8c9d0
Revises: e320594b12ac
Create Date: 2026-10-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "e320594b12ac"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "study_preferences",
        sa.Column("study_times", postgresql.ARRAY(sa.String(length=20)), nullable=True),
    )
    # Keep what students already saved: "evening" becomes ["evening"]
    op.execute("UPDATE study_preferences SET study_times = ARRAY[study_time]")
    op.alter_column("study_preferences", "study_times", nullable=False)
    op.drop_column("study_preferences", "study_time")


def downgrade() -> None:
    op.add_column(
        "study_preferences",
        sa.Column("study_time", sa.String(length=20), nullable=True),
    )
    # Keep the first chosen time
    op.execute("UPDATE study_preferences SET study_time = study_times[1]")
    op.alter_column("study_preferences", "study_time", nullable=False)
    op.drop_column("study_preferences", "study_times")