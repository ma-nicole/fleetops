from pydantic import BaseModel, EmailStr

from app.models.entities import UserRole


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.CUSTOMER
    phone: str | None = None


class UserRead(BaseModel):
    id: int
    email: EmailStr
    full_name: str
    role: UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
