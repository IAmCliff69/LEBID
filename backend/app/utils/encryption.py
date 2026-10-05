import logging

from cryptography.fernet import Fernet, InvalidToken
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Encryption for secrets stored in the database (e.g. Gemini API keys).
#
# We use Fernet (from the "cryptography" package). It encrypts AND signs the
# data, so a stolen database dump is useless without ENCRYPTION_KEY, and
# tampered values are detected instead of silently accepted.
# ---------------------------------------------------------------------------

try:
    _fernet = Fernet(settings.encryption_key.encode())
except (ValueError, TypeError) as error:
    raise RuntimeError(
        "ENCRYPTION_KEY in your .env file is missing or invalid. Generate one with:\n"
        '  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"'
    ) from error


def encrypt_secret(plaintext: str) -> str:
    """Turns a secret into an unreadable token that is safe to store."""
    return _fernet.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(token: str) -> str | None:
    """
    Turns a stored token back into the original secret.
    Returns None (instead of crashing) if the token cannot be read, for example
    if ENCRYPTION_KEY was changed. The student is then simply asked to enter
    their key again.
    """
    try:
        return _fernet.decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        logger.warning("A stored secret could not be decrypted (wrong ENCRYPTION_KEY?).")
        return None


class EncryptedString(TypeDecorator):
    """
    A database column type that encrypts on the way IN and decrypts on the way OUT.

    The rest of the app keeps using `user.gemini_api_key` as normal plain text,
    while the database only ever stores the encrypted token.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        # Python -> database
        if value is None:
            return None
        return encrypt_secret(value)

    def process_result_value(self, value, dialect):
        # database -> Python
        if value is None:
            return None
        return decrypt_secret(value)