# セッションスキーマ
# 来店セッション情報のPydanticスキーマ

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from app.schemas.order_item import OrderItemResponse
from app.schemas.staff import StaffBrief
from app.schemas.table import TableResponse


class SessionBase(BaseModel):
    """セッション基底スキーマ（共通フィールド）"""
    table_id: int = Field(..., description="テーブルID")
    staff_id: Optional[int] = Field(None, description="担当スタッフID")
    guest_count: int = Field(default=1, ge=1, description="来店人数")
    plan_type: str = Field(default="tanpin", description="料金プラン: tanpin/nomi_hodai")
    time_limit_minutes: Optional[int] = Field(None, description="飲み放題の制限時間（分）")
    set_fee: int = Field(default=0, ge=0, description="セット料金（円）")
    nomi_hodai_price: int = Field(default=0, ge=0, description="飲み放題コース料金（1人あたり円）")
    yobiback_staff_id: Optional[int] = Field(None, description="呼びバック担当スタッフID")


class SessionCreate(SessionBase):
    """セッション作成スキーマ（来店開始）"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "table_id": 1,
                "staff_id": 1,
                "guest_count": 3,
                "plan_type": "tanpin"
            }
        }
    }


class SessionResponse(SessionBase):
    """セッションレスポンススキーマ"""
    id: int
    started_at: datetime
    closed_at: Optional[datetime] = None
    total: int
    status: str
    extension_fee: int = 0
    # 注文アイテム一覧（詳細取得時）
    order_items: Optional[List[OrderItemResponse]] = None
    # テーブル情報（埋め込み）
    table: Optional[TableResponse] = None
    # スタッフ情報（埋め込み）
    staff: Optional[StaffBrief] = None

    model_config = {"from_attributes": True}


class SessionBrief(BaseModel):
    """セッション簡略情報（テーブル一覧の埋め込み用）"""
    id: int
    guest_count: int
    started_at: datetime
    total: int
    status: str
    plan_type: str = "tanpin"
    time_limit_minutes: Optional[int] = None
    set_fee: int = 0
    nomi_hodai_price: int = 0
    extension_fee: int = 0

    model_config = {"from_attributes": True}


class SplitBillResponse(BaseModel):
    """割り勘計算レスポンス"""
    session_id: int
    total: int
    guest_count: int
    # 一人当たりの金額（切り上げ）
    per_person: int
    # 内訳
    items_breakdown: List[dict]
