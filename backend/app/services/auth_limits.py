import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.models.auth_event import AuthEvent

logger = logging.getLogger("lebid.auth")

# ---------------------------------------------------------------------------
# The limits. Change a number here and it changes everywhere.
# ---------------------------------------------------------------------------

# Time window for failed attempts
WINDOW = timedelta(minutes=15)

LOGIN_FAILS_PER_EMAIL = 5       # wrong passwords for one email in the window
LOGIN_FAILS_PER_IP = 20         # failed logins from one IP in the window
PASSWORD_FAILS_PER_USER = 5     # wrong "current password" tries in the window

REGISTER_WINDOW = timedelta(hours=1)
REGISTER_ATTEMPTS_PER_IP = 5    # new-account attempts from one IP per hour

# How long events are kept before they are deleted
KEEP_EVENTS_FOR = timedelta(days=30)

# ---------------------------------------------------------------------------
# Event types (what is written in the log)
# ---------------------------------------------------------------------------

LOGIN_SUCCESS = "login_success"
LOGIN_FAILED = "login_failed"
LOGIN_INACTIVE = "login_inactive"          # right password, deactivated account
REGISTER_SUCCESS = "register_success"
REGISTER_REJECTED = "register_rejected"    # the email already had an account
PASSWORD_CHANGE_SUCCESS = "password_change_success"
PASSWORD_CHANGE_FAILED = "password_change_failed"
EMAIL_VERIFIED = "email_verified"
EMAIL_VERIFY_FAILED = "email_verify_failed"
VERIFICATION_SENT = "verification_sent"
PASSWORD_RESET_REQUESTED = "password_reset_requested"
PASSWORD_RESET_SUCCESS = "password_reset_success"
PASSWORD_RESET_FAILED = "password_reset_failed"

# Add with the other limits:
VERIFICATION_WINDOW = timedelta(hours=1)
VERIFICATION_EMAILS_PER_USER = 4   # verification emails per student per hour
VERIFY_FAILS_PER_IP = 10           # wrong/expired verification links per IP in the window
RESET_WINDOW = timedelta(hours=1)
RESET_REQUESTS_PER_EMAIL = 3    # reset emails per address per hour (even unknown ones)
RESET_REQUESTS_PER_IP = 10      # reset requests per IP per hour
RESET_FAILS_PER_IP = 10         # wrong or expired reset links per IP in the 15-minute window


# ---------------------------------------------------------------------------
# Who is calling?
# ---------------------------------------------------------------------------

def get_client_ip(request: Request) -> str | None:
    """
    The visitor's IP address.

    Behind a proxy (such as Railway) every request seems to come from the
    proxy, so we read X-Forwarded-For instead. Anyone can send that header
    themselves, so we only trust the entry added by OUR proxy: the one
    TRUSTED_PROXY_COUNT places from the right. The default (0) ignores the
    header, which is correct for local development.
    """
    count = settings.trusted_proxy_count
    forwarded = request.headers.get("x-forwarded-for")
    if count > 0 and forwarded:
        parts = [part.strip() for part in forwarded.split(",") if part.strip()]
        if len(parts) >= count:
            return parts[-count][:45]

    if request.client:
        return request.client.host[:45]
    return None


def normalize_email(email: str) -> str:
    """Capital letters must not give an attacker a fresh set of attempts."""
    return email.strip().lower()


# ---------------------------------------------------------------------------
# Writing the log
# ---------------------------------------------------------------------------

def record_event(
    db: Session,
    event_type: str,
    request: Request,
    email: str | None = None,
    user_id: str | None = None,
) -> None:
    """
    Writes one event to the log and saves it straight away (so it is kept
    even when the request then fails with an error).
    """
    db.add(
        AuthEvent(
            event_type=event_type,
            email=normalize_email(email) if email else None,
            user_id=user_id,
            ip_address=get_client_ip(request),
            user_agent=(request.headers.get("user-agent") or "")[:255] or None,
        )
    )
    db.commit()

    logger.info("auth event", extra={"event_type": event_type})

    # Tidy up old rows now and then (a successful login is a good moment)
    if event_type == LOGIN_SUCCESS:
        cutoff = datetime.now(timezone.utc) - KEEP_EVENTS_FOR
        db.query(AuthEvent).filter(AuthEvent.created_at < cutoff).delete(
            synchronize_session=False
        )
        db.commit()


# ---------------------------------------------------------------------------
# Counting recent events
# ---------------------------------------------------------------------------

def _recent_times(
    db: Session,
    event_types: list[str],
    window: timedelta,
    limit: int,
    email: str | None = None,
    ip: str | None = None,
    user_id: str | None = None,
    after: datetime | None = None,
) -> list[datetime]:
    """
    The times of the newest `limit` matching events inside the window,
    newest first. `after` ignores anything older than that moment.
    """
    since = datetime.now(timezone.utc) - window
    if after is not None and after > since:
        since = after

    query = db.query(AuthEvent.created_at).filter(
        AuthEvent.event_type.in_(event_types),
        AuthEvent.created_at > since,
    )
    if email is not None:
        query = query.filter(AuthEvent.email == email)
    if ip is not None:
        query = query.filter(AuthEvent.ip_address == ip)
    if user_id is not None:
        query = query.filter(AuthEvent.user_id == user_id)

    rows = query.order_by(AuthEvent.created_at.desc()).limit(limit).all()
    return [row[0] for row in rows]


def _last_time(
    db: Session,
    event_type: str,
    email: str | None = None,
    user_id: str | None = None,
) -> datetime | None:
    """When the last event of this kind happened (for example the last good login)."""
    query = db.query(func.max(AuthEvent.created_at)).filter(
        AuthEvent.event_type == event_type
    )
    if email is not None:
        query = query.filter(AuthEvent.email == email)
    if user_id is not None:
        query = query.filter(AuthEvent.user_id == user_id)
    return query.scalar()


def _too_many(times_newest_first: list[datetime], window: timedelta, what: str) -> HTTPException:
    """
    Builds the "slow down" answer. The block ends when the oldest of the
    counted events leaves the time window.
    """
    unlock_at = times_newest_first[-1] + window
    seconds = max(1, int((unlock_at - datetime.now(timezone.utc)).total_seconds()))
    minutes = max(1, (seconds + 59) // 60)
    unit = "minute" if minutes == 1 else "minutes"
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Too many {what}. Please try again in {minutes} {unit}.",
        headers={"Retry-After": str(seconds)},
    )


# ---------------------------------------------------------------------------
# The checks the routes call BEFORE doing the real work
# ---------------------------------------------------------------------------

def check_login_allowed(db: Session, request: Request, email: str) -> None:
    """
    Raises a 429 if this email or this IP has failed too often recently.
    The answer is the same whether or not the email has an account.
    """
    email = normalize_email(email)
    ip = get_client_ip(request)

    
    # A good login, or a password reset, clears the count for that email: an
    # honest student who mistyped a few times (or reset a forgotten password)
    # is not punished later.
    last_good_login = _last_time(db, LOGIN_SUCCESS, email=email)
    last_reset = _last_time(db, PASSWORD_RESET_SUCCESS, email=email)
    cleared_at = max(
        (moment for moment in (last_good_login, last_reset) if moment is not None),
        default=None,
    )
    by_email = _recent_times(
        db, [LOGIN_FAILED], WINDOW, LOGIN_FAILS_PER_EMAIL,
        email=email, after=cleared_at,
    )
    if len(by_email) >= LOGIN_FAILS_PER_EMAIL:
        logger.warning("login blocked: too many failures for one email")
        raise _too_many(by_email, WINDOW, "failed login attempts")

    if ip:
        by_ip = _recent_times(db, [LOGIN_FAILED], WINDOW, LOGIN_FAILS_PER_IP, ip=ip)
        if len(by_ip) >= LOGIN_FAILS_PER_IP:
            logger.warning("login blocked: too many failures from one IP")
            raise _too_many(by_ip, WINDOW, "failed login attempts")


def check_register_allowed(db: Session, request: Request) -> None:
    """Raises a 429 if this IP has tried to create too many accounts recently."""
    ip = get_client_ip(request)
    if not ip:
        return

    attempts = _recent_times(
        db,
        [REGISTER_SUCCESS, REGISTER_REJECTED],
        REGISTER_WINDOW,
        REGISTER_ATTEMPTS_PER_IP,
        ip=ip,
    )
    if len(attempts) >= REGISTER_ATTEMPTS_PER_IP:
        logger.warning("registration blocked: too many attempts from one IP")
        raise _too_many(attempts, REGISTER_WINDOW, "sign-up attempts")


def check_password_change_allowed(db: Session, user_id: str) -> None:
    """Raises a 429 after too many wrong 'current password' answers."""
    last_change = _last_time(db, PASSWORD_CHANGE_SUCCESS, user_id=user_id)
    failures = _recent_times(
        db, [PASSWORD_CHANGE_FAILED], WINDOW, PASSWORD_FAILS_PER_USER,
        user_id=user_id, after=last_change,
    )
    if len(failures) >= PASSWORD_FAILS_PER_USER:
        logger.warning("password change blocked: too many wrong passwords")
        raise _too_many(failures, WINDOW, "incorrect password attempts")



def check_verification_resend_allowed(db: Session, user_id: str) -> None:
    """Raises a 429 if too many verification emails were sent to this student recently."""
    sent = _recent_times(
        db,
        [VERIFICATION_SENT],
        VERIFICATION_WINDOW,
        VERIFICATION_EMAILS_PER_USER,
        user_id=user_id,
    )
    if len(sent) >= VERIFICATION_EMAILS_PER_USER:
        logger.warning("verification email blocked: too many requests")
        raise _too_many(sent, VERIFICATION_WINDOW, "verification email requests")


def check_verify_allowed(db: Session, request: Request) -> None:
    """Raises a 429 if this IP keeps sending wrong or expired verification links."""
    ip = get_client_ip(request)
    if not ip:
        return

    failures = _recent_times(
        db, [EMAIL_VERIFY_FAILED], WINDOW, VERIFY_FAILS_PER_IP, ip=ip
    )
    if len(failures) >= VERIFY_FAILS_PER_IP:
        logger.warning("email verification blocked: too many failures from one IP")
        raise _too_many(failures, WINDOW, "failed verification attempts")

def check_reset_request_allowed(db: Session, request: Request, email: str) -> None:
    """
    Raises a 429 if too many reset emails were requested for this address or
    from this IP. Unknown addresses count too, so the answer reveals nothing.
    """
    email = normalize_email(email)
    ip = get_client_ip(request)

    by_email = _recent_times(
        db, [PASSWORD_RESET_REQUESTED], RESET_WINDOW, RESET_REQUESTS_PER_EMAIL,
        email=email,
    )
    if len(by_email) >= RESET_REQUESTS_PER_EMAIL:
        logger.warning("password reset blocked: too many requests for one email")
        raise _too_many(by_email, RESET_WINDOW, "password reset requests")

    if ip:
        by_ip = _recent_times(
            db, [PASSWORD_RESET_REQUESTED], RESET_WINDOW, RESET_REQUESTS_PER_IP,
            ip=ip,
        )
        if len(by_ip) >= RESET_REQUESTS_PER_IP:
            logger.warning("password reset blocked: too many requests from one IP")
            raise _too_many(by_ip, RESET_WINDOW, "password reset requests")


def check_reset_allowed(db: Session, request: Request) -> None:
    """Raises a 429 if this IP keeps sending wrong or expired reset links."""
    ip = get_client_ip(request)
    if not ip:
        return

    failures = _recent_times(
        db, [PASSWORD_RESET_FAILED], WINDOW, RESET_FAILS_PER_IP, ip=ip
    )
    if len(failures) >= RESET_FAILS_PER_IP:
        logger.warning("password reset blocked: too many failures from one IP")
        raise _too_many(failures, WINDOW, "failed reset attempts")    