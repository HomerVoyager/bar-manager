from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import date

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_manager_or_above
from app.models.staff import Staff
from app.models.shift import Shift
from app.schemas.shift import ShiftCreate, ShiftUpdate, ShiftResponse

router = APIRouter()


@router.get("/", response_model=List[ShiftResponse])
def list_shifts(
    date_from: date = Query(...),
    date_to: date = Query(...),
    staff_id: int = Query(None),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user),
):
    query = db.query(Shift).options(joinedload(Shift.staff)).filter(
        Shift.date >= date_from,
        Shift.date <= date_to,
    )
    if staff_id:
        query = query.filter(Shift.staff_id == staff_id)
    return query.order_by(Shift.date, Shift.staff_id).all()


@router.post("/", response_model=ShiftResponse, status_code=status.HTTP_201_CREATED)
def create_shift(
    body: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above),
):
    existing = db.query(Shift).filter(
        Shift.staff_id == body.staff_id,
        Shift.date == body.date,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="この日のシフトは既に登録されています")

    shift = Shift(**body.model_dump())
    db.add(shift)
    db.commit()
    return db.query(Shift).options(joinedload(Shift.staff)).filter(Shift.id == shift.id).first()


@router.put("/{shift_id}", response_model=ShiftResponse)
def update_shift(
    shift_id: int,
    body: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above),
):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="シフトが見つかりません")

    for key, val in body.model_dump(exclude_none=True).items():
        setattr(shift, key, val)
    db.commit()
    return db.query(Shift).options(joinedload(Shift.staff)).filter(Shift.id == shift_id).first()


@router.delete("/{shift_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shift(
    shift_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above),
):
    shift = db.query(Shift).filter(Shift.id == shift_id).first()
    if not shift:
        raise HTTPException(status_code=404, detail="シフトが見つかりません")
    db.delete(shift)
    db.commit()
