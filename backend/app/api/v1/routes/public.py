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
    # Delegates to the same admin logo-serving logic - logos aren't
    # sensitive, and the login page needs to show one before anyone is
    # authenticated.
    from app.api.v1.routes.admin import get_company_logo
    return get_company_logo(db)


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
