from pydantic import BaseModel, EmailStr, Field, field_validator
from datetime import datetime

class RegisterRequest(BaseModel):
    """Data required to create a new account."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        # bcrypt only reads the first 72 BYTES (symbols can take 2-4 bytes each)
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long. Use at most 72 characters.")
        return value


class LoginRequest(BaseModel):
    """Data required to log in."""
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    university: str | None
    programme: str | None
    level: str | None
    semester: str | None
    academic_year: str | None
    is_active: bool
    has_gemini_api_key: bool = False  
    onboarding_completed: bool = False
    email_verified: bool = False
    has_avatar: bool = False
    avatar_updated_at: datetime | None = None
    model_config = {"from_attributes": True}


class VerifyEmailRequest(BaseModel):
    """The secret from the verification link in the email."""
    token: str = Field(..., min_length=10, max_length=200)

class MessageResponse(BaseModel):
    """Generic message response for simple confirmations."""
    message: str

class GeminiKeyRequest(BaseModel):
    """Student's personal Google Gemini API key."""
    api_key: str = Field(..., min_length=20, max_length=255)


class GeminiKeyResponse(BaseModel):
    message: str
    has_gemini_api_key: bool    
class ForgotPasswordRequest(BaseModel):
    """The email address of the account to recover."""
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """The secret from the reset link, and the new password."""
    token: str = Field(..., min_length=10, max_length=200)
    new_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        # bcrypt only reads the first 72 BYTES (symbols can take 2-4 bytes each)
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long. Use at most 72 characters.")
        return value
