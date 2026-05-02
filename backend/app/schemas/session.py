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


class SessionCreate(SessionBase):
    """セッション作成スキーマ（来店開始）"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "table_id": 1,
                "staff_id": 1,
                "guest_count": 3
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
