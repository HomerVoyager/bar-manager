# 在庫ルーター
# 在庫変動の記録と在庫アラート管理

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.staff import Staff
from app.models.product import Product
from app.models.stock_log import StockLog
from app.schemas.stock_log import StockLogCreate, StockLogResponse
from app.schemas.product import ProductResponse

router = APIRouter()


@router.get("/logs", response_model=List[StockLogResponse], summary="在庫ログ一覧")
def list_stock_logs(
    product_id: Optional[int] = Query(None, description="商品IDでフィルター"),
    reason: Optional[str] = Query(None, description="理由でフィルター (purchase/sale/loss)"),
    date_from: Optional[date] = Query(None, description="開始日"),
    date_to: Optional[date] = Query(None, description="終了日"),
    limit: int = Query(100, ge=1, le=500, description="取得件数"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    在庫変動の履歴を返す
    商品・理由・日付でフィルター可能
    """
    query = db.query(StockLog).options(
        joinedload(StockLog.product),
        joinedload(StockLog.staff)
    )

    # フィルター条件を適用
    if product_id:
        query = query.filter(StockLog.product_id == product_id)

    if reason:
        query = query.filter(StockLog.reason == reason)

    if date_from:
        query = query.filter(StockLog.created_at >= date_from)

    if date_to:
        # 終了日は当日23:59:59まで含める
        from datetime import datetime, timedelta
        date_to_end = datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        query = query.filter(StockLog.created_at < date_to_end)

    logs = query.order_by(StockLog.created_at.desc()).limit(limit).all()
    return logs


@router.post("/logs", response_model=StockLogResponse, status_code=status.HTTP_201_CREATED, summary="在庫ログ追加")
def create_stock_log(
    log_data: StockLogCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    在庫変動を記録する
    - 仕入（purchase）: change_qty は正の値
    - 廃棄（loss）: change_qty は負の値
    - 在庫数も自動で更新
    """
    # 商品の存在チェック
    product = db.query(Product).filter(Product.id == log_data.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"商品ID {log_data.product_id} が見つかりません"
        )

    # 在庫が負にならないかチェック
    new_stock = product.stock_qty + log_data.change_qty
    if new_stock < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"在庫が不足しています（現在在庫: {product.stock_qty}, 変動: {log_data.change_qty}）"
        )

    # 在庫ログを作成
    new_log = StockLog(
        product_id=log_data.product_id,
        change_qty=log_data.change_qty,
        reason=log_data.reason,
        staff_id=current_user.id,
    )
    db.add(new_log)

    # 在庫数を更新
    product.stock_qty = new_stock

    db.commit()
    db.refresh(new_log)

    # リレーションをロード
    db.refresh(new_log)
    return new_log


@router.get("/alerts", response_model=List[ProductResponse], summary="在庫アラート商品一覧")
def get_stock_alerts(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    在庫がアラート数量以下の商品を返す
    ダッシュボードと在庫管理画面で使用
    """
    products = db.query(Product).filter(
        Product.is_active == True,  # noqa: E712
        Product.stock_qty <= Product.alert_qty
    ).order_by(Product.stock_qty).all()

    result = []
    for product in products:
        product_data = ProductResponse.model_validate(product)
        product_data.is_low_stock = True
        result.append(product_data)

    return result
