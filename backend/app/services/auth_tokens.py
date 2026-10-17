import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.auth_token import AuthToken

# What a token can be used for
VERIFY_EMAIL = "verify_email"
RESET_PASSWORD = "reset_password"

# Used tokens and expired tokens are deleted after this long
KEEP_OLD_TOKENS_FOR = timedelta(days=7)


def _hash(raw_token: str) -> str:
    """The only form of a token we ever store."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def create_token(
    db: Session, user_id: str, purpose: str, lifetime: timedelta
) -> str:
    """
    Makes a new single-use token and returns the SECRET (to put in an email
    link). Only its hash is saved. Any older unused token of the same kind
    for this student is removed, so only the newest link works.
    """
    now = datetime.now(timezone.utc)

    # Only the newest link should work
    db.query(AuthToken).filter(
        AuthToken.user_id == user_id,
        AuthToken.purpose == purpose,
        AuthToken.used_at.is_(None),
    ).delete(synchronize_session=False)

    # Tidy up old rows now and then
    db.query(AuthToken).filter(
        AuthToken.created_at < now - KEEP_OLD_TOKENS_FOR
    ).delete(synchronize_session=False)

    raw_token = secrets.token_urlsafe(32)   # 256 bits: impossible to guess
    db.add(
        AuthToken(
            user_id=user_id,
            purpose=purpose,
            token_hash=_hash(raw_token),
            expires_at=now + lifetime,
        )
    )
    db.commit()
    return raw_token


def consume_token(db: Session, raw_token: str, purpose: str) -> str | None:
    """
    Uses a token. Returns the student's id if the token is real, for this
    purpose, not used before and not expired. Otherwise returns None.

    The caller must commit afterwards (so using the token and the change it
    unlocks are saved together).
    """
    row = (
        db.query(AuthToken)
        .filter(AuthToken.token_hash == _hash(raw_token))
        .with_for_update()
        .first()
    )
    now = datetime.now(timezone.utc)

    if (
        row is None
        or row.purpose != purpose
        or row.used_at is not None
        or row.expires_at <= now
    ):
        return None

    row.used_at = now
    return row.user_id