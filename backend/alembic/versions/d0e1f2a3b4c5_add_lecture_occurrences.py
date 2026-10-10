"""add lecture_occurrences table

Revision ID: d0e1f2a3b4c5
Revises: c9d0e1f2a3b4
Create Date: 2026-10-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "d0e1f2a3b4c5"
down_revision: Union[str, None] = "c9d0e1f2a3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lecture_occurrences",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("timetable_entry_id", sa.String(length=36), nullable=True),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("course_code", sa.String(length=100), nullable=True),
        sa.Column("course_name", sa.String(length=255), nullable=False),
        sa.Column("course_color", sa.String(length=20), nullable=True),
        sa.Column("class_type", sa.String(length=50), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("venue", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["timetable_entry_id"], ["timetable_entries.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "timetable_entry_id",
            "occurrence_date",
            name="uq_lecture_occurrence_entry_date",
        ),
    )
    op.create_index(
        "ix_lecture_occurrences_user_id", "lecture_occurrences", ["user_id"]
    )
    op.create_index(
        "ix_lecture_occurrences_timetable_entry_id",
        "lecture_occurrences",
        ["timetable_entry_id"],
    )
    op.create_index(
        "ix_lecture_occurrences_occurrence_date",
        "lecture_occurrences",
        ["occurrence_date"],
    )


def downgrade() -> None:
    op.drop_table("lecture_occurrences")