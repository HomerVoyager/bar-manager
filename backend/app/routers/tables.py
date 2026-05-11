# テーブルルーター
# 座席の管理とステータス更新

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_manager_or_above
from app.models.staff import Staff
from app.models.table import Table
from app.models.session import Session as BarSession
from app.models.order_item import OrderItem
from app.models.product import Product
from app.schemas.table import TableCreate, TableUpdate, TableResponse, TableStatusUpdate

router = APIRouter()


@router.get("/", response_model=List[dict], summary="テーブル一覧取得（セッション情報付き）")
def list_tables(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    全テーブルの一覧を現在のセッション情報付きで返す
    フロアマップ表示に使用
    """
    tables = db.query(Table).order_by(Table.name).all()

    result = []
    for table in tables:
        # 現在進行中のセッションを取得
        active_session = db.query(BarSession).filter(
            BarSession.table_id == table.id,
            BarSession.status == "open"
        ).first()

        session_data = None
        if active_session:
            order_items = db.query(OrderItem).filter(
                OrderItem.session_id == active_session.id
            ).all()
            product_names: dict = {}
            if order_items:
                product_ids = [i.product_id for i in order_items]
                prods = db.query(Product).filter(Product.id.in_(product_ids)).all()
                product_names = {p.id: p.name for p in prods}
            nomi_hodai_total = (active_session.nomi_hodai_price or 0) * active_session.guest_count if active_session.plan_type == "nomi_hodai" else 0
            live_total = sum(oi.qty * oi.unit_price for oi in order_items) + (active_session.set_fee or 0) + nomi_hodai_total + (active_session.extension_fee or 0)
            session_data = {
                "id": active_session.id,
                "guest_count": active_session.guest_count,
                "started_at": active_session.started_at.isoformat() + "Z",
                "total": live_total,
                "status": active_session.status,
                "plan_type": active_session.plan_type,
                "time_limit_minutes": active_session.time_limit_minutes,
                "set_fee": active_session.set_fee or 0,
                "nomi_hodai_price": active_session.nomi_hodai_price or 0,
                "extension_fee": active_session.extension_fee or 0,
                "items": [
                    {
                        "id": oi.id,
                        "session_id": oi.session_id,
                        "product_id": oi.product_id,
                        "product_name": product_names.get(oi.product_id, ""),
                        "qty": oi.qty,
                        "unit_price": oi.unit_price,
                        "ordered_at": oi.ordered_at.isoformat() if oi.ordered_at else None,
                    }
                    for oi in order_items
                ],
            }

        table_data = {
            "id": table.id,
            "name": table.name,
            "capacity": table.capacity,
            "status": table.status,
            "current_session_id": active_session.id if active_session else None,
            "current_session": session_data,
        }
        result.append(table_data)

    return result


@router.post("/", response_model=TableResponse, status_code=status.HTTP_201_CREATED, summary="テーブル登録")
def create_table(
    table_data: TableCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above)  # マネージャー以上
):
    """
    新テーブルを登録する
    マネージャー権限が必要
    """
    # 同名テーブルの重複チェック
    existing = db.query(Table).filter(Table.name == table_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"テーブル名 '{table_data.name}' は既に登録されています"
        )

    new_table = Table(
        name=table_data.name,
        capacity=table_data.capacity,
    )
    db.add(new_table)
    db.commit()
    db.refresh(new_table)
    return new_table


@router.get("/{table_id}", response_model=dict, summary="テーブル詳細取得")
def get_table(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定したテーブルの詳細情報を現在のセッション情報付きで返す
    """
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"テーブルID {table_id} が見つかりません"
        )

    active_session = db.query(BarSession).filter(
        BarSession.table_id == table.id,
        BarSession.status == "open"
    ).first()

    return {
        "id": table.id,
        "name": table.name,
        "capacity": table.capacity,
        "status": table.status,
        "current_session_id": active_session.id if active_session else None,
    }


@router.put("/{table_id}", response_model=TableResponse, summary="テーブル情報更新")
def update_table(
    table_id: int,
    table_data: TableUpdate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above)  # マネージャー以上
):
    """
    テーブル情報を更新する
    マネージャー権限が必要
    """
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"テーブルID {table_id} が見つかりません"
        )

    update_data = table_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(table, field, value)

    db.commit()
    db.refresh(table)
    return table


@router.put("/{table_id}/status", response_model=TableResponse, summary="テーブルステータス更新")
def update_table_status(
    table_id: int,
    status_data: TableStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    テーブルのステータスを更新する
    セッション開始・終了時に自動で呼ばれる他、手動更新も可能
    """
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"テーブルID {table_id} が見つかりません"
        )

    # 有効なステータスのチェック
    valid_statuses = ["empty", "occupied", "reserved"]
    if status_data.status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"無効なステータスです。有効な値: {', '.join(valid_statuses)}"
        )

    table.status = status_data.status
    db.commit()
    db.refresh(table)
    return table


@router.delete("/{table_id}", status_code=status.HTTP_204_NO_CONTENT, summary="テーブル削除")
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above)  # マネージャー以上
):
    """
    テーブルを削除する
    進行中のセッションがある場合は削除不可
    マネージャー権限が必要
    """
    table = db.query(Table).filter(Table.id == table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"テーブルID {table_id} が見つかりません"
        )

    # 進行中セッションのチェック
    active_session = db.query(BarSession).filter(
        BarSession.table_id == table_id,
        BarSession.status == "open"
    ).first()
    if active_session:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="進行中のセッションがあるため、テーブルを削除できません"
        )

    db.delete(table)
    db.commit()
