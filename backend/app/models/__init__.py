"""
Importing this package (which Alembic's env.py does) registers every
model on `Base.metadata`. Add a new model file -> import it here -> it's
now visible to `alembic revision --autogenerate`. Miss this step and
autogenerate will silently produce an empty migration, which is a classic
footgun this file exists to prevent.
"""
from app.models.company import CompanyProfile  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.plan import Plan, PlanServicePricing, ServiceCode  # noqa: F401
from app.models.processing_job import ProcessingJob, JobStatus  # noqa: F401
from app.models.support import SupportTicket, SupportTicketMessage, TicketStatus  # noqa: F401
from app.models.transaction import Transaction, TransactionStatus, TransactionType  # noqa: F401
from app.models.user import ApiKeyStatus, EmailVerificationToken, PlanStatus, User, UserRole, UserStatus  # noqa: F401

__all__ = [
    "CompanyProfile",
    "Notification",
    "Plan",
    "PlanServicePricing",
    "ServiceCode",
    "ProcessingJob",
    "JobStatus",
    "SupportTicket",
    "SupportTicketMessage",
    "TicketStatus",
    "Transaction",
    "TransactionStatus",
    "TransactionType",
    "ApiKeyStatus",
    "EmailVerificationToken",
    "PlanStatus",
    "User",
    "UserRole",
    "UserStatus",
]
