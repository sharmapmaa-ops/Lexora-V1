"""
Processing job.

One generic table for every "user uploads a file, an AI pipeline
processes it, a result comes back" service (lease abstraction,
translation, OCR, data extraction, BAI2). The old project gave each of
these its own bespoke *-files / *-activity-log JSON resource with
near-identical shape - that duplication is exactly what a `service_code`
discriminator column is for.

This table intentionally does NOT store the actual AI pipeline logic -
that belongs in `app/services/processing/<service_code>.py` modules
(ported from the old project's lease_engine.py / translation
pipeline / etc. in a follow-up pass). This model is the tracking record:
what was uploaded, what state it's in, where the result lives, and what
it was billed.
"""
import enum
import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import Enum, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin
from app.models.plan import ServiceCode


class JobStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ProcessingJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "processing_jobs"
    __table_args__ = (Index("ix_processing_jobs_user_created", "user_id", "created_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    service_code: Mapped[ServiceCode] = mapped_column(Enum(ServiceCode, name="service_code"), nullable=False)
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus, name="job_status"), default=JobStatus.queued, nullable=False)

    original_filename: Mapped[str] = mapped_column(String(300), nullable=False)
    page_count: Mapped[Optional[int]] = mapped_column(nullable=True)

    # Where the source file and the generated result live in object
    # storage (see app/core/storage.py) - a path/key, never raw bytes
    # in the database.
    source_storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    result_storage_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    billed_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    error_message: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Pipeline-specific structured output (extracted fields, detected
    # language, confidence scores, ...) - shape varies per service_code,
    # which is exactly the case JSONB is for.
    result_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}", nullable=False)

    user = relationship("User", back_populates="processing_jobs")
