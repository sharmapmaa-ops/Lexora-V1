"""
Wallet transaction ledger.

Fixes vs. the old project:
  - `credit` / `debit` are NUMERIC(12, 2), never float - the old project
    stored money as JS numbers/Python floats throughout, which is how
    rounding drift creeps into a balance over thousands of transactions.
  - `status` is a real enum, not a string that different code paths
    spelled inconsistently ("pending_approval" vs "Pending Approval").
  - Every row is indexed by (user_id, created_at) since "this user's
    history, newest first" is the only query pattern that matters here.
"""
import enum
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TransactionType(str, enum.Enum):
    wallet_topup = "wallet_topup"
    plan_subscription = "plan_subscription"
    service_charge = "service_charge"  # per-page/per-document billing for a processed job
    refund = "refund"
    adjustment = "adjustment"  # manual admin correction


class TransactionStatus(str, enum.Enum):
    pending = "pending"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"


class Transaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_user_created", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType, name="transaction_type"), nullable=False)
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, name="transaction_status"), default=TransactionStatus.success, nullable=False
    )
    description: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(60), default="Wallet Balance", nullable=False)

    credit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    debit: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    # Razorpay linkage for wallet top-ups - nullable because most
    # transaction types (service charges, plan switches) never touch
    # the payment gateway at all.
    razorpay_order_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    razorpay_payment_id: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)

    user = relationship("User", back_populates="transactions")
