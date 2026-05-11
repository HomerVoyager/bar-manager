# 顧客スキーマ
from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class CustomerBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    birthday: Optional[date] = None
    notes: Optional[str] = None


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    birthday: Optional[date] = None
    notes: Optional[str] = None
    visit_count: Optional[int] = None
    last_visit_date: Optional[date] = None


class CustomerResponse(CustomerBase):
    id: int
    visit_count: int
    last_visit_date: Optional[date] = None
    created_at: datetime

    model_config = {"from_attributes": True}
