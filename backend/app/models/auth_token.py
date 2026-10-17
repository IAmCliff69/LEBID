import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuthToken(Base):
    """
    A single-use link token, for example in an "verify your email" email.

    The token itself (the secret in the link) is NEVER stored. We store only
    its SHA-256 hash, so even someone who reads the database cannot use it.
    """
    __tablename__ = "auth_tokens"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # What the token is for: "verify_email" (later also "reset_password")
    purpose: Mapped[str] = mapped_column(String(30), nullable=False)

    # SHA-256 of the secret, as 64 hex characters
    token_hash: Mapped[str] = mapped_column(
        String(64), unique=True, index=True, nullable=False
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    # Filled in the moment the token is used, so it can never be used twice
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_auth_tokens_user_purpose", "user_id", "purpose"),
    )