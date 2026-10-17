from datetime import datetime, timedelta, timezone
from html import escape

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.services.auth_tokens import RESET_PASSWORD, create_token
from app.services.email_sender import send_email

# How long a password reset link works. Short, because it is powerful.
RESET_LINK_LIFETIME = timedelta(minutes=30)


def _first_name(full_name: str) -> str:
    return full_name.strip().split(" ")[0] or "there"


def build_reset_email(full_name: str, link: str) -> tuple[str, str, str]:
    """Returns (subject, plain text, html) for the password reset email."""
    name = _first_name(full_name)
    subject = "Reset your Lebid password"

    text = (
        f"Hi {name},\n\n"
        "We received a request to reset the password of your Lebid account. "
        "Use this link to choose a new one:\n\n"
        f"{link}\n\n"
        "This link works for 30 minutes and can be used once.\n"
        "If you did not ask for this, you can ignore this email: "
        "your password has not been changed.\n"
    )
    html = (
        f"<p>Hi {escape(name)},</p>"
        "<p>We received a request to reset the password of your Lebid account. "
        "Use this link to choose a new one:</p>"
        f'<p><a href="{link}">Choose a new password</a></p>'
        "<p>This link works for 30 minutes and can be used once.<br>"
        "If you did not ask for this, you can ignore this email: "
        "your password has not been changed.</p>"
    )
    return subject, text, html


def build_password_changed_email(full_name: str) -> tuple[str, str, str]:
    """Returns (subject, plain text, html) for the 'your password was changed' notice."""
    name = _first_name(full_name)
    when = datetime.now(timezone.utc).strftime("%d %B %Y, %H:%M UTC")
    recover_link = f"{settings.frontend_url.rstrip('/')}/forgot-password"
    subject = "Your Lebid password was changed"

    text = (
        f"Hi {name},\n\n"
        f"The password of your Lebid account was changed on {when}, "
        "and you were signed out on your other devices.\n\n"
        "If this was you, there is nothing more to do.\n"
        "If it was NOT you, reset your password right away:\n\n"
        f"{recover_link}\n"
    )
    html = (
        f"<p>Hi {escape(name)},</p>"
        f"<p>The password of your Lebid account was changed on {when}, "
        "and you were signed out on your other devices.</p>"
        "<p>If this was you, there is nothing more to do.<br>"
        f'If it was <strong>not</strong> you, <a href="{recover_link}">reset your password right away</a>.</p>'
    )
    return subject, text, html


def queue_reset_email(
    db: Session, user: User, background_tasks: BackgroundTasks
) -> None:
    """Creates a reset link and sends it after the answer has gone back."""
    raw_token = create_token(db, user.id, RESET_PASSWORD, RESET_LINK_LIFETIME)
    link = f"{settings.frontend_url.rstrip('/')}/reset-password?token={raw_token}"
    subject, text, html = build_reset_email(user.full_name, link)
    background_tasks.add_task(send_email, user.email, subject, text, html)


def queue_password_changed_email(
    user: User, background_tasks: BackgroundTasks
) -> None:
    """Tells the student their password changed (a safety net against hijacking)."""
    subject, text, html = build_password_changed_email(user.full_name)
    background_tasks.add_task(send_email, user.email, subject, text, html)