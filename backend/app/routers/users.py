from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.user_avatar import UserAvatar
from datetime import datetime, timezone
from app.schemas.auth import UserResponse, MessageResponse
from app.schemas.user import UpdateProfileRequest, ChangePasswordRequest
from app.utils.security import verify_password, hash_password
from app.schemas.auth import GeminiKeyRequest, GeminiKeyResponse, MessageResponse
from app.services.gemini import GeminiUnreachableError, validate_gemini_api_key
from app.models.study_preferences import StudyPreferences
from app.schemas.study_preferences import (
    StudyPreferencesRequest,
    StudyPreferencesResponse,
)

router = APIRouter()


@router.get("/me", response_model=UserResponse)
def get_profile(current_user: User = Depends(get_current_user)):
    """
    Returns the currently authenticated user's full profile.
    Protected — requires a valid auth cookie.
    """
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_profile(
    payload: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates the current user's profile.

    Only the fields included in the request body are updated.
    Fields not included remain unchanged.

    For example, sending only { "university": "KNUST" } will update
    the university field and leave everything else as it is.
    """
    # model_dump(exclude_unset=True) gives us only the fields the user
    # actually sent — not the ones that defaulted to None
    updates = payload.model_dump(exclude_unset=True)

    if not updates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields provided to update.",
        )

    for field, value in updates.items():
        setattr(current_user, field, value)

    db.commit()
    db.refresh(current_user)

    return current_user


@router.patch("/me/password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Changes the current user's password.

    Requires the current password for confirmation before allowing
    the change. This prevents someone who finds an active session
    from locking the real user out of their account.
    """
    # Verify current password before allowing the change
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # Prevent changing to the same password
    if verify_password(payload.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from your current password.",
        )

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password changed successfully."}

@router.post("/me/gemini-key", response_model=GeminiKeyResponse)
def set_gemini_api_key(
    payload: GeminiKeyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Saves the student's personal Gemini API key after a quick validation check.
    The raw key is never returned in responses.
    """
    key = payload.api_key.strip()

    try:
        key_is_valid = validate_gemini_api_key(key)
    except GeminiUnreachableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't reach Google to check your key. Please check your internet connection and try again.",
        )

    if not key_is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not accept that API key. Copy the whole key again from Google AI Studio and try again.",
        )

    current_user.gemini_api_key = key
    db.commit()

    return {
        "message": "Gemini API key saved successfully.",
        "has_gemini_api_key": True,
    }

@router.get("/me/study-preferences", response_model=StudyPreferencesResponse | None)
def get_study_preferences(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the student's saved study preferences,
    or null if they have not saved any yet.
    """
    return (
        db.query(StudyPreferences)
        .filter(StudyPreferences.user_id == current_user.id)
        .first()
    )


@router.put("/me/study-preferences", response_model=StudyPreferencesResponse)
def save_study_preferences(
    payload: StudyPreferencesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates the student's study preferences, or replaces them if they
    already exist. Always scoped to the logged-in student.
    """
    preferences = (
        db.query(StudyPreferences)
        .filter(StudyPreferences.user_id == current_user.id)
        .first()
    )

    if preferences is None:
        preferences = StudyPreferences(user_id=current_user.id)
        db.add(preferences)

    preferences.study_times = payload.study_times
    preferences.study_days = payload.study_days
    preferences.session_length_minutes = payload.session_length_minutes
    preferences.break_preference = payload.break_preference

    db.commit()
    db.refresh(preferences)

    return preferences

@router.post("/me/complete-onboarding", response_model=UserResponse)
def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Marks the student's onboarding as finished. Safe to call more than once.
    The Gemini key and academic details must have been saved first.
    """
    has_academic_info = all(
        [
            current_user.university,
            current_user.programme,
            current_user.level,
            current_user.semester,
        ]
    )
    if not current_user.has_gemini_api_key or not has_academic_info:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please finish the earlier setup steps (Gemini key and academic details) first.",
        )

    current_user.onboarding_completed = True
    db.commit()
    db.refresh(current_user)
    return current_user

# ---------------------------------------------------------------------------
# Profile photo (avatar)
# ---------------------------------------------------------------------------

MAX_AVATAR_BYTES = 5 * 1024 * 1024      # 5 MB upload limit
AVATAR_SIZE = 512                        # saved as a 512 x 512 square
ALLOWED_AVATAR_FORMATS = {"JPEG", "PNG", "WEBP"}


def _make_avatar_jpeg(file_bytes: bytes) -> bytes:
    """
    Validates an uploaded picture and turns it into a small square JPEG.
    Raises a friendly 400 error if the file is not a usable image.
    """
    bad_image = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="That file isn't a usable photo. Please choose a JPEG, PNG or WebP image.",
    )

    try:
        image = Image.open(BytesIO(file_bytes))
        if image.format not in ALLOWED_AVATAR_FORMATS:
            raise bad_image
        image = ImageOps.exif_transpose(image)   # respect phone rotation
        image = image.convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise bad_image

    # Crop the centre to a square, then shrink to 256 x 256
    image = ImageOps.fit(image, (AVATAR_SIZE, AVATAR_SIZE), method=Image.LANCZOS)

    output = BytesIO()
    image.save(output, format="JPEG", quality=88, optimize=True)
    return output.getvalue()


@router.put("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Saves (or replaces) the current student's profile photo.
    The picture is resized to a small square before it is stored.
    """
    file_bytes = await file.read(MAX_AVATAR_BYTES + 1)
    if len(file_bytes) > MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="That photo is too large. Please choose one under 5 MB.",
        )

    jpeg_bytes = _make_avatar_jpeg(file_bytes)

    avatar = (
        db.query(UserAvatar)
        .filter(UserAvatar.user_id == current_user.id)
        .first()
    )
    if avatar is None:
        avatar = UserAvatar(
            user_id=current_user.id,
            content_type="image/jpeg",
            data=jpeg_bytes,
        )
        db.add(avatar)
    else:
        avatar.data = jpeg_bytes
        avatar.content_type = "image/jpeg"
        avatar.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/me/avatar")
def get_avatar(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the current student's own profile photo.
    There is no user id in this address, so nobody can ask for another
    student's photo.
    """
    avatar = (
        db.query(UserAvatar)
        .filter(UserAvatar.user_id == current_user.id)
        .first()
    )
    if avatar is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No profile photo yet.",
        )

    return Response(
        content=avatar.data,
        media_type=avatar.content_type,
        headers={"Cache-Control": "private, max-age=3600"},
    )