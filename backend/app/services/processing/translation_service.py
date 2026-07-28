"""
Translation pipeline.

Text-in, translated-text-out for now - the old project's actual
translation pipeline works page-by-page against rendered PDF images
(a vision-model call per page, plus a "hybrid mode" fallback). Porting
that fully means adding PDF rendering (pdf2image / PyMuPDF) ahead of
this, but the job/billing/storage/LLM-calling pattern below is
identical either way, so it's the right thing to get right first.

`TranslationService` takes an `LlmClient` in its constructor rather
than calling `get_llm_client()` internally - that's what lets
tests/test_translation_service.py substitute a `FakeLlmClient` and
verify billing/storage/job-status behavior for real, without needing
OPENROUTER_API_KEY to be set or making a network call.
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
    "You are a professional document translator. Translate the user's text into "
    "the requested target language. Preserve paragraph breaks and formatting as "
    "closely as possible. Respond with ONLY the translated text - no commentary, "
    "no explanation, no markdown code fences."
)


class TranslationService:
    def __init__(self, llm: LlmClient):
        self.llm = llm

    async def process_upload(
        self, db: Session, user: User, filename: str, raw_bytes: bytes, target_language: str,
    ) -> ProcessingJob:
        plan = db.get(Plan, user.plan_id)
        price = plan.price_for(ServiceCode.translation)

        balance = get_wallet_balance(db, user.id)
        if balance < price:
            raise HTTPException(
                status.HTTP_402_PAYMENT_REQUIRED,
                f"Translation on your plan costs {plan.currency} {price}/page, but your "
                f"wallet only has {plan.currency} {balance}. Add balance and try again.",
            )

        storage = get_storage()
        source_key = new_storage_key(user.id, "translation", filename)
        storage.save(source_key, raw_bytes)

        job = ProcessingJob(
            user_id=user.id,
            service_code=ServiceCode.translation,
            status=JobStatus.processing,
            original_filename=filename,
            source_storage_key=source_key,
            page_count=1,  # plain-text input is treated as a single page for now
            billed_amount=0,
        )
        db.add(job)
        db.flush()

        try:
            source_text = raw_bytes.decode("utf-8", errors="replace")
            user_prompt = f"Target language: {target_language}\n\nText to translate:\n\n{source_text}"
            translated_text = await self.llm.complete(SYSTEM_PROMPT, user_prompt)
        except HTTPException:
            raise
        except Exception as err:  # noqa: BLE001 - any LLM/network failure fails the job, doesn't crash the request
            job.status = JobStatus.failed
            job.error_message = str(err)
            db.commit()
            db.refresh(job)
            return job

        result = {"target_language": target_language, "translated_text": translated_text}
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
                description=f"Translation - {filename} -> {target_language}",
                debit=price,
            ))

        db.commit()
        db.refresh(job)
        return job
