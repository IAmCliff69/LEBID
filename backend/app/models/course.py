import uuid
from datetime import datetime, timezone

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    __tablename__ = "courses"

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
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    credit_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)
    lecturer: Mapped[str | None] = mapped_column(String(255), nullable=True)
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
    user: Mapped["User"] = relationship("User", back_populates="courses")  # type: ignore
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(  # type: ignore
        "TimetableEntry",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    tasks: Mapped[list["Task"]] = relationship(  # type: ignore
        "Task",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    assignments: Mapped[list["Assignment"]] = relationship(  # type: ignore
        "Assignment",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    exams: Mapped[list["Exam"]] = relationship(  # type: ignore
        "Exam",
        back_populates="course",
        cascade="all, delete-orphan",
    )
    study_sessions: Mapped[list["StudySession"]] = relationship(  # type: ignore
        "StudySession",
        back_populates="course",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Course id={self.id} code={self.code} name={self.name}>"