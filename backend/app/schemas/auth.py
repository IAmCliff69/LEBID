from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    """Data required to create a new account."""
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


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

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    """Generic message response for simple confirmations."""
    message: str