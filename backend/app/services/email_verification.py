from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.services.auth_tokens import VERIFY_EMAIL, create_token
from app.services.email_sender import send_email
from html import escape

# How long a verification link works
VERIFICATION_LINK_LIFETIME = timedelta(hours=24)


def build_verification_email(full_name: str, link: str) -> tuple[str, str, str]:
    """Returns (subject, plain text, html) for the verification email."""
    first_name = full_name.strip().split(" ")[0] or "there"
    subject = "Verify your email address for Lebid"

    text = (
        f"Hi {first_name},\n\n"
        "Please confirm your email address to finish setting up your Lebid account:\n\n"
        f"{link}\n\n"
        "This link works for 24 hours and can be used once.\n"
        "If you did not create a Lebid account, you can ignore this email.\n"
    )
    html = (
        f"<p>Hi {escape(first_name)},</p>"
        "<p>Please confirm your email address to finish setting up your Lebid account:</p>"
        f'<p><a href="{link}">Verify my email address</a></p>'
        "<p>This link works for 24 hours and can be used once.<br>"
        "If you did not create a Lebid account, you can ignore this email.</p>"
    )
    return subject, text, html


def queue_verification_email(
    db: Session, user: User, background_tasks: BackgroundTasks
) -> None:
    """
    Creates a fresh verification link for the student and sends it AFTER the
    answer has gone back to the browser, so a slow email service never makes
    the student wait.
    """
    raw_token = create_token(db, user.id, VERIFY_EMAIL, VERIFICATION_LINK_LIFETIME)
    link = f"{settings.frontend_url.rstrip('/')}/verify-email?token={raw_token}"
    subject, text, html = build_verification_email(user.full_name, link)
    background_tasks.add_task(send_email, user.email, subject, text, html)