# 在庫ログモデル
# 商品の在庫変動履歴を管理（仕入・販売・廃棄）

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class StockLog(Base):
    """在庫ログテーブル"""
    __tablename__ = "stock_logs"

    # 主キー（自動採番）
    id = Column(Integer, primary_key=True, index=True)

    # 商品ID
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)

    # 変動数量（仕入: 正の値、販売・廃棄: 負の値）
    change_qty = Column(Integer, nullable=False)

    # 変動理由
    # purchase: 仕入
    # sale: 販売
    # loss: 廃棄・ロス
    reason = Column(String(50), nullable=True)

    # 操作スタッフID
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True, index=True)

    # 記録日時（自動設定）
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # リレーションシップ
    product = relationship("Product", back_populates="stock_logs")
    staff = relationship("Staff", back_populates="stock_logs")

    def __repr__(self):
        return f"<StockLog id={self.id} product_id={self.product_id} change_qty={self.change_qty} reason={self.reason}>"
