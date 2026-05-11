# 勤怠スキーマ
# 出退勤記録のPydanticスキーマ

from pydantic import BaseModel, Field, model_validator
from typing import Optional, List
from datetime import datetime, date as Date

from app.schemas.staff import StaffBrief


class AttendanceBase(BaseModel):
    """勤怠基底スキーマ（共通フィールド）"""
    staff_id: int = Field(..., description="スタッフID")
    date: Date = Field(..., description="勤務日")


class ClockInRequest(BaseModel):
    staff_id: int
    clock_in: Optional[datetime] = None

    model_config = {"json_schema_extra": {"example": {"staff_id": 2}}}


class ClockOutRequest(BaseModel):
    staff_id: int
    clock_out: Optional[datetime] = None

    model_config = {"json_schema_extra": {"example": {"staff_id": 2}}}


class BreakStartRequest(BaseModel):
    staff_id: int


class BreakEndRequest(BaseModel):
    staff_id: int


class AttendanceUpdate(BaseModel):
    """打刻修正スキーマ（人別詳細から編集）"""
    clock_in: Optional[str] = None
    clock_out: Optional[str] = None
    break_minutes: Optional[int] = None


class AttendanceResponse(AttendanceBase):
    """勤怠レスポンススキーマ"""
    id: int
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    break_start: Optional[datetime] = None
    break_end: Optional[datetime] = None
    break_minutes: int = 0
    work_minutes: Optional[int] = None
    night_minutes: Optional[int] = None
    wage: Optional[int] = None
    staff: Optional[StaffBrief] = None
    staff_name: Optional[str] = None

    model_config = {"from_attributes": True}

    @model_validator(mode='after')
    def populate_staff_name(self) -> 'AttendanceResponse':
        if self.staff and not self.staff_name:
            self.staff_name = self.staff.name
        return self


class MonthlyWageResponse(BaseModel):
    """月次給与レスポンススキーマ"""
    staff_id: int
    staff_name: str
    year: int
    month: int
    # 出勤日数
    work_days: int
    # 総勤務時間（分）
    total_work_minutes: int
    # 深夜勤務時間（分）
    total_night_minutes: int
    # 残業時間（分）
    total_overtime_minutes: int
    # 基本給（通常時給 × 通常時間）
    base_pay: int
    # 深夜割増額
    night_premium: int
    # 残業割増額
    overtime_premium: int
    # 月次支給合計額
    total_wage: int
    # ドリンクバック合計
    drink_back_total: int = 0
    # 日次明細
    daily_details: List[dict]


class PayslipResponse(BaseModel):
    """給与明細レスポンススキーマ"""
    staff_id: int
    staff_name: str
    year: int
    month: int
    hourly_wage: int
    drink_back_rate: float = 0.0
    work_days: int
    total_work_minutes: int
    total_night_minutes: int
    total_overtime_minutes: int
    base_pay: int
    night_premium: int
    overtime_premium: int
    drink_back_total: int = 0
    total_wage: int
