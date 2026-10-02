"""add user gemini_api_key

Revision ID: c1a2b3c4d5e6
Revises: f7704ac33092
Create Date: 2026-10-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c1a2b3c4d5e6"
down_revision: Union[str, None] = "5304ca6e9632"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("gemini_api_key", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "gemini_api_key")