# スタッフスキーマ
# スタッフ情報のPydanticスキーマ

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class StaffBase(BaseModel):
    """スタッフ基底スキーマ（共通フィールド）"""
    name: str = Field(..., max_length=50, description="スタッフ名")
    employee_number: Optional[str] = Field(None, max_length=20, description="従業員番号（数字のみ）")
    role: str = Field(default="staff", description="ロール (master/manager/staff)")
    hourly_wage: int = Field(default=1000, ge=0, description="時給（円）")
    drink_back_rate: float = Field(default=0.0, ge=0.0, le=100.0, description="ドリンクバック率（%）")
    face_id: Optional[str] = Field(None, description="顔認識ID")


class StaffCreate(StaffBase):
    """スタッフ作成スキーマ"""
    # パスワード（作成時は必須、ハッシュ化して保存）
    password: str = Field(..., min_length=6, description="パスワード（6文字以上）")

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "スタッフ山田",
                "role": "staff",
                "hourly_wage": 1050,
                "password": "pass123"
            }
        }
    }


class StaffUpdate(BaseModel):
    """スタッフ更新スキーマ（全フィールドオプション）"""
    name: Optional[str] = Field(None, max_length=50)
    employee_number: Optional[str] = Field(None, max_length=20)
    role: Optional[str] = None
    hourly_wage: Optional[int] = Field(None, ge=0)
    drink_back_rate: Optional[float] = Field(None, ge=0.0, le=100.0)
    face_id: Optional[str] = None
    is_active: Optional[bool] = None
    # パスワード変更（省略可）
    password: Optional[str] = Field(None, min_length=6)


class StaffResponse(StaffBase):
    """スタッフレスポンススキーマ"""
    id: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class StaffBrief(BaseModel):
    """スタッフ簡略情報（他モデルの埋め込み用）"""
    id: int
    name: str
    role: str

    model_config = {"from_attributes": True}
