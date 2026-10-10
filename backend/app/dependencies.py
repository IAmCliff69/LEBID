from typing import Generator

from fastapi import Depends, HTTPException, Cookie, Response, status
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
    response: Response,
    access_token: str | None = Cookie(default=None),
    db: Session = Depends(get_db),
):
    """
    Reads the JWT from the HttpOnly cookie and returns the current user.

    Raises 401 if:
    - No cookie is present
    - The token is invalid or expired
    - The user no longer exists in the database

    Sliding session: when the token has less than half of its life left,
    a fresh cookie is sent back, so students who keep using Lebid stay
    logged in.
    """
    from datetime import datetime, timezone

    from app.config import settings
    from app.models.user import User
    from app.utils.security import (
        create_access_token,
        decode_token_payload,
        set_auth_cookie,
    )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Your session has expired. Please log in again.",
    )

    if access_token is None:
        raise credentials_exception

    payload = decode_token_payload(access_token)
    if payload is None or not payload.get("sub"):
        raise credentials_exception

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if user is None or not user.is_active:
        raise credentials_exception

    # Renew the login if less than half of its lifetime is left.
    expires_at = payload.get("exp")
    if expires_at is not None:
        seconds_left = expires_at - datetime.now(timezone.utc).timestamp()
        full_lifetime = settings.jwt_access_token_expire_minutes * 60
        if seconds_left < full_lifetime / 2:
            set_auth_cookie(response, create_access_token(user_id=user.id))

    return user