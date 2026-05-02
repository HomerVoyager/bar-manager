# 商品モデル
# バーで提供するドリンク・フードの商品情報を管理

from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Product(Base):
    """商品テーブル"""
    __tablename__ = "products"

    # 主キー（自動採番）
    id = Column(Integer, primary_key=True, index=True)

    # 商品名（必須、100文字まで）
    name = Column(String(100), nullable=False, index=True)

    # 販売価格（円、税別）
    price = Column(Integer, nullable=False)

    # 原価（円）- FL比率計算に使用
    cost = Column(Integer, nullable=False)

    # カテゴリ（例: ドリンク、フード、ソフトドリンク）
    category = Column(String(50), nullable=True, index=True)

    # 在庫数量
    stock_qty = Column(Integer, default=0, nullable=False)

    # アラート数量（この数量以下になったら在庫アラートを表示）
    alert_qty = Column(Integer, default=5, nullable=False)

    # 単位（例: 本、個、皿）
    unit = Column(String(20), nullable=True)

    # 販売中フラグ（販売停止時はFalseに更新）
    is_active = Column(Boolean, default=True, nullable=False)

    # リレーションシップ
    order_items = relationship("OrderItem", back_populates="product")
    stock_logs = relationship("StockLog", back_populates="product")

    def __repr__(self):
        return f"<Product id={self.id} name={self.name} price={self.price}>"
