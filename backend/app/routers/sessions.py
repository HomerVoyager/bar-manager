# セッションルーター
# 来店セッションの管理（開始・注文・精算）

import math
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.staff import Staff
from app.models.table import Table
from app.models.session import Session as BarSession
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.stock_log import StockLog
from app.schemas.session import SessionCreate, SessionResponse, SplitBillResponse
from app.schemas.order_item import OrderItemCreate, OrderItemResponse
from app.routers.ws import manager as ws_manager

router = APIRouter()


async def _broadcast_table_update(table: Table, db: Session):
    """テーブルの状態変更をWebSocketで全クライアントに配信"""
    await ws_manager.broadcast({
        "type": "table_update",
        "data": {
            "id": table.id,
            "name": table.name,
            "status": table.status,
            "capacity": table.capacity,
        }
    })


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED, summary="セッション開始（来店）")
async def open_session(
    session_data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    新しい来店セッションを開始する
    - テーブルのステータスを 'occupied' に変更
    - WebSocketで全クライアントにテーブル更新を配信
    """
    # テーブルの存在チェック
    table = db.query(Table).filter(Table.id == session_data.table_id).first()
    if not table:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"テーブルID {session_data.table_id} が見つかりません"
        )

    # テーブルが空席かチェック
    if table.status == "occupied":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"テーブル '{table.name}' は既に使用中です"
        )

    # セッションを作成
    new_session = BarSession(
        table_id=session_data.table_id,
        staff_id=session_data.staff_id or current_user.id,
        guest_count=session_data.guest_count,
        plan_type=session_data.plan_type,
        time_limit_minutes=session_data.time_limit_minutes,
        set_fee=session_data.set_fee,
        nomi_hodai_price=session_data.nomi_hodai_price if session_data.plan_type == "nomi_hodai" else 0,
    )
    db.add(new_session)

    # テーブルのステータスを「使用中」に変更
    table.status = "occupied"

    db.commit()
    db.refresh(new_session)

    # WebSocketで全クライアントにテーブル更新を配信
    await _broadcast_table_update(table, db)

    return new_session


@router.get("/active", response_model=List[dict], summary="アクティブセッション一覧")
def list_active_sessions(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    現在進行中の全セッションをテーブル・注文情報付きで返す
    フロアモニター画面に使用
    """
    sessions = db.query(BarSession).options(
        joinedload(BarSession.table),
        joinedload(BarSession.staff),
        joinedload(BarSession.order_items).joinedload(OrderItem.product)
    ).filter(
        BarSession.status == "open"
    ).order_by(BarSession.started_at).all()

    result = []
    for s in sessions:
        # 注文アイテムの小計を計算
        items = []
        for item in s.order_items:
            items.append({
                "id": item.id,
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else "不明",
                "qty": item.qty,
                "unit_price": item.unit_price,
                "subtotal": item.qty * item.unit_price,
                "ordered_at": item.ordered_at.isoformat(),
            })

        result.append({
            "id": s.id,
            "table_id": s.table_id,
            "table_name": s.table.name if s.table else "不明",
            "staff_id": s.staff_id,
            "staff_name": s.staff.name if s.staff else "不明",
            "guest_count": s.guest_count,
            "started_at": s.started_at.isoformat(),
            "total": sum(item["subtotal"] for item in items),
            "status": s.status,
            "order_items": items,
        })

    return result


@router.get("/{session_id}", response_model=dict, summary="セッション詳細取得")
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定したセッションの詳細を注文アイテム付きで返す
    """
    session = db.query(BarSession).options(
        joinedload(BarSession.table),
        joinedload(BarSession.staff),
        joinedload(BarSession.order_items).joinedload(OrderItem.product)
    ).filter(BarSession.id == session_id).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"セッションID {session_id} が見つかりません"
        )

    items = []
    for item in session.order_items:
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "product_name": item.product.name if item.product else "不明",
            "category": item.product.category if item.product else None,
            "qty": item.qty,
            "unit_price": item.unit_price,
            "subtotal": item.qty * item.unit_price,
            "ordered_at": item.ordered_at.isoformat(),
        })

    return {
        "id": session.id,
        "table_id": session.table_id,
        "table_name": session.table.name if session.table else "不明",
        "staff_id": session.staff_id,
        "staff_name": session.staff.name if session.staff else "不明",
        "guest_count": session.guest_count,
        "started_at": session.started_at.isoformat(),
        "closed_at": session.closed_at.isoformat() if session.closed_at else None,
        "total": session.total,
        "status": session.status,
        "order_items": items,
    }


@router.post("/{session_id}/items", response_model=OrderItemResponse, status_code=status.HTTP_201_CREATED, summary="注文追加")
async def add_order_item(
    session_id: int,
    item_data: OrderItemCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    セッションに注文アイテムを追加する
    - 在庫数から自動で差し引く
    - 在庫が不足している場合はエラー
    """
    # セッションの存在・状態チェック
    session = db.query(BarSession).filter(BarSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"セッションID {session_id} が見つかりません"
        )
    if session.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="精算済みのセッションに注文を追加することはできません"
        )

    # 商品の存在チェック
    product = db.query(Product).filter(
        Product.id == item_data.product_id,
        Product.is_active == True  # noqa: E712
    ).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"商品ID {item_data.product_id} が見つかりません"
        )

    # 在庫チェック
    if product.stock_qty < item_data.qty:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"'{product.name}' の在庫が不足しています（在庫: {product.stock_qty}, 注文: {item_data.qty}）"
        )

    # 注文アイテムを作成（注文時の価格を保存）
    order_item = OrderItem(
        session_id=session_id,
        product_id=item_data.product_id,
        qty=item_data.qty,
        unit_price=product.price,  # 注文時点の価格を記録
    )
    db.add(order_item)

    # 在庫を減らす
    product.stock_qty -= item_data.qty

    # 在庫ログに販売記録を追加
    stock_log = StockLog(
        product_id=item_data.product_id,
        change_qty=-item_data.qty,  # 販売なので負の値
        reason="sale",
        staff_id=current_user.id,
    )
    db.add(stock_log)

    db.commit()
    db.refresh(order_item)
    return order_item


@router.delete("/{session_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT, summary="注文削除")
async def remove_order_item(
    session_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    セッションから注文アイテムを削除する
    - 在庫を元に戻す
    """
    # セッションの状態チェック
    session = db.query(BarSession).filter(BarSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"セッションID {session_id} が見つかりません"
        )
    if session.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="精算済みセッションの注文は変更できません"
        )

    # 注文アイテムのチェック
    order_item = db.query(OrderItem).filter(
        OrderItem.id == item_id,
        OrderItem.session_id == session_id
    ).first()
    if not order_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"注文アイテムID {item_id} が見つかりません"
        )

    # 在庫を元に戻す
    product = db.query(Product).filter(Product.id == order_item.product_id).first()
    if product:
        product.stock_qty += order_item.qty

    db.delete(order_item)
    db.commit()


@router.post("/{session_id}/close", response_model=dict, summary="セッション精算")
async def close_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    セッションを精算する
    - 全注文アイテムの合計を計算
    - セッションのステータスを 'closed' に変更
    - テーブルのステータスを 'empty' に変更
    - WebSocketで全クライアントにテーブル更新を配信
    """
    from datetime import datetime

    session = db.query(BarSession).options(
        joinedload(BarSession.order_items),
        joinedload(BarSession.table)
    ).filter(BarSession.id == session_id).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"セッションID {session_id} が見つかりません"
        )
    if session.status != "open":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="このセッションは既に精算済みです"
        )

    # 合計金額を計算（セット料金＋飲み放題コース料金＋延長料金含む）
    nomi_hodai_total = (session.nomi_hodai_price or 0) * session.guest_count if session.plan_type == "nomi_hodai" else 0
    total = sum(item.qty * item.unit_price for item in session.order_items) + (session.set_fee or 0) + nomi_hodai_total + (session.extension_fee or 0)

    # セッションを精算済みに更新
    session.total = total
    session.closed_at = datetime.now()
    session.status = "closed"

    # テーブルを空席に変更
    if session.table:
        session.table.status = "empty"

    db.commit()
    db.refresh(session)

    # WebSocketで全クライアントにテーブル更新を配信
    if session.table:
        await _broadcast_table_update(session.table, db)

    return {
        "session_id": session.id,
        "total": session.total,
        "closed_at": session.closed_at.isoformat(),
        "status": session.status,
        "message": f"精算完了: ¥{session.total:,}"
    }


class ExtendRequest(BaseModel):
    fee_per_person: int = 0


class SessionUpdate(BaseModel):
    time_limit_minutes: int | None = None
    extension_fee: int | None = None


@router.patch("/{session_id}", response_model=dict, summary="セッション情報修正")
async def update_session(
    session_id: int,
    body: SessionUpdate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """time_limit_minutes / extension_fee を直接修正する（操作ミス訂正用）"""
    session = db.query(BarSession).filter(BarSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"セッションID {session_id} が見つかりません")
    if session.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="精算済みのセッションは変更できません")

    if body.time_limit_minutes is not None:
        session.time_limit_minutes = body.time_limit_minutes
    if body.extension_fee is not None:
        session.extension_fee = body.extension_fee
    db.commit()
    return {"session_id": session.id, "time_limit_minutes": session.time_limit_minutes, "extension_fee": session.extension_fee}


@router.patch("/{session_id}/extend", response_model=dict, summary="飲み放題延長")
async def extend_session(
    session_id: int,
    body: ExtendRequest = ExtendRequest(),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """飲み放題の制限時間を30分延長する。fee_per_person を指定すると延長料金を加算。"""
    session = db.query(BarSession).filter(BarSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"セッションID {session_id} が見つかりません")
    if session.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="精算済みのセッションは延長できません")
    if session.plan_type != "nomi_hodai":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="飲み放題プランのみ延長できます")

    session.time_limit_minutes = (session.time_limit_minutes or 0) + 30
    session.extension_fee = (session.extension_fee or 0) + body.fee_per_person * session.guest_count
    db.commit()
    return {
        "session_id": session.id,
        "time_limit_minutes": session.time_limit_minutes,
        "extension_fee": session.extension_fee,
    }


@router.post("/{session_id}/split", response_model=SplitBillResponse, summary="割り勘計算")
def split_bill(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    セッションの割り勘金額を計算する
    - 一人当たりの金額を切り上げで計算
    - 注文内訳付きで返す
    """
    session = db.query(BarSession).options(
        joinedload(BarSession.order_items).joinedload(OrderItem.product)
    ).filter(BarSession.id == session_id).first()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"セッションID {session_id} が見つかりません"
        )

    # 注文内訳を作成
    items_breakdown = []
    total = 0
    for item in session.order_items:
        subtotal = item.qty * item.unit_price
        total += subtotal
        items_breakdown.append({
            "product_name": item.product.name if item.product else "不明",
            "qty": item.qty,
            "unit_price": item.unit_price,
            "subtotal": subtotal,
        })

    # 一人当たりの金額（切り上げ）
    guest_count = session.guest_count
    per_person = math.ceil(total / guest_count) if guest_count > 0 else total

    return SplitBillResponse(
        session_id=session_id,
        total=total,
        guest_count=guest_count,
        per_person=per_person,
        items_breakdown=items_breakdown,
    )
