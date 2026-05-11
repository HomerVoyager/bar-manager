from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class StaffDrinkCreate(BaseModel):
    session_id: int
    staff_id: int
    product_id: Optional[int] = None
    qty: int = Field(default=1, ge=1)
    note: Optional[str] = None


class StaffDrinkResponse(BaseModel):
    id: int
    session_id: int
    staff_id: int
    product_id: Optional[int] = None
    qty: int
    unit_price: int
    back_amount: int
    note: Optional[str] = None
    ordered_at: datetime
    staff_name: Optional[str] = None
    product_name: Optional[str] = None

    model_config = {"from_attributes": True}
