from decimal import Decimal

from pydantic import BaseModel


class ServicePricingPublic(BaseModel):
    service_code: str
    unit: str
    price: Decimal

    model_config = {"from_attributes": True}


class PlanPublic(BaseModel):
    id: str
    name: str
    icon: str
    monthly_price: Decimal
    currency: str
    is_featured: bool
    features: list[str]
    service_pricing: list[ServicePricingPublic]

    model_config = {"from_attributes": True}


class SwitchPlanRequest(BaseModel):
    plan_id: str
