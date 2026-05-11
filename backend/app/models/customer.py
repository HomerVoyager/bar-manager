# 顧客モデル
from sqlalchemy import Column, Integer, String, Date, Text, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(200), nullable=True)
    birthday = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    visit_count = Column(Integer, default=0, nullable=False)
    last_visit_date = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<Customer id={self.id} name={self.name}>"
