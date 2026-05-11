# 勤怠モデル
# スタッフの出退勤記録と給与計算データを管理

from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey
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

    # 欠勤・有給管理: null=通常出勤, 'absent'=欠勤, 'paid_leave'=有給, 'special_leave'=特休
    absence_type = Column(String(20), nullable=True)
    absence_note = Column(String(200), nullable=True)

    staff = relationship("Staff", back_populates="attendances")

    def __repr__(self):
        return f"<Attendance id={self.id} staff_id={self.staff_id} date={self.date}>"
