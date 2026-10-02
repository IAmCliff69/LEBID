from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import UserResponse, MessageResponse
from app.schemas.user import UpdateProfileRequest, ChangePasswordRequest
from app.utils.security import verify_password, hash_password
from app.schemas.auth import GeminiKeyRequest, GeminiKeyResponse, MessageResponse
from app.services.gemini import validate_gemini_api_key

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

    if not validate_gemini_api_key(key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="That Gemini API key could not be validated. Check the key and try again.",
        )

    current_user.gemini_api_key = key
    db.commit()

    return {
        "message": "Gemini API key saved successfully.",
        "has_gemini_api_key": True,
    }