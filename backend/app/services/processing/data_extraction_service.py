"""
Data extraction pipeline.

Same shape as TranslationService (text-in, LLM call, billed result) -
the only real difference is the prompt asks for structured JSON fields
back instead of translated prose, and the result is parsed as JSON
before being stored. Takes an `LlmClient` in its constructor for the
same reason TranslationService does: so
tests/test_data_extraction_service.py can substitute a fake client and
verify billing/storage/job-status logic without real API credentials.
"""
import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.llm import LlmClient
from app.core.storage import get_storage, new_storage_key
from app.models.plan import Plan, ServiceCode
from app.models.processing_job import JobStatus, ProcessingJob
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User
from app.services.billing_service import get_wallet_balance

SYSTEM_PROMPT = (
    "You are a document data-extraction assistant. Given a document's text and a "
    "list of fields to extract, respond with ONLY a JSON object mapping each "
    "requested field name to the value found in the text (or null if the field "
    "isn't present). No commentary, no markdown code fences - just the raw JSON object."
)


class DataExtractionError(Exception):
    pass


class DataExtractionService:
    def __init__(self, llm: LlmClient):
        self.llm = llm

    async def process_upload(
        self, db: Session, user: User, filename: str, raw_bytes: bytes, fields: list[str],
    ) -> ProcessingJob:
        plan = db.get(Plan, user.plan_id)
        price = plan.price_for(ServiceCode.data_extraction)

        balance = get_wallet_balance(db, user.id)
        if balance < price:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Data extraction on your plan costs {plan.currency} {price}/page, but your "
                f"wallet only has {plan.currency} {balance}. Add balance and try again.",
            )

        storage = get_storage()
        source_key = new_storage_key(user.id, "data_extraction", filename)
        storage.save(source_key, raw_bytes)

        job = ProcessingJob(
            user_id=user.id,
            service_code=ServiceCode.data_extraction,
            status=JobStatus.processing,
            original_filename=filename,
            source_storage_key=source_key,
            page_count=1,
            billed_amount=0,
        )
        db.add(job)
        db.flush()

        try:
            source_text = raw_bytes.decode("utf-8", errors="replace")
            user_prompt = (
                f"Fields to extract: {', '.join(fields)}\n\nDocument text:\n\n{source_text}"
            )
            raw_response = await self.llm.complete(SYSTEM_PROMPT, user_prompt)
            extracted = _parse_json_response(raw_response)
        except HTTPException:
            raise
        except Exception as err:  # noqa: BLE001 - LLM/parse failure fails the job, never charges
            job.status = JobStatus.failed
            job.error_message = str(err)
            db.commit()
            db.refresh(job)
            return job

        result = {"requested_fields": fields, "extracted": extracted}
        result_key = f"{source_key}.result.json"
        storage.save(result_key, json.dumps(result, indent=2).encode("utf-8"))

        job.status = JobStatus.completed
        job.result_storage_key = result_key
        job.result_metadata = result
        job.billed_amount = price

        if price > 0:
            db.add(Transaction(
                user_id=user.id,
                type=TransactionType.service_charge,
                status=TransactionStatus.success,
                description=f"Data extraction - {filename}",
                debit=price,
            ))

        db.commit()
        db.refresh(job)
        return job


def _parse_json_response(raw_response: str) -> dict:
    text = raw_response.strip()
    # Models occasionally wrap JSON in ```json fences despite being told
    # not to - strip that defensively rather than failing the whole job.
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as err:
        raise DataExtractionError(f"Model did not return valid JSON: {err}") from err
