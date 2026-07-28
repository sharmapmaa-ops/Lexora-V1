import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.core.llm import get_llm_client
from app.core.storage import get_storage
from app.models.plan import ServiceCode
from app.models.processing_job import ProcessingJob
from app.models.user import User
from app.schemas.processing_job import ProcessingJobPublic
from app.services.processing.data_extraction_service import DataExtractionService
from app.services.processing.job_service import process_bai2_upload
from app.services.processing.lease_abstraction_service import LeaseAbstractionService
from app.services.processing.ocr_service import OcrService
from app.services.processing.translation_service import TranslationService

router = APIRouter(prefix="/processing", tags=["processing"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB


@router.post("/bai2/upload", response_model=ProcessingJobPublic, status_code=status.HTTP_201_CREATED)
async def upload_bai2(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is too large (max 10 MB).")
    if not raw_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty.")

    return process_bai2_upload(db, current_user, file.filename or "upload.bai2", raw_bytes)


@router.post("/translation/upload", response_model=ProcessingJobPublic, status_code=status.HTTP_201_CREATED)
async def upload_translation(
    file: UploadFile,
    target_language: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is too large (max 10 MB).")
    if not raw_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty.")

    service = TranslationService(get_llm_client())
    return await service.process_upload(
        db, current_user, file.filename or "document.txt", raw_bytes, target_language,
    )


@router.post("/data-extraction/upload", response_model=ProcessingJobPublic, status_code=status.HTTP_201_CREATED)
async def upload_data_extraction(
    file: UploadFile,
    fields: str,  # comma-separated list, e.g. "invoice_number,total,due_date"
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is too large (max 10 MB).")
    if not raw_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty.")

    field_list = [f.strip() for f in fields.split(",") if f.strip()]
    if not field_list:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide at least one field to extract.")

    service = DataExtractionService(get_llm_client())
    return await service.process_upload(db, current_user, file.filename or "document.txt", raw_bytes, field_list)


@router.post("/ocr/upload", response_model=ProcessingJobPublic, status_code=status.HTTP_201_CREATED)
async def upload_ocr(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is too large (max 10 MB).")
    if not raw_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty.")

    service = OcrService(get_llm_client())
    return await service.process_upload(db, current_user, file.filename or "document.pdf", raw_bytes)


@router.post("/lease-abstraction/upload", response_model=ProcessingJobPublic, status_code=status.HTTP_201_CREATED)
async def upload_lease_abstraction(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File is too large (max 10 MB).")
    if not raw_bytes:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Uploaded file is empty.")

    service = LeaseAbstractionService(get_llm_client())
    return await service.process_upload(db, current_user, file.filename or "lease.pdf", raw_bytes)


@router.get("/jobs", response_model=list[ProcessingJobPublic])
def list_jobs(
    service: ServiceCode | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ProcessingJob).filter(ProcessingJob.user_id == current_user.id)
    if service is not None:
        query = query.filter(ProcessingJob.service_code == service)
    return query.order_by(desc(ProcessingJob.created_at)).all()


@router.get("/jobs/{job_id}/result")
def download_result(
    job_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    job = db.get(ProcessingJob, job_id)
    if job is None or job.user_id != current_user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Job not found.")
    if not job.result_storage_key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This job has no result yet.")

    storage = get_storage()
    return storage.read(job.result_storage_key)
