# スタッフモデル
# バーで働くスタッフ（マネージャー・スタッフ）の情報を管理

from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Staff(Base):
    """スタッフテーブル"""
    __tablename__ = "staff"

    # 主キー（自動採番）
    id = Column(Integer, primary_key=True, index=True)

    # スタッフ名（必須、50文字まで）
    name = Column(String(50), nullable=False, index=True)

    # 顔認識ID（将来の顔認証機能用）
    face_id = Column(String(100), nullable=True)

    # ロール: manager（マネージャー）/ staff（スタッフ）
    role = Column(String(20), default="staff", nullable=False)

    # 時給（円）
    hourly_wage = Column(Integer, nullable=False, default=1000)

    # 在籍フラグ（退職時はFalseに更新、物理削除はしない）
    is_active = Column(Boolean, default=True, nullable=False)

    # パスワードハッシュ（bcryptでハッシュ化して保存）
    password_hash = Column(String(255), nullable=True)

    # 作成日時（自動設定）
    created_at = Column(DateTime, default=func.now(), nullable=False)

    # リレーションシップ
    sessions = relationship("Session", back_populates="staff")
    stock_logs = relationship("StockLog", back_populates="staff")
    attendances = relationship("Attendance", back_populates="staff")

    def __repr__(self):
        return f"<Staff id={self.id} name={self.name} role={self.role}>"
