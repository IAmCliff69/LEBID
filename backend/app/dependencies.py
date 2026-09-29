from typing import Generator

from fastapi import Depends, HTTPException, Cookie, status
from sqlalchemy.orm import Session

from app.database import SessionLocal


# ---------------------------------------------------------------------------
# Database session dependency
# ---------------------------------------------------------------------------

def get_db() -> Generator[Session, None, None]:
    """
    Provides a database session per request.
    The session is closed automatically after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Authentication dependency
# ---------------------------------------------------------------------------

def get_current_user(
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """
    Reads the JWT from the HttpOnly cookie and returns the current user.
    
    How to use this in any protected route:
        from app.dependencies import get_current_user
        from app.models.user import User
        
        @router.get("/something")
        def my_route(current_user: User = Depends(get_current_user)):
            ...
    
    Raises 401 if:
    - No cookie is present
    - The token is invalid or expired
    - The user no longer exists in the database
    """
    from app.utils.security import decode_access_token
    from app.models.user import User

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Your session has expired. Please log in again.",
    )

    if access_token is None:
        raise credentials_exception

    user_id = decode_access_token(access_token)
    if user_id is None:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None or not user.is_active:
        raise credentials_exception

    return user