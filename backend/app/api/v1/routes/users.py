import datetime
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.models.user import ApiKeyStatus, User
from app.schemas.auth import UserPublic

router = APIRouter(prefix="/users", tags=["users"])


@router.post("/me/api-key", response_model=UserPublic)
def generate_api_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """One active key per user, stored directly on the user row - see
    app/models/user.py for why this replaced a standalone api_keys
    table in the old project."""
    current_user.api_key = f"lx_live_{secrets.token_urlsafe(32)}"
    current_user.api_key_created_at = datetime.datetime.now(datetime.timezone.utc)
    current_user.api_key_status = ApiKeyStatus.active
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me/api-key", response_model=UserPublic)
def revoke_api_key(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.api_key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No active API key to revoke.")
    current_user.api_key_status = ApiKeyStatus.revoked
    db.commit()
    db.refresh(current_user)
    return current_user
