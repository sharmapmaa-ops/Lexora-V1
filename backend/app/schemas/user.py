import datetime

from pydantic import BaseModel


class ProfileUpdateRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    mobile: str | None = None
    gender: str | None = None
    birthdate: datetime.date | None = None
