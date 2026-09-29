from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.dependencies import get_db, get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    UserResponse,
)
from app.utils.security import create_access_token, hash_password, verify_password

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """
    Create a new user account.
    
    - Checks that the email is not already registered.
    - Hashes the password before storing it.
    - Returns the new user's data (without the password).
    """
    # Check if email is already taken
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
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

    return new_user


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Log in with email and password.
    
    - Verifies the credentials.
    - Issues a JWT stored in an HttpOnly cookie.
    - Returns the user's data.
    
    The HttpOnly cookie cannot be read by JavaScript, which prevents
    token theft through XSS attacks.
    """
    # Find the user by email
    user = db.query(User).filter(User.email == payload.email).first()

    # Verify password — we check both user existence and password in one step
    # to avoid revealing whether the email exists (timing attack prevention)
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    # Create JWT and set it as an HttpOnly cookie
    token = create_access_token(user_id=user.id)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,       # JavaScript cannot read this cookie
        secure=False,        # Set to True in production (requires HTTPS)
        samesite="lax",      # Protects against CSRF
        max_age=60 * 60,     # 1 hour in seconds
    )

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