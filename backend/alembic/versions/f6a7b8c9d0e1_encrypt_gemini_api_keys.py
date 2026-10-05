"""encrypt stored gemini api keys

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-10-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

from app.utils.encryption import decrypt_secret, encrypt_secret

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Encrypted values are longer than 255 characters, so widen the column.
    op.alter_column(
        "users",
        "gemini_api_key",
        existing_type=sa.String(length=255),
        type_=sa.Text(),
        existing_nullable=True,
    )

    # 2. Encrypt any keys that are currently saved as plain text.
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, gemini_api_key FROM users WHERE gemini_api_key IS NOT NULL")
    ).fetchall()
    for user_id, plain_key in rows:
        connection.execute(
            sa.text("UPDATE users SET gemini_api_key = :value WHERE id = :id"),
            {"value": encrypt_secret(plain_key), "id": user_id},
        )


def downgrade() -> None:
    # Turn the encrypted values back into plain text, then shrink the column.
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT id, gemini_api_key FROM users WHERE gemini_api_key IS NOT NULL")
    ).fetchall()
    for user_id, token in rows:
        # A value that cannot be decrypted is cleared instead of kept.
        connection.execute(
            sa.text("UPDATE users SET gemini_api_key = :value WHERE id = :id"),
            {"value": decrypt_secret(token), "id": user_id},
        )

    op.alter_column(
        "users",
        "gemini_api_key",
        existing_type=sa.Text(),
        type_=sa.String(length=255),
        existing_nullable=True,
    )