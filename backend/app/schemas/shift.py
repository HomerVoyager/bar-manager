from pydantic import BaseModel
from datetime import date
from typing import Optional


class ShiftCreate(BaseModel):
    staff_id: int
    date: date
    start_time: str  # "18:00"
    end_time: str    # "23:00"
    note: Optional[str] = None


class ShiftUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    note: Optional[str] = None


class StaffInShift(BaseModel):
    id: int
    name: str
    role: str
    model_config = {"from_attributes": True}


class ShiftResponse(BaseModel):
    id: int
    staff_id: int
    date: date
    start_time: str
    end_time: str
    note: Optional[str] = None
    staff: Optional[StaffInShift] = None
    model_config = {"from_attributes": True}
