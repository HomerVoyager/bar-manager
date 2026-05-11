# 勤怠モデル
# スタッフの出退勤記録と給与計算データを管理

from sqlalchemy import Column, Integer, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Attendance(Base):
    """勤怠テーブル"""
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True, index=True)
    clock_in = Column(DateTime, nullable=True)
    clock_out = Column(DateTime, nullable=True)
    date = Column(Date, nullable=False, index=True)

    # 休憩
    break_start = Column(DateTime, nullable=True)
    break_end = Column(DateTime, nullable=True)
    break_minutes = Column(Integer, default=0, nullable=False)

    # 勤務時間（分）: clock_out - clock_in - break_minutes
    work_minutes = Column(Integer, nullable=True)
    night_minutes = Column(Integer, default=0, nullable=True)
    wage = Column(Integer, nullable=True)

    staff = relationship("Staff", back_populates="attendances")

    def __repr__(self):
        return f"<Attendance id={self.id} staff_id={self.staff_id} date={self.date}>"
