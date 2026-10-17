import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AuthEvent(Base):
    """
    One row for each sign-in related event (a login, a failed login, a new
    account, a password change...).

    Lebid uses these rows for two things:
    1. Rate limiting: counting recent failures to block password guessing.
    2. A security log: seeing what happened and when.

    A password is NEVER stored here.
    """
    __tablename__ = "auth_events"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    # What happened, e.g. "login_failed" or "login_success"
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)

    # The email as typed, in lowercase (it may belong to nobody)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # The matching account, if there is one. If the account is deleted the
    # log row stays, but the link is cleared.
    user_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # These indexes make the "how many failures recently?" questions fast
    __table_args__ = (
        Index("ix_auth_events_email_type_created", "email", "event_type", "created_at"),
        Index("ix_auth_events_ip_type_created", "ip_address", "event_type", "created_at"),
        Index("ix_auth_events_user_type_created", "user_id", "event_type", "created_at"),
        Index("ix_auth_events_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<AuthEvent {self.event_type} email={self.email}>"