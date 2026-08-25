import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    phone: str
    created_at: datetime


class CheckInCreate(BaseModel):
    phone: str = Field(min_length=1, max_length=20)
    mood: int = Field(ge=1, le=5)
    note: str | None = Field(default=None, max_length=2000)


class CheckInRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    mood: int
    note: str | None
    created_at: datetime
