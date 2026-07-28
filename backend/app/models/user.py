"""
User model.

Fixes vs. the old project:
  - `plan_id` is a real foreign key to `plans.id`, not a free-text plan
    name copied onto every user row (that made renaming a plan a
    multi-table find-and-replace instead of one UPDATE).
  - `role` / `status` / `plan_status` are real Postgres enums, not
    arbitrary strings that any code path could mistype.
  - The API key lives directly on the user (one active key per user) -
    the old project kept a separate `api-keys` table purely because it
    grew that way historically; there was never a real reason for it.
  - Money-adjacent fields elsewhere reference this user by UUID, not a
    hand-rolled "U0000001" string.
  - `extra` is a narrow, deliberate escape hatch for genuinely
    unstructured per-user preferences (e.g. UI theme choice) - it is
    NOT where structured business data goes. If you find yourself
    reading `extra["something"]` in more than one place, that value
    should be promoted to a real column instead.
"""
import datetime
import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"
    developer = "developer"


class UserStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    pending_verification = "pending_verification"


class PlanStatus(str, enum.Enum):
    active = "active"
    expired = "expired"
    cancelled = "cancelled"


class ApiKeyStatus(str, enum.Enum):
    active = "active"
    revoked = "revoked"


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    gender: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    birthdate: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    mobile: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False
    )
    status: Mapped[UserStatus] = mapped_column(
        Enum(UserStatus, name="user_status"), default=UserStatus.pending_verification, nullable=False
    )
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    mobile_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    two_factor_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Plan is a real relationship, not a copied-in string.
    plan_id: Mapped[str] = mapped_column(
        String(40), ForeignKey("plans.id"), nullable=False, server_default="free"
    )
    plan_status: Mapped[PlanStatus] = mapped_column(
        Enum(PlanStatus, name="plan_status"), default=PlanStatus.active, nullable=False
    )
    plan_started_at: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)
    plan_ends_at: Mapped[Optional[datetime.date]] = mapped_column(Date, nullable=True)

    # One active API key per user (see module docstring for why this
    # replaced a standalone api_keys table).
    api_key: Mapped[Optional[str]] = mapped_column(String(80), unique=True, nullable=True)
    api_key_created_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    api_key_status: Mapped[Optional[ApiKeyStatus]] = mapped_column(
        Enum(ApiKeyStatus, name="api_key_status"), nullable=True
    )

    razorpay_customer_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    # Deliberately narrow escape hatch - see module docstring.
    extra: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)

    plan = relationship("Plan", back_populates="users")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    support_tickets = relationship("SupportTicket", back_populates="user", cascade="all, delete-orphan")
    processing_jobs = relationship("ProcessingJob", back_populates="user", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()


class EmailVerificationToken(UUIDPrimaryKeyMixin, Base):
    """OTP / verification codes live in their own short-lived table
    instead of overloading columns on the user row (the old project
    stored verification_code / verification_code_expires_at /
    verification_purpose directly on the user, which meant a user could
    only ever have one pending verification of any kind at a time)."""
    __tablename__ = "email_verification_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(40), nullable=False)  # 'signup' | 'password_reset' | 'login_otp'
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
