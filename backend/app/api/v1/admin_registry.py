"""
Admin table registry.

The old project's Admin Panel had bespoke, hand-written HTML/JS for
every single table, which is exactly why it took three attempts to get
column headers, scrolling, and pagination right - each table was really
its own mini-feature. Here, being "admin manageable" is a declarative
fact about a model (`AdminRegistry.register(...)`), and the CRUD route
(app/api/v1/routes/admin.py) is generic: it works for every registered
model without knowing anything about lease files vs. plans vs. company
settings specifically.
"""
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.orm import DeclarativeBase


@dataclass
class AdminTableSpec:
    model: type[DeclarativeBase]
    display_name: str
    # Columns that exist on the model but must never be sent to the
    # browser (password hashes, OTP codes, ...) - excluded at the
    # serialization boundary, not by convention.
    hidden_fields: set[str] = field(default_factory=set)
    # Columns the admin UI may show but not edit (e.g. a primary key
    # other rows reference by value).
    readonly_fields: set[str] = field(default_factory=set)
    default_sort: str = "created_at"


class AdminRegistry:
    _tables: dict[str, AdminTableSpec] = {}

    @classmethod
    def register(cls, name: str, spec: AdminTableSpec) -> None:
        cls._tables[name] = spec

    @classmethod
    def get(cls, name: str) -> AdminTableSpec | None:
        return cls._tables.get(name)

    @classmethod
    def all(cls) -> dict[str, AdminTableSpec]:
        return dict(cls._tables)


def _register_defaults() -> None:
    # Imported lazily (inside the function) to avoid a circular import
    # between this module and app.models at package load time.
    from app.models.company import CompanyProfile
    from app.models.notification import Notification
    from app.models.plan import Plan, PlanServicePricing
    from app.models.processing_job import ProcessingJob
    from app.models.support import SupportTicket
    from app.models.transaction import Transaction
    from app.models.user import User

    AdminRegistry.register("users", AdminTableSpec(
        model=User, display_name="Users",
        hidden_fields={"password_hash", "api_key"},
        readonly_fields={"id"},
    ))
    AdminRegistry.register("plans", AdminTableSpec(
        model=Plan, display_name="Plans", readonly_fields={"id"},
    ))
    AdminRegistry.register("plan_service_pricing", AdminTableSpec(
        model=PlanServicePricing, display_name="Plan Service Pricing", readonly_fields={"id"},
    ))
    AdminRegistry.register("transactions", AdminTableSpec(
        model=Transaction, display_name="Transactions", readonly_fields={"id"},
    ))
    AdminRegistry.register("notifications", AdminTableSpec(
        model=Notification, display_name="Notifications", readonly_fields={"id"},
    ))
    AdminRegistry.register("support_tickets", AdminTableSpec(
        model=SupportTicket, display_name="Support Tickets", readonly_fields={"id"},
    ))
    AdminRegistry.register("processing_jobs", AdminTableSpec(
        model=ProcessingJob, display_name="Processing Jobs", readonly_fields={"id"},
    ))
    AdminRegistry.register("company_profile", AdminTableSpec(
        model=CompanyProfile, display_name="Company Profile", readonly_fields={"id"},
    ))
    # Note: no "activity log" table is registered here on purpose - per-
    # job activity is a live/ephemeral concept (see ProcessingJob status
    # updates, pushed over the /ws/jobs websocket in the frontend), not
    # a permanent admin-browsable table. That mirrors the explicit
    # decision made on the old project: activity log should only be
    # visible while a job is actually running, not archived forever.


_register_defaults()
