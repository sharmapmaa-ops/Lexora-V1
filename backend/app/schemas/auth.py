"""
Auth request/response schemas.

These are deliberately separate from the SQLAlchemy models (app/models).
A Pydantic schema controls exactly what a client can send in and exactly
what comes back out - it is the one place that decides "password_hash
never leaves this server", not a masking function bolted onto a generic
serializer after the fact.
"""
import datetime
import uuid

from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    mobile: str | None = None

    @field_validator("password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _password_strength(cls, v: str) -> str:
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit.")
        if not any(c.isalpha() for c in v):
            raise ValueError("Password must contain at least one letter.")
        return v


class UserPublic(BaseModel):
    """What the frontend is allowed to see about a user - never the
    password hash, never a raw OTP. This is the read-model referenced
    by every route that returns "the current user" or "a user row"."""
    id: uuid.UUID
    email: str
    first_name: str
    last_name: str
    mobile: str | None
    gender: str | None
    birthdate: datetime.date | None
    photo_url: str | None
    role: str
    status: str
    is_locked: bool
    email_verified: bool
    two_factor_enabled: bool
    plan_id: str
    plan_status: str
    plan_ends_at: datetime.date | None
    api_key: str | None
    api_key_status: str | None
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
