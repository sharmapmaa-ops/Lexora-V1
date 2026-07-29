"""
Generic Admin Panel CRUD.

One set of routes serves every table in AdminRegistry. Column headers,
types, and primary keys are read from SQLAlchemy's own model metadata
(`sqlalchemy.inspect`) rather than re-declared by hand per table - the
exact fix for the old project's Admin Panel, where every table needed
its own hand-written column list and the three separate attempts it
took to get scrolling/height right per table.
"""
import enum
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.api.v1.admin_registry import AdminRegistry, AdminTableSpec
from app.api.v1.deps import get_db, require_roles
from app.models.company import CompanyProfile
from app.models.processing_job import ProcessingJob
from app.models.support import SupportTicket, TicketStatus
from app.models.transaction import Transaction
from app.models.user import User, UserRole

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_roles(UserRole.admin, UserRole.developer))])


def _json_safe(value: Any) -> Any:
    if isinstance(value, (uuid.UUID,)):
        return str(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, enum.Enum):
        return value.value
    return value


def _spec_or_404(name: str) -> AdminTableSpec:
    spec = AdminRegistry.get(name)
    if spec is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"'{name}' is not an admin-manageable table.")
    return spec


def _field_type_and_options(col) -> tuple[str, list[str] | None]:
    """Derive a semantic field type from the SQLAlchemy column - this is
    what lets the frontend render a date picker for a date column, a
    dropdown for an enum, a checkbox for a boolean, a file-upload button
    for an image URL column, etc., instead of treating every column as
    a plain text input regardless of what it actually holds."""
    python_type = getattr(col.type, "python_type", None)

    # Enum columns (role, status, type, ...) get a dropdown of their
    # actual allowed values - not a free-text field a typo could break.
    if python_type is not None and hasattr(python_type, "__members__"):
        return "select", [member.value for member in python_type]

    if python_type is bool:
        return "boolean", None
    if python_type is date:
        return "date", None
    if python_type is datetime:
        return "datetime", None
    if python_type in (int, float, Decimal):
        return "number", None
    if python_type is dict:
        return "json", None
    if python_type is list:
        return "multiselect", None

    # Column-name heuristic for image fields - there's no SQL type for
    # "this VARCHAR happens to store an image storage key", so the name
    # is the only signal available.
    if col.key in ("photo_url", "logo_url") or (col.key.endswith("_url") and "photo" in col.key):
        return "image", None

    return "text", None


def _columns(spec: AdminTableSpec) -> list[dict]:
    mapper = inspect(spec.model)
    cols = []
    for col in mapper.columns:
        if col.key in spec.hidden_fields:
            continue
        field_type, options = _field_type_and_options(col)
        cols.append({
            "name": col.key,
            "type": str(col.type),
            "field_type": field_type,
            "options": options,
            "primary_key": col.primary_key,
            "editable": col.key not in spec.readonly_fields and not col.primary_key,
        })
    return cols


def _row_to_dict(spec: AdminTableSpec, row) -> dict:
    mapper = inspect(spec.model)
    return {
        col.key: _json_safe(getattr(row, col.key))
        for col in mapper.columns
        if col.key not in spec.hidden_fields
    }


@router.get("/tables")
def list_tables(db: Session = Depends(get_db)):
    out = []
    for name, spec in AdminRegistry.all().items():
        count = db.query(spec.model).count()
        out.append({"name": name, "display_name": spec.display_name, "row_count": count})
    return out


@router.get("/tables/{name}")
def get_table(
    name: str,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    db: Session = Depends(get_db),
):
    spec = _spec_or_404(name)
    total = db.query(spec.model).count()
    rows = (
        db.query(spec.model)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "columns": _columns(spec),
        "rows": [_row_to_dict(spec, r) for r in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("/tables/{name}", status_code=status.HTTP_201_CREATED)
def create_row(name: str, payload: dict, db: Session = Depends(get_db)):
    spec = _spec_or_404(name)
    clean = {k: v for k, v in payload.items() if k not in spec.hidden_fields and k not in spec.readonly_fields}
    row = spec.model(**clean)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _row_to_dict(spec, row)


@router.put("/tables/{name}/{row_id}")
def update_row(name: str, row_id: str, payload: dict, db: Session = Depends(get_db)):
    spec = _spec_or_404(name)
    row = db.get(spec.model, row_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Row not found.")
    for key, value in payload.items():
        if key in spec.hidden_fields or key in spec.readonly_fields:
            continue
        if hasattr(row, key):
            setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return _row_to_dict(spec, row)


@router.delete("/tables/{name}/{row_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_row(name: str, row_id: str, db: Session = Depends(get_db)):
    spec = _spec_or_404(name)
    row = db.get(spec.model, row_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Row not found.")
    db.delete(row)
    db.commit()


@router.post("/tables/{name}/{row_id}/upload/{column}")
async def upload_row_image(
    name: str, row_id: str, column: str, file: UploadFile, db: Session = Depends(get_db),
):
    """Generic image upload for any admin-manageable table's image
    column - the row-edit form's image picker (any field with
    field_type='image') posts here rather than each table needing its
    own bespoke upload route (as company logo previously did)."""
    from app.core.storage import get_storage

    spec = _spec_or_404(name)
    row = db.get(spec.model, row_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Row not found.")
    if column in spec.hidden_fields or column in spec.readonly_fields or not hasattr(row, column):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"'{column}' is not an editable field on this table.")

    allowed_types = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
    content_type = file.content_type or ""
    if content_type not in allowed_types:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Image must be JPEG, PNG, or WEBP.")
    raw_bytes = await file.read()
    if len(raw_bytes) > 3 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Image is too large (max 3 MB).")

    ext = allowed_types[content_type]
    key = f"admin-uploads/{name}/{row_id}/{column}.{ext}"
    get_storage().save(key, raw_bytes)
    setattr(row, column, key)
    db.commit()
    db.refresh(row)
    return _row_to_dict(spec, row)


@router.get("/overview")
def admin_overview(db: Session = Depends(get_db)):
    """Summary stats for the Admin Overview dashboard - one endpoint,
    a handful of aggregate queries, rather than the frontend piecing
    this together from several generic-table calls."""
    from datetime import date, timedelta

    from sqlalchemy import func

    total_users = db.query(User).count()
    locked_users = db.query(User).filter(User.is_locked.is_(True)).count()

    thirty_days_ago = date.today() - timedelta(days=30)
    new_users_30d = db.query(User).filter(User.created_at >= thirty_days_ago).count()

    plan_counts = dict(
        db.query(User.plan_id, func.count(User.id)).group_by(User.plan_id).all()
    )

    total_revenue = db.query(func.coalesce(func.sum(Transaction.credit), 0)).scalar() or 0
    total_billed = db.query(func.coalesce(func.sum(Transaction.debit), 0)).scalar() or 0

    open_tickets = db.query(SupportTicket).filter(SupportTicket.status == TicketStatus.open).count()
    total_tickets = db.query(SupportTicket).count()

    jobs_by_status = dict(
        db.query(ProcessingJob.status, func.count(ProcessingJob.id)).group_by(ProcessingJob.status).all()
    )
    jobs_by_service = dict(
        db.query(ProcessingJob.service_code, func.count(ProcessingJob.id)).group_by(ProcessingJob.service_code).all()
    )

    recent_signups = (
        db.query(User).order_by(User.created_at.desc()).limit(5).all()
    )

    return {
        "total_users": total_users,
        "locked_users": locked_users,
        "new_users_30d": new_users_30d,
        "plan_distribution": {str(k): v for k, v in plan_counts.items()},
        "total_revenue": float(total_revenue),
        "total_billed": float(total_billed),
        "open_tickets": open_tickets,
        "total_tickets": total_tickets,
        "jobs_by_status": {k.value if hasattr(k, "value") else str(k): v for k, v in jobs_by_status.items()},
        "jobs_by_service": {k.value if hasattr(k, "value") else str(k): v for k, v in jobs_by_service.items()},
        "recent_signups": [
            {
                "id": str(u.id),
                "full_name": u.full_name,
                "email": u.email,
                "plan_id": u.plan_id,
                "created_at": u.created_at.isoformat(),
            }
            for u in recent_signups
        ],
    }


@router.get("/company")
def get_company(db: Session = Depends(get_db)):
    company = db.get(CompanyProfile, 1)
    if company is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Company profile has not been set up yet.")
    return _row_to_dict(AdminRegistry.get("company_profile"), company)


@router.patch("/company")
def update_company(payload: dict, db: Session = Depends(get_db)):
    company = db.get(CompanyProfile, 1)
    if company is None:
        company = CompanyProfile(id=1, name=payload.get("name") or "My Company")
        db.add(company)
        db.flush()
    for key, value in payload.items():
        if key in ("id",):
            continue
        if hasattr(company, key):
            setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return _row_to_dict(AdminRegistry.get("company_profile"), company)


_LOGO_ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/svg+xml": "svg"}
_LOGO_STORAGE_KEY_PREFIX = "company/logo"


@router.post("/company/logo")
async def upload_company_logo(file: UploadFile, db: Session = Depends(get_db)):
    from app.core.storage import get_storage

    content_type = file.content_type or ""
    if content_type not in _LOGO_ALLOWED_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Logo must be a JPEG, PNG, WEBP, or SVG image.")

    raw_bytes = await file.read()
    if len(raw_bytes) > 3 * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Logo is too large (max 3 MB).")

    ext = _LOGO_ALLOWED_TYPES[content_type]
    key = f"{_LOGO_STORAGE_KEY_PREFIX}.{ext}"
    get_storage().save(key, raw_bytes)

    company = db.get(CompanyProfile, 1)
    if company is None:
        company = CompanyProfile(id=1, name="My Company")
        db.add(company)
        db.flush()
    company.logo_url = key
    db.commit()
    db.refresh(company)
    return _row_to_dict(AdminRegistry.get("company_profile"), company)


@router.get("/company/logo")
def get_company_logo(db: Session = Depends(get_db)):
    from fastapi.responses import Response

    from app.core.storage import get_storage

    company = db.get(CompanyProfile, 1)
    if company is None or not company.logo_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No logo has been uploaded yet.")
    storage = get_storage()
    if not storage.exists(company.logo_url):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logo file is missing.")
    ext = company.logo_url.rsplit(".", 1)[-1]
    media_type = {
        "jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")
    return Response(content=storage.read(company.logo_url), media_type=media_type)
