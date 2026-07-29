"""
Public, unauthenticated endpoints.

Company branding (name, logo, social links) and the services catalogue
need to be visible on the login page - before anyone has a token - and
in the app's own footer. Both are read-only, non-sensitive, and
deliberately live outside the admin/auth-gated routers rather than
being fetched some other way that would require a workaround for
unauthenticated access.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_db
from app.models.company import CompanyProfile
from app.models.plan import Plan, ServiceCode

router = APIRouter(tags=["public"])

SERVICE_CATALOGUE = [
    {"code": "lease_abstraction", "label": "Lease Abstraction", "desc": "Extract structured lease data from PDF documents.", "coming_soon": True},
    {"code": "translation", "label": "Translation", "desc": "Translate documents while preserving layout."},
    {"code": "ocr", "label": "OCR", "desc": "Extract text from scanned documents and images."},
    {"code": "data_extraction", "label": "Data Extraction", "desc": "Pull structured fields from any document."},
    {"code": "bai2", "label": "BAI2", "desc": "Parse bank statement BAI2 files."},
]


@router.get("/company")
def public_company_info(db: Session = Depends(get_db)):
    company = db.get(CompanyProfile, 1)
    if company is None:
        return {"name": "Lexora AI Solutions", "logo_url": None, "social_links": {}}
    return {
        "name": company.name,
        "logo_url": "/api/v1/company/logo" if company.logo_url else None,
        "social_links": company.social_links or {},
    }


@router.get("/company/logo")
def public_company_logo(db: Session = Depends(get_db)):
    from fastapi import HTTPException, status
    from fastapi.responses import Response

    from app.core.storage import get_storage

    company = db.get(CompanyProfile, 1)
    if company is None or not company.logo_url:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No logo has been uploaded yet.")
    storage = get_storage()
    if not storage.exists(company.logo_url):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Logo file is missing.")
    ext = company.logo_url.rsplit(".", 1)[-1]
    media_type = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "svg": "image/svg+xml"}.get(ext, "application/octet-stream")
    return Response(content=storage.read(company.logo_url), media_type=media_type)


@router.get("/admin-image/{table}/{row_id}/{column}")
def admin_row_image(table: str, row_id: str, column: str, db: Session = Depends(get_db)):
    """Serves an image field's stored file for the Admin Panel's
    row-edit form - deliberately outside the admin router's auth gate,
    because an <img src="..."> can't attach a bearer token. Knowing the
    exact table/row/column combination is required to fetch anything
    here, and the images involved (logos, profile photos) aren't
    sensitive - same reasoning as /company/logo and /users/photo/{id}."""
    from fastapi import HTTPException, status
    from fastapi.responses import Response

    from app.api.v1.admin_registry import AdminRegistry
    from app.core.storage import get_storage

    spec = AdminRegistry.get(table)
    if spec is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown table.")
    row = db.get(spec.model, row_id)
    if row is None or not getattr(row, column, None):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No image set.")
    key = getattr(row, column)
    storage = get_storage()
    if not storage.exists(key):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Image file is missing.")
    ext = key.rsplit(".", 1)[-1]
    media_type = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "application/octet-stream")
    return Response(content=storage.read(key), media_type=media_type)


@router.get("/services")
def public_services_catalogue(db: Session = Depends(get_db)):
    """One rate per service (all services share the same per-document
    rate on a given plan - see backend/app/seed.py), across all 3
    plans, so the login page can show "starts at ₹X/document" per
    service without the visitor needing to be logged in."""
    plans = db.query(Plan).order_by(Plan.sort_order).all()
    rates_by_plan = {
        p.id: {"plan_name": p.name, "rate": float(p.service_pricing[0].price) if p.service_pricing else None}
        for p in plans
    }
    return {"services": SERVICE_CATALOGUE, "rates_by_plan": rates_by_plan}
