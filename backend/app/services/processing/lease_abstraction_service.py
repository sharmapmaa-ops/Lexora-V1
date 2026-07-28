"""
Lease abstraction pipeline.

A two-stage pipeline that combines the previous two pipelines' patterns
rather than inventing a third:
  1. Vision stage (same as OcrService): each rendered page goes to
     `LlmClient.complete_with_image` to get its raw text.
  2. Structuring stage (same as DataExtractionService): the combined
     text from every page goes to a single `LlmClient.complete` call
     asking for the specific lease fields a lease abstract needs
     (parties, term, rent, deposit, renewal options, ...).

Billed per DOCUMENT, not per page (unlike OCR) - matches how the old
project priced this service, and reflects that a lease abstract is one
deliverable regardless of whether the source lease was 4 pages or 40.

The old project's actual pipeline was a multi-agent system (multiple
specialized extraction passes, cross-validation between them, etc.).
This is a real, working, two-stage version of the same idea rather than
that full complexity - the extraction schema below can grow without
changing the surrounding job/billing/storage shape.
"""
import json

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.llm import LlmClient
from app.core.pdf_utils import PdfRenderError, render_pdf_pages
from app.core.storage import get_storage, new_storage_key
from app.models.plan import Plan, ServiceCode
from app.models.processing_job import JobStatus, ProcessingJob
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User
from app.services.billing_service import get_wallet_balance

OCR_SYSTEM_PROMPT = (
    "You are an OCR assistant. Transcribe ALL visible text in the image exactly as "
    "it appears, preserving line breaks and reading order. Respond with ONLY the "
    "transcribed text - no commentary, no markdown."
)

LEASE_FIELDS = [
    "landlord_name", "tenant_name", "property_address",
    "lease_start_date", "lease_end_date", "base_rent", "rent_currency",
    "security_deposit", "renewal_option", "escalation_terms",
]

EXTRACTION_SYSTEM_PROMPT = (
    "You are a lease abstraction assistant. Given the full text of a lease document, "
    f"extract these fields: {', '.join(LEASE_FIELDS)}. Respond with ONLY a JSON object "
    "mapping each field name to the value found in the text (or null if not present). "
    "No commentary, no markdown code fences - just the raw JSON object."
)


class LeaseAbstractionError(Exception):
    pass


class LeaseAbstractionService:
    def __init__(self, llm: LlmClient):
        self.llm = llm

    async def process_upload(
        self, db: Session, user: User, filename: str, raw_bytes: bytes,
    ) -> ProcessingJob:
        try:
            pages = render_pdf_pages(raw_bytes)
        except PdfRenderError as err:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, str(err)) from err

        plan = db.get(Plan, user.plan_id)
        price = plan.price_for(ServiceCode.lease_abstraction)  # flat per-document rate

        balance = get_wallet_balance(db, user.id)
        if balance < price:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Lease abstraction on your plan costs {plan.currency} {price} per document, "
                f"but your wallet only has {plan.currency} {balance}. Add balance and try again.",
            )

        storage = get_storage()
        source_key = new_storage_key(user.id, "lease_abstraction", filename)
        storage.save(source_key, raw_bytes)

        job = ProcessingJob(
            user_id=user.id,
            service_code=ServiceCode.lease_abstraction,
            status=JobStatus.processing,
            original_filename=filename,
            source_storage_key=source_key,
            page_count=len(pages),
            billed_amount=0,
        )
        db.add(job)
        db.flush()

        try:
            # Stage 1 - vision OCR, one call per page.
            page_texts = []
            for page in pages:
                text = await self.llm.complete_with_image(
                    OCR_SYSTEM_PROMPT, f"Transcribe page {page.page_number}.", page.png_bytes,
                )
                page_texts.append(text)
            full_text = "\n\n".join(page_texts)

            # Stage 2 - structured field extraction from the combined text.
            raw_response = await self.llm.complete(
                EXTRACTION_SYSTEM_PROMPT, f"Lease document text:\n\n{full_text}",
            )
            extracted = _parse_json_response(raw_response)
        except HTTPException:
            raise
        except Exception as err:  # noqa: BLE001 - either stage failing fails the job, charges nothing
            job.status = JobStatus.failed
            job.error_message = str(err)
            db.commit()
            db.refresh(job)
            return job

        result = {"fields": LEASE_FIELDS, "extracted": extracted, "page_count": len(pages)}
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
                description=f"Lease abstraction - {filename}",
                debit=price,
            ))

        db.commit()
        db.refresh(job)
        return job


def _parse_json_response(raw_response: str) -> dict:
    text = raw_response.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as err:
        raise LeaseAbstractionError(f"Model did not return valid JSON: {err}") from err
