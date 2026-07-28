import datetime
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_user, get_db
from app.core.database import SessionLocal
from app.core.storage import get_storage, new_storage_key
from app.models.user import ApiKeyStatus, User
from app.schemas.auth import UserPublic
from app.schemas.user import ProfileUpdateRequest

router = APIRouter(prefix="/users", tags=["users"])

MAX_PHOTO_BYTES = 3 * 1024 * 1024  # 3 MB
ALLOWED_PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


@router.patch("/me/profile", response_model=UserPublic)
def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.first_name is not None:
        current_user.first_name = payload.first_name
    if payload.last_name is not None:
        current_user.last_name = payload.last_name
    if payload.mobile is not None:
        current_user.mobile = payload.mobile
    if payload.gender is not None:
        current_user.gender = payload.gender
    if payload.birthdate is not None:
        current_user.birthdate = payload.birthdate
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/photo", response_model=UserPublic)
async def upload_profile_photo(
    file: UploadFile,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    content_type = file.content_type or ""
    if content_type not in ALLOWED_PHOTO_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Photo must be a JPEG, PNG, or WEBP image.")

    raw_bytes = await file.read()
    if len(raw_bytes) > MAX_PHOTO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Photo is too large (max 3 MB).")

    ext = ALLOWED_PHOTO_TYPES[content_type]
    storage = get_storage()
    key = new_storage_key(current_user.id, "profile-photos", f"photo.{ext}")
    storage.save(key, raw_bytes)

    # photo_url stores the storage key, not a public path - the actual
    # image is served through /users/photo/{user_id} below (which reads
    # the key back out of the DB), so this never leaks the raw storage
    # layout to the frontend.
    current_user.photo_url = key
    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/photo/{user_id}")
def get_profile_photo(user_id: uuid.UUID):
    """Public (unauthenticated) by design - profile photos are meant to
    display in <img> tags, which don't send Authorization headers. This
    mirrors how virtually every app serves avatars."""
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        if user is None or not user.photo_url:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "No photo set for this user.")
        storage = get_storage()
        if not storage.exists(user.photo_url):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Photo file is missing.")
        content = storage.read(user.photo_url)
        ext = user.photo_url.rsplit(".", 1)[-1]
        media_type = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}.get(ext, "application/octet-stream")
        return Response(content=content, media_type=media_type)
    finally:
        db.close()


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
