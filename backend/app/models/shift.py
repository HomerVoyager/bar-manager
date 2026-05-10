from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Shift(Base):
    __tablename__ = "shifts"

    id = Column(Integer, primary_key=True, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    start_time = Column(String(5), nullable=False)  # "18:00"
    end_time = Column(String(5), nullable=False)    # "23:00"
    note = Column(String(200), nullable=True)

    staff = relationship("Staff", back_populates="shifts")
