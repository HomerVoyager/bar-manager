from sqlalchemy import Column, Integer, ForeignKey, DateTime, String
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class StaffDrink(Base):
    """スタッフドリンクテーブル（ドリンクバック管理）"""
    __tablename__ = "staff_drinks"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False, index=True)
    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    qty = Column(Integer, nullable=False, default=1)
    unit_price = Column(Integer, nullable=False)
    back_amount = Column(Integer, nullable=False)
    note = Column(String(200), nullable=True)
    ordered_at = Column(DateTime, default=func.now(), nullable=False)

    staff = relationship("Staff", back_populates="staff_drinks")
    product = relationship("Product")
