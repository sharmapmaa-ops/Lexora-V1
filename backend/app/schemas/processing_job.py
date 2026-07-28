import datetime
import uuid
from decimal import Decimal

from pydantic import BaseModel


class ProcessingJobPublic(BaseModel):
    id: uuid.UUID
    service_code: str
    status: str
    original_filename: str
    page_count: int | None
    billed_amount: Decimal
    error_message: str | None
    result_metadata: dict
    created_at: datetime.datetime

    model_config = {"from_attributes": True}
