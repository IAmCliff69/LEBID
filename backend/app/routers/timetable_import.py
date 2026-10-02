import json
from datetime import time

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.timetable_import import TimetableImport
from app.models.timetable import TimetableEntry
from app.models.course import Course
from app.models.user import User
from app.schemas.timetable_import import (
    ConfirmImportRequest,
    ConfirmImportResponse,
    ExtractedEntry,
    ExtractionResponse,
)
from app.services.gemini import extract_timetable_from_image, extract_timetable_from_pdf

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

        # Gemini quota / rate-limit (429)
        if "429" in error_str or "quota" in error_str.lower() or "rate" in error_str.lower():
            import re as _re
            retry_match = _re.search(r"retry.*?(\d+)\s*s", error_str, _re.IGNORECASE)
            retry_hint = (
                f" Please wait {retry_match.group(1)} seconds and try again."
                if retry_match
                else " Please wait a moment and try again."
            )
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"The AI service is currently busy due to high usage.{retry_hint}",
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


@router.post("/confirm/{import_id}", response_model=ConfirmImportResponse)
def confirm_import(
    import_id: str,
    payload: ConfirmImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Saves the student's reviewed and corrected timetable entries permanently.

    The student provides a list of confirmed entries, each with a course_id
    linking it to one of their existing courses. These are then saved as
    real timetable entries.

    Each course_id is verified to belong to the current user.
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

    saved_count = 0
    for entry in payload.entries:
        # Verify the course belongs to this user
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

        # Parse the time strings
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

        # Create the timetable entry
        timetable_entry = TimetableEntry(
            user_id=current_user.id,
            course_id=entry.course_id,
            day_of_week=entry.day_of_week,
            start_time=start,
            end_time=end,
            venue=entry.venue,
            lecturer=entry.lecturer,
            class_type=entry.class_type,
            notes=entry.notes,
        )
        db.add(timetable_entry)
        saved_count += 1

    # Mark the import session as confirmed
    import_session.status = "confirmed"
    db.commit()

    return ConfirmImportResponse(
        saved_count=saved_count,
        message=f"Successfully saved {saved_count} timetable entries.",
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