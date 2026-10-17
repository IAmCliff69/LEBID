import logging
from typing import Any

from app.config import settings

logger = logging.getLogger("lebid.email")

# Emails "sent" by the test backend, so tests can read them. Only the
# "memory" backend fills this.
sent_emails: list[dict[str, Any]] = []


def send_email(
    to: str, subject: str, text_body: str, html_body: str | None = None
) -> None:
    """
    Sends one email using the backend chosen by the EMAIL_BACKEND setting:

      console  Development: prints the email in the server terminal.
               Nothing is really sent. (Default.)
      memory   Tests: keeps the email in a list.

    A real provider (Resend, Brevo...) is added later as another backend.
    This function never raises: a failed email is logged, and the request
    that wanted it carries on.
    """
    backend = settings.email_backend.lower()
    try:
        if backend == "memory":
            sent_emails.append(
                {"to": to, "subject": subject, "text": text_body, "html": html_body}
            )
        elif backend == "console":
            _print_to_console(to, subject, text_body)
        else:
            logger.error(
                "Unknown EMAIL_BACKEND %r: an email was NOT sent.", backend
            )
    except Exception:
        logger.exception("Sending an email failed")


def _print_to_console(to: str, subject: str, text_body: str) -> None:
    # Links in emails are secrets. Never write them into production logs.
    if settings.app_env.lower() == "production":
        logger.warning(
            "No email provider is set up (EMAIL_BACKEND=console), so an email was not sent."
        )
        return

    logger.info(
        "\n================ EMAIL (console mode: nothing was really sent) ================\n"
        "To: %s\nSubject: %s\n\n%s\n"
        "===============================================================================",
        to,
        subject,
        text_body,
    )