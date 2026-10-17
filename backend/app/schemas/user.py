from pydantic import BaseModel, EmailStr, Field, field_validator


class UpdateProfileRequest(BaseModel):
    """
    Fields the user can update on their profile.
    All fields are optional — the user can update one or all at once.
    Only the fields provided will be updated; the rest stay unchanged.
    """
    full_name: str | None = Field(default=None, min_length=2, max_length=255)
    university: str | None = Field(default=None, max_length=255)
    programme: str | None = Field(default=None, max_length=255)
    level: str | None = Field(default=None, max_length=50)
    semester: str | None = Field(default=None, max_length=50)
    academic_year: str | None = Field(default=None, max_length=50)


class ChangePasswordRequest(BaseModel):
    """
    Data required to change the user's password.
    The current password must be provided to confirm identity.
    """
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def password_fits_bcrypt(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password is too long. Use at most 72 characters.")
        return value