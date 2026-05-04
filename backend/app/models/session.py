# セッションモデル
# お客様の来店セッション（開始〜精算）を管理

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Session(Base):
    """セッションテーブル（来店管理）"""
    __tablename__ = "sessions"

    # 主キー（自動採番）
    id = Column(Integer, primary_key=True, index=True)

    # テーブルID（どのテーブルか）
    table_id = Column(Integer, ForeignKey("tables.id"), nullable=True, index=True)

    # 担当スタッフID
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True, index=True)

    # 来店人数
    guest_count = Column(Integer, default=1, nullable=False)

    # 来店開始時刻（自動設定）
    started_at = Column(DateTime, default=func.now(), nullable=False)

    # 精算時刻（精算完了時に設定）
    closed_at = Column(DateTime, nullable=True)

    # 合計金額（精算時に計算して設定）
    total = Column(Integer, default=0, nullable=False)

    # セッション状態
    # open: 営業中（注文受付中）
    # closed: 精算済み
    status = Column(String(20), default="open", nullable=False)

    # 料金プラン: tanpin（単品）/ nomi_hodai（飲み放題）
    plan_type = Column(String(20), default="tanpin", nullable=False)

    # 飲み放題の制限時間（分）
    time_limit_minutes = Column(Integer, nullable=True)

    # リレーションシップ
    table = relationship("Table", back_populates="sessions")
    staff = relationship("Staff", back_populates="sessions")
    order_items = relationship("OrderItem", back_populates="session", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Session id={self.id} table_id={self.table_id} status={self.status}>"
