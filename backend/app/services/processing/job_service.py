"""
Processing job orchestration for BAI2.

This is the reference implementation of the pattern every future
pipeline (translation, OCR, data extraction, lease abstraction) follows:
  1. Save the uploaded file to storage, create a ProcessingJob(queued).
  2. Run the actual pipeline logic (here: parse_bai2).
  3. On success: store the structured result, bill the user's wallet
     at their plan's rate for this service, mark the job completed.
  4. On failure: mark the job failed with the error message, charge
     nothing.

The AI-driven pipelines will replace step 2 with an LLM call and will
take longer (so likely move to a background worker rather than running
inline in the request as this does), but steps 1, 3, and 4 stay
identical - that's the point of routing everything through
ProcessingJob rather than each pipeline inventing its own job-tracking
shape.
"""
import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.storage import get_storage, new_storage_key
from app.models.plan import Plan, ServiceCode
from app.models.processing_job import JobStatus, ProcessingJob
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User
from app.services.billing_service import get_wallet_balance
from app.services.processing.bai2_service import Bai2ParseError, bai2_to_dict, parse_bai2


def process_bai2_upload(db: Session, user: User, filename: str, raw_bytes: bytes) -> ProcessingJob:
    plan = db.get(Plan, user.plan_id)
    price = plan.price_for(ServiceCode.bai2)

    balance = get_wallet_balance(db, user.id)
    if balance < price:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"Processing a BAI2 file on your plan costs {plan.currency} {price}, but your "
            f"wallet only has {plan.currency} {balance}. Add balance and try again.",
        )

    storage = get_storage()
    source_key = new_storage_key(user.id, "bai2", filename)
    storage.save(source_key, raw_bytes)

    job = ProcessingJob(
        user_id=user.id,
        service_code=ServiceCode.bai2,
        status=JobStatus.processing,
        original_filename=filename,
        source_storage_key=source_key,
        billed_amount=0,
    )
    db.add(job)
    db.flush()

    try:
        text = raw_bytes.decode("utf-8", errors="replace")
        parsed = parse_bai2(text)
        result = bai2_to_dict(parsed)
    except Bai2ParseError as err:
        job.status = JobStatus.failed
        job.error_message = str(err)
        db.commit()
        db.refresh(job)
        return job

    result_key = f"{source_key}.result.json"
    storage.save(result_key, json.dumps(result, indent=2).encode("utf-8"))

    job.status = JobStatus.completed
    job.result_storage_key = result_key
    job.result_metadata = result
    job.billed_amount = price
    job.page_count = sum(len(a["transactions"]) for g in result["groups"] for a in g["accounts"])

    if price > 0:
        db.add(Transaction(
            user_id=user.id,
            type=TransactionType.service_charge,
            status=TransactionStatus.success,
            description=f"BAI2 processing - {filename}",
            debit=price,
        ))

    db.commit()
    db.refresh(job)
    return job
