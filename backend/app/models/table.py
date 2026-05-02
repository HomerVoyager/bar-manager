# テーブルモデル
# バーの座席（テーブル）情報と現在の状態を管理

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base


class Table(Base):
    """テーブルテーブル（座席管理）"""
    __tablename__ = "tables"

    # 主キー（自動採番）
    id = Column(Integer, primary_key=True, index=True)

    # テーブル名（例: A1, A2, B1, B2）
    name = Column(String(20), nullable=False, unique=True)

    # 定員（人数）
    capacity = Column(Integer, default=4, nullable=False)

    # 現在の状態
    # empty: 空席
    # occupied: 使用中
    # reserved: 予約済み
    status = Column(String(20), default="empty", nullable=False)

    # リレーションシップ
    sessions = relationship("Session", back_populates="table")

    def __repr__(self):
        return f"<Table id={self.id} name={self.name} status={self.status}>"
