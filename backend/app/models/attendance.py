# 勤怠モデル
# スタッフの出退勤記録と給与計算データを管理

from sqlalchemy import Column, Integer, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Attendance(Base):
    """勤怠テーブル"""
    __tablename__ = "attendance"

    # 主キー（自動採番）
    id = Column(Integer, primary_key=True, index=True)

    # スタッフID
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True, index=True)

    # 出勤時刻
    clock_in = Column(DateTime, nullable=True)

    # 退勤時刻（退勤前はNULL）
    clock_out = Column(DateTime, nullable=True)

    # 勤務日（インデックス付き、月次集計に使用）
    date = Column(Date, nullable=False, index=True)

    # 勤務時間（分）: clock_out - clock_in で計算
    work_minutes = Column(Integer, nullable=True)

    # 深夜勤務時間（分）: 22:00〜翌5:00の勤務時間
    night_minutes = Column(Integer, default=0, nullable=True)

    # 当日支給額（円）: 時給 × 勤務時間 + 深夜割増 + 残業割増
    wage = Column(Integer, nullable=True)

    # リレーションシップ
    staff = relationship("Staff", back_populates="attendances")

    def __repr__(self):
        return f"<Attendance id={self.id} staff_id={self.staff_id} date={self.date}>"
