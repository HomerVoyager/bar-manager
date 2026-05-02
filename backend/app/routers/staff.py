# スタッフルーター
# スタッフの登録・更新・削除（論理削除）

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_manager
from app.core.security import get_password_hash
from app.models.staff import Staff
from app.schemas.staff import StaffCreate, StaffUpdate, StaffResponse

router = APIRouter()


@router.get("/", response_model=List[StaffResponse], summary="スタッフ一覧取得")
def list_staff(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    在籍中のスタッフ一覧を返す
    全スタッフがアクセス可能
    """
    staff_list = db.query(Staff).filter(
        Staff.is_active == True  # noqa: E712
    ).order_by(Staff.name).all()
    return staff_list


@router.post("/", response_model=StaffResponse, status_code=status.HTTP_201_CREATED, summary="スタッフ登録")
def create_staff(
    staff_data: StaffCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)  # マネージャーのみ
):
    """
    新規スタッフを登録する
    マネージャー権限が必要
    """
    # 同名スタッフの重複チェック
    existing = db.query(Staff).filter(
        Staff.name == staff_data.name,
        Staff.is_active == True  # noqa: E712
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"スタッフ名 '{staff_data.name}' は既に登録されています"
        )

    # パスワードをハッシュ化して保存
    new_staff = Staff(
        name=staff_data.name,
        role=staff_data.role,
        hourly_wage=staff_data.hourly_wage,
        face_id=staff_data.face_id,
        password_hash=get_password_hash(staff_data.password),
    )
    db.add(new_staff)
    db.commit()
    db.refresh(new_staff)
    return new_staff


@router.get("/{staff_id}", response_model=StaffResponse, summary="スタッフ詳細取得")
def get_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定したスタッフの詳細情報を返す
    """
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"スタッフID {staff_id} が見つかりません"
        )
    return staff


@router.put("/{staff_id}", response_model=StaffResponse, summary="スタッフ情報更新")
def update_staff(
    staff_id: int,
    staff_data: StaffUpdate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)  # マネージャーのみ
):
    """
    スタッフ情報を更新する
    マネージャー権限が必要
    """
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"スタッフID {staff_id} が見つかりません"
        )

    # 変更フィールドのみ更新
    update_data = staff_data.model_dump(exclude_unset=True)

    # パスワード変更がある場合はハッシュ化
    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))

    for field, value in update_data.items():
        setattr(staff, field, value)

    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=status.HTTP_204_NO_CONTENT, summary="スタッフ削除（論理削除）")
def delete_staff(
    staff_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)  # マネージャーのみ
):
    """
    スタッフを論理削除する（is_active=False に設定）
    データの整合性を保つため物理削除は行わない
    マネージャー権限が必要
    """
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"スタッフID {staff_id} が見つかりません"
        )

    # 自分自身は削除できない
    if staff_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="自分自身を削除することはできません"
        )

    # 論理削除（退職処理）
    staff.is_active = False
    db.commit()
