from pydantic import BaseModel, Field


class CreateCourseRequest(BaseModel):
    """Data required to create a new course."""
    name: str = Field(..., min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    credit_hours: int | None = Field(default=None, ge=1, le=20)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    lecturer: str | None = Field(default=None, max_length=255)


class UpdateCourseRequest(BaseModel):
    """
    Fields that can be updated on a course.
    All fields are optional — only provided fields are updated.
    """
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    credit_hours: int | None = Field(default=None, ge=1, le=20)
    color: str | None = Field(default=None, pattern=r"^#[0-9A-Fa-f]{6}$")
    lecturer: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class CourseResponse(BaseModel):
    """Course data returned to the client."""
    id: str
    user_id: str
    name: str
    code: str | None
    credit_hours: int | None
    color: str | None
    lecturer: str | None
    is_active: bool

    model_config = {"from_attributes": True}