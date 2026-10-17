from datetime import datetime, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
    VerifyEmailRequest,
)
from app.services.auth_limits import (
    EMAIL_VERIFIED,
    EMAIL_VERIFY_FAILED,
    LOGIN_FAILED,
    LOGIN_INACTIVE,
    LOGIN_SUCCESS,
    PASSWORD_RESET_FAILED,
    PASSWORD_RESET_REQUESTED,
    PASSWORD_RESET_SUCCESS,
    REGISTER_REJECTED,
    REGISTER_SUCCESS,
    VERIFICATION_SENT,
    check_login_allowed,
    check_register_allowed,
    check_reset_allowed,
    check_reset_request_allowed,
    check_verification_resend_allowed,
    check_verify_allowed,
    normalize_email,
    record_event,
)
from app.services.auth_tokens import RESET_PASSWORD, VERIFY_EMAIL, consume_token
from app.services.email_verification import queue_verification_email
from app.services.password_reset import (
    queue_password_changed_email,
    queue_reset_email,
)
from app.utils.security import (
    DUMMY_PASSWORD_HASH,
    create_access_token,
    hash_password,
    set_auth_cookie,
    verify_password,
)

router = APIRouter()

# The same answer for every email, so nobody can find out who has an account
FORGOT_PASSWORD_ANSWER = (
    "If an account exists for that email, we have sent a link to reset the "
    "password. It works for 30 minutes. If it does not arrive, check your spam folder."
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(
    payload: RegisterRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Create a new user account.

    - Stops too many sign-up attempts from the same place.
    - Checks that the email is not already registered.
    - Hashes the password before storing it.
    - Sends an email with a link to verify the email address.
    - Returns the new user's data (without the password).
    """
    check_register_allowed(db, request)

    # Check if email is already taken
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        record_event(db, REGISTER_REJECTED, request, email=payload.email)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists.",
        )

    # Create the user with a hashed password
    new_user = User(
        full_name=payload.full_name,
        email=payload.email,
        hashed_password=hash_password(payload.password),
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    record_event(
        db, REGISTER_SUCCESS, request, email=payload.email, user_id=new_user.id
    )

    # The verification email is sent after the answer goes back. A problem
    # sending it never stops the account from being created.
    queue_verification_email(db, new_user, background_tasks)
    record_event(
        db, VERIFICATION_SENT, request, email=payload.email, user_id=new_user.id
    )
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    """
    Log in with email and password.

    - Refuses to even check the password if there were too many recent failures.
    - Verifies the credentials.
    - Issues a JWT stored in an HttpOnly cookie.
    - Returns the user's data.

    The HttpOnly cookie cannot be read by JavaScript, which prevents
    token theft through XSS attacks.
    """
    # Too many recent failures? Stop here, before looking at the password.
    check_login_allowed(db, request, payload.email)

    # Find the user by email
    user = db.query(User).filter(User.email == payload.email).first()

    # We always do the (slow) password check, even when the email has no
    # account, so the answer takes the same time and reveals nothing.
    password_ok = verify_password(
        payload.password,
        user.hashed_password if user else DUMMY_PASSWORD_HASH,
    )

    if not user or not password_ok:
        record_event(
            db,
            LOGIN_FAILED,
            request,
            email=payload.email,
            user_id=user.id if user else None,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        record_event(
            db, LOGIN_INACTIVE, request, email=payload.email, user_id=user.id
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    # Create JWT and set it as an HttpOnly cookie
    token = create_access_token(user_id=user.id, token_version=user.token_version)
    set_auth_cookie(response, token)

    record_event(db, LOGIN_SUCCESS, request, email=payload.email, user_id=user.id)
    db.refresh(user)

    return user


@router.post("/logout", response_model=MessageResponse)
def logout(response: Response):
    """
    Log out the current user by clearing the auth cookie.
    No authentication required — clearing an invalid cookie is harmless.
    """
    response.delete_cookie(key="access_token")
    return {"message": "You have been logged out successfully."}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the currently authenticated user's profile.
    This is a protected route — requires a valid auth cookie.
    """
    return current_user


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(
    payload: VerifyEmailRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Confirms a student's email address using the link from their email.

    No login is needed, because the link is opened from an email, maybe on
    another device. The link is a long random secret that works once.
    """
    check_verify_allowed(db, request)

    user_id = consume_token(db, payload.token, VERIFY_EMAIL)
    user = db.query(User).filter(User.id == user_id).first() if user_id else None

    if user is None:
        record_event(db, EMAIL_VERIFY_FAILED, request)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This verification link is invalid or has expired. Please request a new one.",
        )

    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
    db.commit()

    record_event(db, EMAIL_VERIFIED, request, email=user.email, user_id=user.id)
    return {"message": "Your email address is verified."}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Sends a new verification link to the logged-in student. Older links stop
    working. Limited to a few emails per hour.
    """
    if current_user.email_verified_at is not None:
        return {"message": "Your email address is already verified."}

    check_verification_resend_allowed(db, current_user.id)

    queue_verification_email(db, current_user, background_tasks)
    record_event(
        db,
        VERIFICATION_SENT,
        request,
        email=current_user.email,
        user_id=current_user.id,
    )

    return {
        "message": (
            f"We sent a new verification link to {current_user.email}. "
            "If it does not arrive in a few minutes, check your spam folder."
        )
    }

@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Starts a password reset: emails a link if the account exists.

    The answer is the SAME whether or not the email has an account, so this
    cannot be used to find out who is registered.
    """
    check_reset_request_allowed(db, request, payload.email)

    # Capital letters in the email do not matter when recovering an account
    user = (
        db.query(User)
        .filter(func.lower(User.email) == normalize_email(payload.email))
        .order_by(User.created_at)
        .first()
    )

    if user is not None and user.is_active:
        queue_reset_email(db, user, background_tasks)

    record_event(
        db,
        PASSWORD_RESET_REQUESTED,
        request,
        email=payload.email,
        user_id=user.id if user else None,
    )
    return {"message": FORGOT_PASSWORD_ANSWER}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Sets a new password using the link from the reset email.

    No login is needed. A successful reset:
    - changes the password and signs the account out everywhere,
    - marks the email as verified (the link proved the student owns it),
    - clears any lock caused by wrong login attempts,
    - sends a "your password was changed" notice.
    It does NOT log anyone in.
    """
    check_reset_allowed(db, request)

    user_id = consume_token(db, payload.token, RESET_PASSWORD)
    user = db.query(User).filter(User.id == user_id).first() if user_id else None

    if user is None or not user.is_active:
        db.rollback()
        record_event(db, PASSWORD_RESET_FAILED, request)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has expired. Please request a new one.",
        )

    user.hashed_password = hash_password(payload.new_password)
    # Ends every login: their tokens carry the old version number
    user.token_version += 1
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(timezone.utc)
    db.commit()

    record_event(
        db, PASSWORD_RESET_SUCCESS, request, email=user.email, user_id=user.id
    )
    queue_password_changed_email(user, background_tasks)

    return {
        "message": "Your password has been reset. You can now log in with your new password."
    }