from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserAvatar(Base):
    """
    A student's profile photo (already resized to a small square JPEG).

    It lives in its own table so normal user queries never load the picture.
    One row per user: the user_id is the primary key.
    """
    __tablename__ = "user_avatars"

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    content_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="image/jpeg"
    )
    # deferred=True: the picture bytes are only loaded when we ask for them
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="avatar")  # type: ignore