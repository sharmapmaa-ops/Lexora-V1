"""
Company profile.

The old project stored this as a single JSONB blob under a generic
"settings" table, which is why the Admin Panel table browser had no
real columns to show for it. It's a singleton (exactly one row) by
convention, enforced with a CheckConstraint on id=1 rather than an
application-level assumption.
"""
from typing import Optional

from sqlalchemy import CheckConstraint, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.mixins import TimestampMixin


class CompanyProfile(TimestampMixin, Base):
    __tablename__ = "company_profile"
    __table_args__ = (CheckConstraint("id = 1", name="ck_company_profile_singleton"),)

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    whatsapp: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    working_hours: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    working_days: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)

    # Social links genuinely are an unordered bag of {platform: url} -
    # a JSONB column here is the honest choice, not a shortcut.
    social_links: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)
