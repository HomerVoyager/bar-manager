# 顧客管理ルーター
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.deps import get_current_manager_or_above
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter(tags=["customers"])


@router.get("/", response_model=List[CustomerResponse])
def list_customers(
    search: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _=Depends(get_current_manager_or_above),
):
    q = db.query(Customer)
    if search:
        pattern = f"%{search}%"
        q = q.filter(
            Customer.name.ilike(pattern) |
            Customer.phone.ilike(pattern) |
            Customer.email.ilike(pattern)
        )
    return q.order_by(Customer.name).offset(skip).limit(limit).all()


@router.post("/", response_model=CustomerResponse)
def create_customer(
    body: CustomerCreate,
    db: Session = Depends(get_db),
    _=Depends(get_current_manager_or_above),
):
    customer = Customer(**body.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_manager_or_above),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    return customer


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    body: CustomerUpdate,
    db: Session = Depends(get_db),
    _=Depends(get_current_manager_or_above),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_manager_or_above),
):
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    db.delete(customer)
    db.commit()
    return {"message": "削除しました"}


@router.post("/{customer_id}/visit")
def record_visit(
    customer_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_manager_or_above),
):
    from datetime import date
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="顧客が見つかりません")
    customer.visit_count += 1
    customer.last_visit_date = date.today()
    db.commit()
    db.refresh(customer)
    return customer
