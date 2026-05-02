# 注文アイテムスキーマ
# 注文アイテム情報のPydanticスキーマ

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

from app.schemas.product import ProductBrief


class OrderItemBase(BaseModel):
    """注文アイテム基底スキーマ（共通フィールド）"""
    product_id: int = Field(..., description="商品ID")
    qty: int = Field(..., ge=1, description="注文数量")


class OrderItemCreate(OrderItemBase):
    """注文アイテム作成スキーマ"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "product_id": 1,
                "qty": 2
            }
        }
    }


class OrderItemResponse(OrderItemBase):
    """注文アイテムレスポンススキーマ"""
    id: int
    session_id: int
    # 注文時の単価（履歴保持のため）
    unit_price: int
    # 小計（unit_price × qty）
    subtotal: Optional[int] = None
    ordered_at: datetime
    # 商品情報（埋め込み）
    product: Optional[ProductBrief] = None

    model_config = {"from_attributes": True}
