"""
Plan + per-service pricing.

Fixes vs. the old project:
  - The old `plans` row had a hardcoded `pricePerTranslation` /
    `pricePerLeaseAbstraction` column per billable service. Adding a new
    billable service meant an ALTER TABLE. Three of those services (OCR,
    Data Extraction, BAI2) ended up just reusing the Translation column
    anyway because nobody had added dedicated ones - that was the actual
    bug, not a display bug.
  - Here, `plan_service_pricing` is a normal child table: one row per
    (plan, service). Adding a new billable service, or giving it its own
    rate on a specific plan, is a data change - no migration required.
  - `monthly_price` and `price` are NUMERIC, not float - money is never
    a float in this codebase.
"""
import enum
from decimal import Decimal
from typing import List

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class ServiceCode(str, enum.Enum):
    translation = "translation"
    ocr = "ocr"
    data_extraction = "data_extraction"
    bai2 = "bai2"
    lease_abstraction = "lease_abstraction"


class Plan(TimestampMixin, Base):
    __tablename__ = "plans"

    # Slug id ("free" / "standard" / "professional") rather than a UUID -
    # plans are a small, hand-curated list referenced by human-readable
    # code throughout the app and in support conversations; a slug is
    # more useful here than a surrogate key would be.
    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    icon: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    monthly_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sort_order: Mapped[int] = mapped_column(default=0, nullable=False)

    # Short editorial bullet list ("Email Support", "API Documentation
    # Access", ...) - genuinely unstructured marketing copy, a JSONB
    # array is the right tool here (unlike pricing, which needs to be
    # queried/summed and belongs in a real column).
    features: Mapped[List[str]] = mapped_column(JSONB, default=list, server_default="[]", nullable=False)

    service_pricing = relationship(
        "PlanServicePricing", back_populates="plan", cascade="all, delete-orphan"
    )
    users = relationship("User", back_populates="plan")

    def price_for(self, service: ServiceCode) -> Decimal:
        for row in self.service_pricing:
            if row.service_code == service:
                return row.price
        return Decimal("0.00")


class PlanServicePricing(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "plan_service_pricing"
    __table_args__ = (UniqueConstraint("plan_id", "service_code", name="uq_plan_service"),)

    plan_id: Mapped[str] = mapped_column(String(40), ForeignKey("plans.id"), nullable=False, index=True)
    service_code: Mapped[ServiceCode] = mapped_column(Enum(ServiceCode, name="service_code"), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), default="page", nullable=False)  # 'page' | 'document'
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)

    plan = relationship("Plan", back_populates="service_pricing")
