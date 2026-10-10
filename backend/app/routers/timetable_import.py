import json
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.timetable_import import TimetableImport
from app.models.timetable import TimetableEntry
from app.models.course import Course
from app.models.user import User
from app.models.assignment import Assignment
from app.models.exam import Exam
from app.models.study_session import StudySession
from app.models.task import Task
from app.schemas.timetable_import import (
    ConfirmImportRequest,
    ConfirmImportResponse,
    ExtractedEntry,
    ExtractionResponse,
    PendingImportResponse,
    CourseUsage,
    ReplacePreviewResponse,
)
from app.services.gemini import extract_timetable_from_image, extract_timetable_from_pdf
from app.services.study_plan_activation import _find_course

router = APIRouter()

# Allowed file types and max size
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_PDF_TYPE = "application/pdf"
MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


def parse_time_string(time_str: str) -> time:
    """
    Parses a time string in HH:MM format into a Python time object.
    Raises ValueError if the format is invalid.
    """
    try:
        parts = time_str.strip().split(":")
        hour = int(parts[0])
        minute = int(parts[1])
        return time(hour=hour, minute=minute)
    except (ValueError, IndexError):
        raise ValueError(f"Invalid time format: '{time_str}'. Expected HH:MM.")

def _upcoming_ai_sessions_query(db: Session, user_id: str):
    """
    Study sessions the AI planned that have not happened yet. These were built
    around the old timetable, so replacing the timetable removes them.
    Completed, skipped, past and hand-made sessions are never included.
    """
    return db.query(StudySession).filter(
        StudySession.user_id == user_id,
        StudySession.is_ai_generated.is_(True),
        StudySession.status == "planned",
        StudySession.session_date >= date.today(),
    )


def _course_usage(db: Session, user_id: str, course: Course) -> CourseUsage:
    """Counts the work linked to a course (not counting sessions about to be removed)."""
    upcoming_ai = (
        _upcoming_ai_sessions_query(db, user_id)
        .filter(StudySession.course_id == course.id)
        .count()
    )
    all_sessions = (
        db.query(StudySession).filter(StudySession.course_id == course.id).count()
    )
    return CourseUsage(
        id=course.id,
        code=course.code,
        name=course.name,
        tasks=db.query(Task).filter(Task.course_id == course.id).count(),
        assignments=db.query(Assignment)
        .filter(Assignment.course_id == course.id)
        .count(),
        exams=db.query(Exam).filter(Exam.course_id == course.id).count(),
        study_sessions=all_sessions - upcoming_ai,
    )


def _has_linked_work(usage: CourseUsage) -> bool:
    return usage.tasks + usage.assignments + usage.exams + usage.study_sessions > 0    

@router.post("/upload", response_model=ExtractionResponse)
async def upload_timetable(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accepts a timetable image or PDF, sends it to Gemini Vision,
    and returns the extracted class entries for student review.

    The extracted data is NOT saved to the timetable yet.
    The student must call /confirm to save entries permanently.

    Supported formats: JPEG, PNG, WebP, PDF
    Maximum file size: 10MB
    """
    # Validate file type
    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES and content_type != ALLOWED_PDF_TYPE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {content_type}. Please upload a JPEG, PNG, WebP, or PDF file.",
        )

    # Read the file and check size
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File is too large. Maximum size is {MAX_FILE_SIZE_MB}MB.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    # Each student uses their own Gemini key (one user -> one key)
    if not current_user.gemini_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please add your Gemini API key before importing a timetable.",
        )

    # Create an import session record
    import_session = TimetableImport(
        user_id=current_user.id,
        original_filename=file.filename or "timetable",
        status="pending",
    )
    db.add(import_session)
    db.commit()
    db.refresh(import_session)

    # Send to Gemini for extraction
    try:
        if content_type == ALLOWED_PDF_TYPE:
            extracted = extract_timetable_from_pdf(file_bytes, current_user.gemini_api_key)
        else:
            extracted = extract_timetable_from_image(
                file_bytes, content_type, current_user.gemini_api_key
            )

        # Store the extracted data in the session
        import_session.extracted_data = json.dumps(extracted)
        import_session.status = "extracted"
        db.commit()

        # Parse the extracted entries
        raw_entries = extracted.get("entries", [])
        extraction_notes = extracted.get("extraction_notes")

        # Convert to response schema — skip entries with invalid data
        valid_entries = []
        for entry in raw_entries:
            try:
                valid_entries.append(
                    ExtractedEntry(
                        course_name=entry.get("course_name", "Unknown Course"),
                        course_code=entry.get("course_code"),
                        day_of_week=int(entry.get("day_of_week", 0)),
                        start_time=entry.get("start_time", "00:00"),
                        end_time=entry.get("end_time", "00:00"),
                        venue=entry.get("venue"),
                        lecturer=entry.get("lecturer"),
                        class_type=entry.get("class_type", "lecture"),
                    )
                )
            except Exception:
                # Skip malformed entries — the student can add them manually
                continue

        return ExtractionResponse(
            import_id=import_session.id,
            status="extracted",
            extracted_entries=valid_entries,
            extraction_notes=extraction_notes,
            message=(
                f"Extracted {len(valid_entries)} class entries from your timetable. "
                "Please review them carefully before confirming."
            ),
        )
    except Exception as e:
        # Mark the session as failed
        import_session.status = "failed"
        import_session.error_message = str(e)
        db.commit()

        error_str = str(e)
                # Show the real reason in the server terminal (helps with debugging)
        print("Timetable import failed:", error_str)

        # Gemini quota / rate-limit (429)
        if "429" in error_str or "RESOURCE_EXHAUSTED" in error_str or "quota" in error_str.lower():
            import re as _re
            retry_match = _re.search(
                r"retry in (\d+)(?:\.\d+)?\s*s|retryDelay\W+(\d+)s",
                error_str,
                _re.IGNORECASE,
            )
            wait_seconds = (
                int(retry_match.group(1) or retry_match.group(2))
                if retry_match
                else None
            )
            if wait_seconds is None:
                retry_hint = " Please wait a minute and try again."
            elif wait_seconds < 120:
                retry_hint = f" Please wait about {wait_seconds} seconds and try again."
            elif wait_seconds < 7200:
                retry_hint = f" Please try again in about {round(wait_seconds / 60)} minutes."
            else:
                retry_hint = (
                    " The daily free limit has been reached. Please try again in about "
                    f"{round(wait_seconds / 3600)} hours."
                )

        # Gemini returned unreadable output
        if "could not be parsed as JSON" in error_str or "JSONDecodeError" in error_str:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "The timetable was received but could not be fully read. "
                    "Try uploading a clearer image or a PDF version of your timetable."
                ),
            )

        # File content not recognised as a timetable
        if "not a timetable" in error_str.lower() or "could not extract" in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "No timetable data could be found in this file. "
                    "Make sure the image or PDF contains your class schedule."
                ),
            )

        # Generic fallback — no raw error details exposed to the student
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Unable to process your timetable. Please try again with a "
                "clearer image or a PDF. If the problem continues, add your "
                "classes manually."
            ),
        )

@router.post("/confirm/{import_id}/preview", response_model=ReplacePreviewResponse)
def preview_replace(
    import_id: str,
    payload: ConfirmImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Shows what replacing the current timetable with these entries would do.
    Nothing is changed or saved by this route.
    """
    import_session = (
        db.query(TimetableImport)
        .filter(
            TimetableImport.id == import_id,
            TimetableImport.user_id == current_user.id,
        )
        .first()
    )
    if not import_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import session not found.",
        )

    # Which of the student's courses does the new timetable use?
    used_course_ids: set[str] = set()
    for entry in payload.entries:
        if entry.course_id:
            course = (
                db.query(Course)
                .filter(Course.id == entry.course_id, Course.user_id == current_user.id)
                .first()
            )
        else:
            name = (entry.course_name or "").strip()
            code = (entry.course_code or "").strip() or None
            course = _find_course(db, current_user.id, name, code)
        if course:
            used_course_ids.add(course.id)

    existing_class_count = (
        db.query(TimetableEntry)
        .filter(
            TimetableEntry.user_id == current_user.id,
            TimetableEntry.is_active.is_(True),
        )
        .count()
    )

    courses_to_remove: list[CourseUsage] = []
    courses_with_work: list[CourseUsage] = []
    all_courses = (
        db.query(Course)
        .filter(Course.user_id == current_user.id, Course.is_active.is_(True))
        .order_by(Course.name)
        .all()
    )
    for course in all_courses:
        if course.id in used_course_ids:
            continue
        usage = _course_usage(db, current_user.id, course)
        if _has_linked_work(usage):
            courses_with_work.append(usage)
        else:
            courses_to_remove.append(usage)

    return ReplacePreviewResponse(
        existing_class_count=existing_class_count,
        new_class_count=len(payload.entries),
        upcoming_ai_sessions_count=_upcoming_ai_sessions_query(
            db, current_user.id
        ).count(),
        courses_to_remove=courses_to_remove,
        courses_with_work=courses_with_work,
    )

@router.post("/confirm/{import_id}", response_model=ConfirmImportResponse)
def confirm_import(
    import_id: str,
    payload: ConfirmImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Saves the student's reviewed timetable entries permanently.

    Each entry names its course either by course_id (one of the student's
    courses) or by course_name/course_code. In the second case the matching
    course is used, or a new course is created, so a student does not have to
    add their courses by hand before importing a timetable.

    Everything is saved together: if anything is wrong, nothing is saved.
    """
    # Verify the import session exists and belongs to this user
    import_session = (
        db.query(TimetableImport)
        .filter(
            TimetableImport.id == import_id,
            TimetableImport.user_id == current_user.id,
        )
        .first()
    )
    if not import_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Import session not found.",
        )

    if import_session.status == "confirmed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This import has already been confirmed.",
        )

    if not payload.entries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No entries provided to save.",
        )

        classes_removed = 0
    sessions_removed = 0
    courses_removed = 0
    courses_kept = 0
    used_course_ids: set[str] = set()

    # Replacing: clear the old timetable and the upcoming AI-planned sessions
    # that were built around it. If anything below fails, none of this is saved.
    if payload.replace_existing:
        classes_removed = (
            db.query(TimetableEntry)
            .filter(TimetableEntry.user_id == current_user.id)
            .delete(synchronize_session=False)
        )
        sessions_removed = _upcoming_ai_sessions_query(
            db, current_user.id
        ).delete(synchronize_session=False)
        db.flush()
    
    # Courses already looked up or created during this request
    resolved_courses: dict[tuple[str, str], Course] = {}
    seen_entries: set[tuple[str, int, time, time]] = set()
    saved_count = 0
    courses_created = 0
    duplicates_skipped = 0

    for entry in payload.entries:
        # 1. Which course is this class for?
        if entry.course_id:
            course = (
                db.query(Course)
                .filter(Course.id == entry.course_id, Course.user_id == current_user.id)
                .first()
            )
            if not course:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Course with id '{entry.course_id}' not found.",
                )
        else:
            name = (entry.course_name or "").strip()
            code = (entry.course_code or "").strip() or None
            key = ((code or "").lower(), name.lower())

            course = resolved_courses.get(key)
            if course is None:
                course = _find_course(db, current_user.id, name, code)
                if course is None:
                    course = Course(
                        user_id=current_user.id,
                        name=name[:255],
                        code=code[:50] if code else None,
                        lecturer=(entry.lecturer or "")[:255] or None,
                    )
                    db.add(course)
                    db.flush()  # gives the new course its id
                    courses_created += 1
                resolved_courses[key] = course

        used_course_ids.add(course.id)
        # 2. Parse the time strings
        try:
            start = parse_time_string(entry.start_time)
            end = parse_time_string(entry.end_time)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )

        if end <= start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"end_time must be after start_time for entry with course '{course.name}'.",
            )

        # 3. Skip a class that is already in the timetable
        entry_key = (course.id, entry.day_of_week, start, end)
        already_saved = entry_key in seen_entries or (
            db.query(TimetableEntry)
            .filter(
                TimetableEntry.user_id == current_user.id,
                TimetableEntry.course_id == course.id,
                TimetableEntry.day_of_week == entry.day_of_week,
                TimetableEntry.start_time == start,
                TimetableEntry.end_time == end,
                TimetableEntry.is_active.is_(True),
            )
            .first()
            is not None
        )
        if already_saved:
            duplicates_skipped += 1
            continue
        seen_entries.add(entry_key)

        # 4. Create the timetable entry
        db.add(
            TimetableEntry(
                user_id=current_user.id,
                course_id=course.id,
                day_of_week=entry.day_of_week,
                start_time=start,
                end_time=end,
                venue=entry.venue,
                lecturer=entry.lecturer,
                class_type=entry.class_type,
                notes=entry.notes,
            )
        )
        saved_count += 1

        # Replacing: clean up courses that are not in the new timetable
    if payload.replace_existing:
        old_courses = (
            db.query(Course)
            .filter(Course.user_id == current_user.id, Course.is_active.is_(True))
            .all()
        )
        for course in old_courses:
            if course.id in used_course_ids:
                continue
            usage = _course_usage(db, current_user.id, course)
            if not _has_linked_work(usage) or course.id in payload.delete_course_ids:
                db.delete(course)
                courses_removed += 1
            else:
                courses_kept += 1

    # Mark the import session as confirmed
    import_session.status = "confirmed"
    db.commit()

    message = f"Successfully saved {saved_count} timetable entries."
    if courses_created:
        message += f" Created {courses_created} new courses."
    if duplicates_skipped:
        message += f" Skipped {duplicates_skipped} already in your timetable."
    if payload.replace_existing:
        message += f" Replaced {classes_removed} old classes."
        if sessions_removed:
            message += f" Removed {sessions_removed} upcoming study sessions planned around the old timetable."
        if courses_removed:
            message += f" Removed {courses_removed} courses no longer in your timetable."
        if courses_kept:
            message += f" Kept {courses_kept} courses that still have work linked."

    return ConfirmImportResponse(
        saved_count=saved_count,
        message=message,
        courses_created=courses_created,
        duplicates_skipped=duplicates_skipped,
        classes_removed=classes_removed,
        sessions_removed=sessions_removed,
        courses_removed=courses_removed,
        courses_kept=courses_kept,
    )


@router.get("/history")
def get_import_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the current user's timetable import history.
    Useful for showing past upload sessions.
    """
    imports = (
        db.query(TimetableImport)
        .filter(TimetableImport.user_id == current_user.id)
        .order_by(TimetableImport.created_at.desc())
        .all()
    )
    return [
        {
            "id": i.id,
            "original_filename": i.original_filename,
            "status": i.status,
            "created_at": i.created_at,
            "error_message": i.error_message,
        }
        for i in imports
    ]

@router.get("/pending", response_model=PendingImportResponse | None)
def get_pending_import(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the student's most recent upload that has been read by the AI but
    not confirmed yet, so they can continue reviewing it without uploading
    again. Returns null if there is none.
    """
    import_session = (
        db.query(TimetableImport)
        .filter(
            TimetableImport.user_id == current_user.id,
            TimetableImport.status == "extracted",
        )
        .order_by(TimetableImport.created_at.desc())
        .first()
    )
    if import_session is None or not import_session.extracted_data:
        return None

    try:
        extracted = json.loads(import_session.extracted_data)
    except json.JSONDecodeError:
        return None
    if not isinstance(extracted, dict):
        return None

    entries = []
    for entry in extracted.get("entries", []):
        try:
            entries.append(
                ExtractedEntry(
                    course_name=entry.get("course_name", "Unknown Course"),
                    course_code=entry.get("course_code"),
                    day_of_week=int(entry.get("day_of_week", 0)),
                    start_time=entry.get("start_time", "00:00"),
                    end_time=entry.get("end_time", "00:00"),
                    venue=entry.get("venue"),
                    lecturer=entry.get("lecturer"),
                    class_type=entry.get("class_type", "lecture"),
                )
            )
        except Exception:
            continue

    return PendingImportResponse(
        import_id=import_session.id,
        status="extracted",
        extracted_entries=entries,
        extraction_notes=extracted.get("extraction_notes"),
        message=(
            f"Found {len(entries)} class entries in your earlier upload. "
            "Please review them carefully before confirming."
        ),
        original_filename=import_session.original_filename,
        created_at=import_session.created_at,
    )


@router.post("/discard/{import_id}")
def discard_import(
    import_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Throws away an unconfirmed upload so it is not offered again."""
    import_session = (
        db.query(TimetableImport)
        .filter(
            TimetableImport.id == import_id,
            TimetableImport.user_id == current_user.id,
            TimetableImport.status == "extracted",
        )
        .first()
    )
    if import_session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload not found.",
        )

    import_session.status = "discarded"
    db.commit()
    return {"message": "Upload discarded."}