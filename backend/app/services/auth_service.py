"""
Auth business logic.

Routes (app/api/v1/routes/auth.py) stay thin - they parse the request,
call one of these functions, and shape the response. Every rule about
*how* a user is created or authenticated lives here so it can be unit
tested without spinning up FastAPI at all.
"""
import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_token, hash_password, verify_password
from app.models.plan import Plan
from app.models.user import User, UserStatus
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPair


def register_user(db: Session, payload: RegisterRequest) -> User:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.")

    free_plan = db.get(Plan, "free")
    if free_plan is None:
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "No default plan is configured - run the seed script before allowing signups.",
        )

    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        mobile=payload.mobile,
        status=UserStatus.pending_verification,
        plan_id=free_plan.id,
        plan_started_at=datetime.date.today(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate(db: Session, payload: LoginRequest) -> User:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        # Deliberately identical error for "no such user" and "wrong
        # password" - distinguishing them lets an attacker enumerate
        # which emails have accounts.
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if user.is_locked:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account has been locked. Contact support.")
    return user


def issue_tokens(user: User) -> TokenPair:
    return TokenPair(
        access_token=create_token(str(user.id), user.role.value, "access"),
        refresh_token=create_token(str(user.id), user.role.value, "refresh"),
    )
