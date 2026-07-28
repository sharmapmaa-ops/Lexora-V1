"""
OCR pipeline.

Unlike BAI2 (deterministic) or Translation/Data Extraction (text-in,
LLM-out), OCR's input is a PDF whose pages need to become images before
any LLM call can happen - that's what `app/core/pdf_utils.py` is for.
Each page is sent to the vision-capable side of `LlmClient`
(`complete_with_image`) independently and the transcriptions are
joined in page order.

Billed per page (unlike Translation/Data Extraction's flat one-page
charge for arbitrary text) since a page count is now a real, known
quantity once the PDF is rendered.
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

SYSTEM_PROMPT = (
    "You are an OCR assistant. Transcribe ALL visible text in the image exactly as "
    "it appears, preserving line breaks and reading order. Respond with ONLY the "
    "transcribed text - no commentary, no description of the image, no markdown."
)


class OcrService:
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
        per_page_price = plan.price_for(ServiceCode.ocr)
        total_price = per_page_price * len(pages)

        balance = get_wallet_balance(db, user.id)
        if balance < total_price:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"OCR on your plan costs {plan.currency} {per_page_price}/page - this "
                f"{len(pages)}-page document costs {plan.currency} {total_price}, but your "
                f"wallet only has {plan.currency} {balance}. Add balance and try again.",
            )

        storage = get_storage()
        source_key = new_storage_key(user.id, "ocr", filename)
        storage.save(source_key, raw_bytes)

        job = ProcessingJob(
            user_id=user.id,
            service_code=ServiceCode.ocr,
            status=JobStatus.processing,
            original_filename=filename,
            source_storage_key=source_key,
            page_count=len(pages),
            billed_amount=0,
        )
        db.add(job)
        db.flush()

        page_texts: list[str] = []
        try:
            for page in pages:
                text = await self.llm.complete_with_image(
                    SYSTEM_PROMPT, f"Transcribe page {page.page_number}.", page.png_bytes,
                )
                page_texts.append(text)
        except HTTPException:
            raise
        except Exception as err:  # noqa: BLE001 - any page failing fails the whole job, charges nothing
            job.status = JobStatus.failed
            job.error_message = str(err)
            db.commit()
            db.refresh(job)
            return job

        result = {
            "page_count": len(pages),
            "pages": [{"page_number": p.page_number, "text": t} for p, t in zip(pages, page_texts)],
            "full_text": "\n\n".join(page_texts),
        }
        result_key = f"{source_key}.result.json"
        storage.save(result_key, json.dumps(result, indent=2).encode("utf-8"))

        job.status = JobStatus.completed
        job.result_storage_key = result_key
        job.result_metadata = result
        job.billed_amount = total_price

        if total_price > 0:
            db.add(Transaction(
                user_id=user.id,
                type=TransactionType.service_charge,
                status=TransactionStatus.success,
                description=f"OCR - {filename} ({len(pages)} page(s))",
                debit=total_price,
            ))

        db.commit()
        db.refresh(job)
        return job
