# テーブルスキーマ
# 座席情報のPydanticスキーマ

from pydantic import BaseModel, Field
from typing import Optional


class TableBase(BaseModel):
    """テーブル基底スキーマ（共通フィールド）"""
    name: str = Field(..., max_length=20, description="テーブル名（例: A1）")
    capacity: int = Field(default=4, ge=1, description="定員")


class TableCreate(TableBase):
    """テーブル作成スキーマ"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "A1",
                "capacity": 4
            }
        }
    }


class TableUpdate(BaseModel):
    """テーブル更新スキーマ（全フィールドオプション）"""
    name: Optional[str] = Field(None, max_length=20)
    capacity: Optional[int] = Field(None, ge=1)
    status: Optional[str] = None


class TableStatusUpdate(BaseModel):
    """テーブルステータス更新スキーマ"""
    # empty: 空席, occupied: 使用中, reserved: 予約済み
    status: str = Field(..., description="テーブルステータス (empty/occupied/reserved)")


class TableResponse(TableBase):
    """テーブルレスポンススキーマ"""
    id: int
    status: str
    # 現在のセッションID（使用中の場合）
    current_session_id: Optional[int] = None

    model_config = {"from_attributes": True}
