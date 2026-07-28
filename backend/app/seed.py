"""
Seed the database with the plans every fresh environment needs, and
(optionally) a first admin user so there's a way into the Admin Panel
before any real signups happen.

Run with: `python -m app.seed`
"""
from decimal import Decimal

from app.core.database import session_scope
from app.core.security import hash_password
from app.models.plan import Plan, PlanServicePricing, ServiceCode
from app.models.user import User, UserRole, UserStatus


PLAN_DEFS = [
    {
        "id": "free", "name": "Free", "icon": "\U0001F193", "monthly_price": Decimal("0"),
        "is_featured": False, "sort_order": 0,
        "features": ["Email Support", "Advanced Dashboard Access"],
        "pricing": {"translation": Decimal("400"), "ocr": Decimal("400"),
                    "data_extraction": Decimal("400"), "bai2": Decimal("400"),
                    "lease_abstraction": Decimal("800")},
    },
    {
        "id": "standard", "name": "Standard", "icon": "\u2b50", "monthly_price": Decimal("2500"),
        "is_featured": False, "sort_order": 1,
        "features": ["Email Support", "Advanced Dashboard Access", "API Documentation Access"],
        "pricing": {"translation": Decimal("175"), "ocr": Decimal("175"),
                    "data_extraction": Decimal("175"), "bai2": Decimal("175"),
                    "lease_abstraction": Decimal("650")},
    },
    {
        "id": "professional", "name": "Professional", "icon": "\U0001F680", "monthly_price": Decimal("6500"),
        "is_featured": True, "sort_order": 2,
        "features": ["Email Support", "Advanced Dashboard Access", "API Documentation Access"],
        "pricing": {"translation": Decimal("85"), "ocr": Decimal("85"),
                    "data_extraction": Decimal("85"), "bai2": Decimal("85"),
                    "lease_abstraction": Decimal("400")},
    },
]


def seed_plans(db) -> None:
    for plan_def in PLAN_DEFS:
        plan = db.get(Plan, plan_def["id"])
        if plan is None:
            plan = Plan(id=plan_def["id"])
            db.add(plan)
        plan.name = plan_def["name"]
        plan.icon = plan_def["icon"]
        plan.monthly_price = plan_def["monthly_price"]
        plan.is_featured = plan_def["is_featured"]
        plan.sort_order = plan_def["sort_order"]
        plan.features = plan_def["features"]
        db.flush()

        existing_pricing = {row.service_code: row for row in plan.service_pricing}
        for service_name, price in plan_def["pricing"].items():
            code = ServiceCode(service_name)
            unit = "document" if code == ServiceCode.lease_abstraction else "page"
            if code in existing_pricing:
                existing_pricing[code].price = price
                existing_pricing[code].unit = unit
            else:
                db.add(PlanServicePricing(plan_id=plan.id, service_code=code, unit=unit, price=price))


def seed_admin_user(db, email: str, password: str) -> None:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        print(f"Admin user {email} already exists - skipping.")
        return
    db.add(User(
        email=email,
        password_hash=hash_password(password),
        first_name="Admin",
        last_name="User",
        role=UserRole.admin,
        status=UserStatus.active,
        email_verified=True,
        plan_id="professional",
    ))
    print(f"Created admin user {email}.")


def main() -> None:
    with session_scope() as db:
        seed_plans(db)
        seed_admin_user(db, "admin@lexoraaisolutions.com", "ChangeMe123!")
    print("Seed complete: 3 plans (with per-service pricing) + admin user ensured.")


if __name__ == "__main__":
    main()
