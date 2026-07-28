from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.models.plan import Plan
from app.models.user import User
from app.schemas.auth import UserPublic
from app.schemas.plan import PlanPublic, SwitchPlanRequest
from app.services.billing_service import switch_plan

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanPublic])
def list_plans(db: Session = Depends(get_db)):
    return db.query(Plan).order_by(Plan.sort_order).all()


@router.post("/switch", response_model=UserPublic)
def switch(
    payload: SwitchPlanRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return switch_plan(db, current_user, payload.plan_id)
