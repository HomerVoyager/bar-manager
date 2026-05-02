# 在庫ログスキーマ
# 在庫変動記録のPydanticスキーマ

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.schemas.product import ProductBrief
from app.schemas.staff import StaffBrief


class StockLogBase(BaseModel):
    """在庫ログ基底スキーマ（共通フィールド）"""
    product_id: int = Field(..., description="商品ID")
    change_qty: int = Field(..., description="変動数量（仕入: 正, 販売/廃棄: 負）")
    # purchase: 仕入, sale: 販売, loss: 廃棄・ロス
    reason: Optional[str] = Field(None, description="変動理由 (purchase/sale/loss)")


class StockLogCreate(StockLogBase):
    """在庫ログ作成スキーマ"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "product_id": 1,
                "change_qty": 24,
                "reason": "purchase"
            }
        }
    }


class StockLogResponse(StockLogBase):
    """在庫ログレスポンススキーマ"""
    id: int
    staff_id: Optional[int] = None
    created_at: datetime
    # 商品情報（埋め込み）
    product: Optional[ProductBrief] = None
    # スタッフ情報（埋め込み）
    staff: Optional[StaffBrief] = None

    model_config = {"from_attributes": True}
