# 注文アイテムモデル
# セッション内の個別注文を管理

from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class OrderItem(Base):
    """注文アイテムテーブル"""
    __tablename__ = "order_items"

    # 主キー（自動採番）
    id = Column(Integer, primary_key=True, index=True)

    # セッションID（どの来店か）
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True, index=True)

    # 商品ID（何を注文したか）
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)

    # 注文数量
    qty = Column(Integer, nullable=False)

    # 注文時の単価（注文時点の価格を記録、後から価格変更があっても影響しない）
    unit_price = Column(Integer, nullable=False)

    # 注文時刻（自動設定）
    ordered_at = Column(DateTime, default=func.now(), nullable=False)

    # リレーションシップ
    session = relationship("Session", back_populates="order_items")
    product = relationship("Product", back_populates="order_items")

    def __repr__(self):
        return f"<OrderItem id={self.id} session_id={self.session_id} product_id={self.product_id} qty={self.qty}>"
