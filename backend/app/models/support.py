"""
Support ticket model.

The old project had an ambiguous split between "Contact Submissions"
and "Support Log" that were never clearly differentiated in the code or
the UI. Here there's exactly one concept: a SupportTicket, with a
threaded list of messages (a user raising an issue and the replies that
follow both live in `support_ticket_messages`, ordered by
`created_at`) - so "the conversation" is a real, queryable thing instead
of two separate, loosely-related records.
"""
import enum
import uuid
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class TicketStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class SupportTicket(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "support_tickets"
    __table_args__ = (Index("ix_support_tickets_user_created", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[TicketStatus] = mapped_column(
        Enum(TicketStatus, name="ticket_status"), default=TicketStatus.open, nullable=False
    )
    # Set when a ticket originates from a transaction the user is
    # disputing ("Raise Issue" on a Payment History row) - nullable
    # because most tickets are general support requests.
    related_transaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("transactions.id"), nullable=True
    )

    user = relationship("User", back_populates="support_tickets")
    messages = relationship(
        "SupportTicketMessage", back_populates="ticket", cascade="all, delete-orphan",
        order_by="SupportTicketMessage.created_at",
    )


class SupportTicketMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "support_ticket_messages"

    ticket_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("support_tickets.id"), nullable=False)
    author_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)

    ticket = relationship("SupportTicket", back_populates="messages")
