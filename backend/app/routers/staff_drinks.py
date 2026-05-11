from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.staff import Staff
from app.models.staff_drink import StaffDrink
from app.models.session import Session as BarSession
from app.models.product import Product
from app.schemas.staff_drink import StaffDrinkCreate, StaffDrinkResponse

router = APIRouter()


@router.get("/", response_model=List[StaffDrinkResponse], summary="スタッフドリンク一覧")
def list_staff_drinks(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user),
):
    drinks = db.query(StaffDrink).filter(StaffDrink.session_id == session_id).all()
    result = []
    for d in drinks:
        staff = db.query(Staff).filter(Staff.id == d.staff_id).first()
        product = db.query(Product).filter(Product.id == d.product_id).first() if d.product_id else None
        result.append(StaffDrinkResponse(
            id=d.id,
            session_id=d.session_id,
            staff_id=d.staff_id,
            product_id=d.product_id,
            qty=d.qty,
            unit_price=d.unit_price,
            back_amount=d.back_amount,
            note=d.note,
            ordered_at=d.ordered_at,
            staff_name=staff.name if staff else None,
            product_name=product.name if product else None,
        ))
    return result


@router.post("/", response_model=StaffDrinkResponse, status_code=status.HTTP_201_CREATED, summary="スタッフドリンク追加")
def create_staff_drink(
    data: StaffDrinkCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user),
):
    session = db.query(BarSession).filter(BarSession.id == data.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="セッションが見つかりません")
    if session.status != "open":
        raise HTTPException(status_code=400, detail="精算済みのセッションには追加できません")

    staff = db.query(Staff).filter(Staff.id == data.staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="スタッフが見つかりません")

    product = None
    unit_price = 0
    if data.product_id:
        product = db.query(Product).filter(Product.id == data.product_id).first()
        if not product:
            raise HTTPException(status_code=404, detail="商品が見つかりません")
        unit_price = product.price

    back_amount = int(unit_price * data.qty * staff.drink_back_rate / 100)

    drink = StaffDrink(
        session_id=data.session_id,
        staff_id=data.staff_id,
        product_id=data.product_id,
        qty=data.qty,
        unit_price=unit_price,
        back_amount=back_amount,
        note=data.note,
    )
    db.add(drink)
    db.commit()
    db.refresh(drink)

    return StaffDrinkResponse(
        id=drink.id,
        session_id=drink.session_id,
        staff_id=drink.staff_id,
        product_id=drink.product_id,
        qty=drink.qty,
        unit_price=drink.unit_price,
        back_amount=drink.back_amount,
        note=drink.note,
        ordered_at=drink.ordered_at,
        staff_name=staff.name,
        product_name=product.name if product else None,
    )


@router.delete("/{drink_id}", status_code=status.HTTP_204_NO_CONTENT, summary="スタッフドリンク削除")
def delete_staff_drink(
    drink_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user),
):
    drink = db.query(StaffDrink).filter(StaffDrink.id == drink_id).first()
    if not drink:
        raise HTTPException(status_code=404, detail="レコードが見つかりません")
    db.delete(drink)
    db.commit()
