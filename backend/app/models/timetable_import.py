import uuid
from datetime import datetime, timezone

from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TimetableImport(Base):
    """
    Stores a timetable extraction session.

    When a student uploads a timetable image, we extract the data
    and store it here temporarily. The student then reviews the
    extracted data and confirms it. Only after confirmation do the
    entries become permanent timetable entries.

    Status values:
    - pending: extraction is in progress
    - extracted: extraction completed, awaiting student review
    - confirmed: student confirmed, entries saved to timetable
    - failed: extraction failed
    """
    __tablename__ = "timetable_imports"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Original filename uploaded by the student
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # Status of this import session
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")

    # The raw extracted JSON stored as text
    # This is what Gemini returned, stored so we can display it for review
    extracted_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Any error message if extraction failed
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationship
    user: Mapped["User"] = relationship("User", back_populates="timetable_imports")  # type: ignore

    def __repr__(self) -> str:
        return f"<TimetableImport id={self.id} status={self.status}>"