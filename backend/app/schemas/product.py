# 商品スキーマ
# 商品情報のPydanticスキーマ

from pydantic import BaseModel, Field
from typing import Optional


class ProductBase(BaseModel):
    """商品基底スキーマ（共通フィールド）"""
    name: str = Field(..., max_length=100, description="商品名")
    price: int = Field(..., ge=0, description="販売価格（円）")
    cost: int = Field(..., ge=0, description="原価（円）")
    category: Optional[str] = Field(None, max_length=50, description="カテゴリ")
    stock_qty: int = Field(default=0, ge=0, description="在庫数量")
    alert_qty: int = Field(default=5, ge=0, description="アラート数量")
    unit: Optional[str] = Field(None, max_length=20, description="単位")


class ProductCreate(ProductBase):
    """商品作成スキーマ"""
    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "プレミアムウィスキー",
                "price": 1000,
                "cost": 300,
                "category": "ドリンク",
                "stock_qty": 20,
                "alert_qty": 5,
                "unit": "杯"
            }
        }
    }


class ProductUpdate(BaseModel):
    """商品更新スキーマ（全フィールドオプション）"""
    name: Optional[str] = Field(None, max_length=100)
    price: Optional[int] = Field(None, ge=0)
    cost: Optional[int] = Field(None, ge=0)
    category: Optional[str] = None
    stock_qty: Optional[int] = Field(None, ge=0)
    alert_qty: Optional[int] = Field(None, ge=0)
    unit: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    """商品レスポンススキーマ"""
    id: int
    is_active: bool
    # 在庫アラートフラグ（stock_qty <= alert_qty の場合True）
    is_low_stock: Optional[bool] = None

    model_config = {"from_attributes": True}


class ProductBrief(BaseModel):
    """商品簡略情報（注文アイテムの埋め込み用）"""
    id: int
    name: str
    price: int
    category: Optional[str] = None

    model_config = {"from_attributes": True}
