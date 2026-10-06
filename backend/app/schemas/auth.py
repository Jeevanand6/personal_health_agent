import uuid
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, Field


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters password")
    full_name: str = Field(..., min_length=1, max_length=150)
    preferred_language: str = Field(default="en", pattern="^(en|ta)$")
    date_of_birth: Optional[date] = None
    gender: Optional[str] = Field(default=None, max_length=20)
    blood_group: Optional[str] = Field(default=None, max_length=10)
    contact_number: Optional[str] = Field(default=None, max_length=20)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserLanguageUpdateRequest(BaseModel):
    preferred_language: str = Field(..., pattern="^(en|ta)$")


class PatientResponse(BaseModel):
    id: uuid.UUID
    abha_id: Optional[str] = None
    abha_address: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    contact_number: Optional[str] = None
    preferred_language: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
    patient: Optional[PatientResponse] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse
