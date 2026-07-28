import datetime

from pydantic import BaseModel, Field, field_validator


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    mobile: str | None = None
    gender: str | None = None
    birthdate: datetime.date | None = None
    two_factor_enabled: bool | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter.")
        return v


class MobileOtpVerifyRequest(BaseModel):
    code: str


class ApiKeyPublic(BaseModel):
    """What the API key endpoints return - deliberately NOT the full
    UserPublic. A developer calling /users/me/api-key to rotate their
    key has no reason to receive their role, lock status, plan dates,
    etc. back in the response; this keeps that surface area minimal."""
    api_key: str | None
    api_key_created_at: datetime.datetime | None
    api_key_status: str | None

    model_config = {"from_attributes": True}
