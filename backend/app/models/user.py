import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Boolean, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    """
    Represents a student account in Lebid.

    Each user has a unique email address and a hashed password.
    The id is a UUID so that user IDs are not guessable sequential integers.
    """
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )

    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    university: Mapped[str | None] = mapped_column(String(255), nullable=True)
    programme: Mapped[str | None] = mapped_column(String(255), nullable=True)
    level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    semester: Mapped[str | None] = mapped_column(String(50), nullable=True)
    academic_year: Mapped[str | None] = mapped_column(String(50), nullable=True)
        # Per-user Google Gemini API key (never returned in API responses)
    gemini_api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    @property
    def has_gemini_api_key(self) -> bool:
        """True if this user has stored a Gemini API key. Never exposes the key itself."""
        return bool(self.gemini_api_key)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

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

    courses: Mapped[list["Course"]] = relationship(  # type: ignore
        "Course",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(  # type: ignore
        "TimetableEntry",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    timetable_imports: Mapped[list["TimetableImport"]] = relationship(  # type: ignore
        "TimetableImport",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    tasks: Mapped[list["Task"]] = relationship(  # type: ignore
        "Task",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    assignments: Mapped[list["Assignment"]] = relationship(  # type: ignore
        "Assignment",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    exams: Mapped[list["Exam"]] = relationship(  # type: ignore
        "Exam",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    events: Mapped[list["Event"]] = relationship(  # type: ignore
        "Event",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    study_sessions: Mapped[list["StudySession"]] = relationship(  # type: ignore
        "StudySession",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    notifications: Mapped[list["Notification"]] = relationship(  # type: ignore
        "Notification",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"