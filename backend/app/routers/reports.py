# レポートルーター
# 売上・原価分析レポートの生成

import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import Optional
from datetime import date, datetime, timedelta
import calendar

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_manager
from app.models.staff import Staff
from app.models.session import Session as BarSession
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.attendance import Attendance

router = APIRouter()


@router.get("/sales/daily", summary="日次売上レポート")
def get_daily_sales(
    target_date: date = Query(default=None, alias="date", description="集計日（省略時は今日）"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    if not target_date:
        target_date = date.today()

    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = datetime.combine(target_date + timedelta(days=1), datetime.min.time())

    sessions = db.query(BarSession).filter(
        BarSession.closed_at >= day_start,
        BarSession.closed_at < day_end,
        BarSession.status == "closed"
    ).all()

    total_sales = sum(s.total for s in sessions)
    total_guests = sum(s.guest_count for s in sessions)

    session_ids = [s.id for s in sessions]
    product_breakdown = []
    if session_ids:
        rows = db.query(
            Product.name,
            Product.category,
            func.sum(OrderItem.qty).label("qty"),
            func.sum(OrderItem.qty * OrderItem.unit_price).label("total"),
        ).join(
            OrderItem, OrderItem.product_id == Product.id
        ).filter(
            OrderItem.session_id.in_(session_ids)
        ).group_by(
            Product.id, Product.name, Product.category
        ).order_by(
            func.sum(OrderItem.qty * OrderItem.unit_price).desc()
        ).all()

        product_breakdown = [
            {"product_name": r.name, "category": r.category, "qty": r.qty, "total": r.total}
            for r in rows
        ]

    # 時間帯別集計
    hourly = {h: {"hour": h, "sales": 0, "guests": 0} for h in range(24)}
    for s in sessions:
        if s.closed_at:
            h = s.closed_at.hour
            hourly[h]["sales"] += s.total
            hourly[h]["guests"] += s.guest_count

    return {
        "period": target_date.isoformat(),
        "total_sales": total_sales,
        "total_guests": total_guests,
        "avg_per_guest": int(total_sales / total_guests) if total_guests > 0 else 0,
        "daily_data": [],
        "product_breakdown": product_breakdown,
        "hourly_data": list(hourly.values()),
    }


@router.get("/sales/monthly", summary="月次売上レポート")
def get_monthly_sales(
    year: int = Query(default=None, description="年（省略時は今年）"),
    month: int = Query(default=None, description="月（省略時は今月）"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定月の売上レポートを日次内訳付きで返す
    月次チャート表示に使用
    """
    today = date.today()
    year = year or today.year
    month = month or today.month

    last_day = calendar.monthrange(year, month)[1]
    month_start = datetime(year, month, 1)
    month_end = datetime(year, month, last_day, 23, 59, 59)

    # 月次セッション取得
    sessions = db.query(BarSession).filter(
        BarSession.closed_at >= month_start,
        BarSession.closed_at <= month_end,
        BarSession.status == "closed"
    ).all()

    # 日次内訳を計算
    daily_data = {}
    for day in range(1, last_day + 1):
        daily_data[day] = {"date": f"{year}-{month:02d}-{day:02d}", "sales": 0, "guests": 0, "sessions": 0}

    for s in sessions:
        if s.closed_at:
            day = s.closed_at.day
            daily_data[day]["sales"] += s.total
            daily_data[day]["guests"] += s.guest_count
            daily_data[day]["sessions"] += 1

    total_sales = sum(s.total for s in sessions)
    total_guests = sum(s.guest_count for s in sessions)

    return {
        "period": f"{year}-{month:02d}",
        "total_sales": total_sales,
        "total_guests": total_guests,
        "avg_per_guest": int(total_sales / total_guests) if total_guests > 0 else 0,
        "daily_data": list(daily_data.values()),
        "product_breakdown": [],
        "hourly_data": [],
    }


@router.get("/sales/yearly", summary="年次売上レポート")
def get_yearly_sales(
    year: int = Query(default=None, description="年（省略時は今年）"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定年の売上レポートを月次内訳付きで返す
    年次チャート表示に使用
    """
    year = year or date.today().year

    year_start = datetime(year, 1, 1)
    year_end = datetime(year, 12, 31, 23, 59, 59)

    sessions = db.query(BarSession).filter(
        BarSession.closed_at >= year_start,
        BarSession.closed_at <= year_end,
        BarSession.status == "closed"
    ).all()

    # 月次内訳を計算
    monthly_data = {
        m: {"month": m, "sales": 0, "guests": 0, "sessions": 0}
        for m in range(1, 13)
    }

    for s in sessions:
        if s.closed_at:
            m = s.closed_at.month
            monthly_data[m]["sales"] += s.total
            monthly_data[m]["guests"] += s.guest_count
            monthly_data[m]["sessions"] += 1

    total_sales = sum(s.total for s in sessions)
    total_guests = sum(s.guest_count for s in sessions)

    monthly_list = list(monthly_data.values())
    # daily_dataキーで返す（フロントエンドのSalesReport型に合わせる）
    daily_data_for_chart = [
        {"date": f"{year}-{m['month']:02d}-01", "sales": m["sales"], "guests": m["guests"]}
        for m in monthly_list
    ]

    return {
        "period": str(year),
        "total_sales": total_sales,
        "total_guests": total_guests,
        "avg_per_guest": int(total_sales / total_guests) if total_guests > 0 else 0,
        "daily_data": daily_data_for_chart,
        "product_breakdown": [],
        "hourly_data": [],
    }


@router.get("/sales/by-product", summary="商品別売上分析")
def get_sales_by_product(
    date_from: Optional[date] = Query(None, description="開始日"),
    date_to: Optional[date] = Query(None, description="終了日"),
    category: Optional[str] = Query(None, description="カテゴリフィルター"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    商品別の売上数量・金額・原価・粗利を返す
    メニュー改善の分析に使用
    """
    # デフォルト: 直近30日
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()

    from_dt = datetime.combine(date_from, datetime.min.time())
    to_dt = datetime.combine(date_to + timedelta(days=1), datetime.min.time())

    # 精算済みセッションのIDを取得
    session_ids = [
        s.id for s in db.query(BarSession.id).filter(
            BarSession.closed_at >= from_dt,
            BarSession.closed_at < to_dt,
            BarSession.status == "closed"
        ).all()
    ]

    query = db.query(
        Product.id,
        Product.name,
        Product.category,
        Product.price,
        Product.cost,
        func.sum(OrderItem.qty).label("total_qty"),
        func.sum(OrderItem.qty * OrderItem.unit_price).label("total_sales"),
    ).join(
        OrderItem, OrderItem.product_id == Product.id
    )

    if session_ids:
        query = query.filter(OrderItem.session_id.in_(session_ids))
    else:
        # セッションがない場合は空を返す
        return {"date_from": date_from.isoformat(), "date_to": date_to.isoformat(), "products": []}

    if category:
        query = query.filter(Product.category == category)

    results = query.group_by(
        Product.id, Product.name, Product.category, Product.price, Product.cost
    ).order_by(func.sum(OrderItem.qty * OrderItem.unit_price).desc()).all()

    products = []
    for row in results:
        total_cost = row.total_qty * row.cost
        gross_profit = row.total_sales - total_cost
        margin_rate = (gross_profit / row.total_sales * 100) if row.total_sales > 0 else 0

        products.append({
            "product_id": row.id,
            "product_name": row.name,
            "category": row.category,
            "unit_price": row.price,
            "unit_cost": row.cost,
            "total_qty": row.total_qty,
            "total_sales": row.total_sales,
            "total_cost": total_cost,
            "gross_profit": gross_profit,
            "margin_rate": round(margin_rate, 1),
        })

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "products": products,
    }


@router.get("/sales/by-hour", summary="時間帯別売上分析")
def get_sales_by_hour(
    date_from: Optional[date] = Query(None, description="開始日"),
    date_to: Optional[date] = Query(None, description="終了日"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    時間帯別の注文件数・売上を返す
    ピークタイム把握と人員配置の最適化に使用
    """
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()

    from_dt = datetime.combine(date_from, datetime.min.time())
    to_dt = datetime.combine(date_to + timedelta(days=1), datetime.min.time())

    # 時間帯別に注文を集計
    order_items = db.query(OrderItem).join(
        BarSession, BarSession.id == OrderItem.session_id
    ).filter(
        BarSession.closed_at >= from_dt,
        BarSession.closed_at < to_dt,
        BarSession.status == "closed"
    ).all()

    hourly_data = {h: {"hour": h, "order_count": 0, "total_amount": 0} for h in range(24)}

    for item in order_items:
        hour = item.ordered_at.hour
        hourly_data[hour]["order_count"] += item.qty
        hourly_data[hour]["total_amount"] += item.qty * item.unit_price

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "hourly_breakdown": list(hourly_data.values()),
    }


@router.get("/sales/export-csv", summary="売上データCSVエクスポート")
def export_sales_csv(
    date_from: Optional[date] = Query(None, description="開始日"),
    date_to: Optional[date] = Query(None, description="終了日"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)  # マネージャーのみ
):
    """
    売上データをCSV形式でエクスポートする
    経理処理・データ分析に使用
    マネージャー権限が必要
    """
    if not date_from:
        date_from = date.today().replace(day=1)  # 当月1日
    if not date_to:
        date_to = date.today()

    from_dt = datetime.combine(date_from, datetime.min.time())
    to_dt = datetime.combine(date_to + timedelta(days=1), datetime.min.time())

    # 精算済みセッションと注文アイテムを取得
    sessions = db.query(BarSession).filter(
        BarSession.closed_at >= from_dt,
        BarSession.closed_at < to_dt,
        BarSession.status == "closed"
    ).order_by(BarSession.closed_at).all()

    # CSVデータを生成（StringIOを使用）
    output = io.StringIO()
    writer = csv.writer(output)

    # ヘッダー行
    writer.writerow([
        "精算日時", "セッションID", "テーブル", "客数", "合計金額",
        "商品名", "カテゴリ", "数量", "単価", "小計"
    ])

    for session in sessions:
        order_items = db.query(OrderItem).filter(
            OrderItem.session_id == session.id
        ).all()

        for item in order_items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            table_name = ""
            if session.table_id:
                from app.models.table import Table
                table = db.query(Table).filter(Table.id == session.table_id).first()
                table_name = table.name if table else ""

            writer.writerow([
                session.closed_at.strftime("%Y-%m-%d %H:%M") if session.closed_at else "",
                session.id,
                table_name,
                session.guest_count,
                session.total,
                product.name if product else "不明",
                product.category if product else "",
                item.qty,
                item.unit_price,
                item.qty * item.unit_price,
            ])

    output.seek(0)

    # UTF-8 BOM付きCSV（Excelで文字化けしないよう）
    csv_content = "﻿" + output.getvalue()

    filename = f"sales_{date_from.strftime('%Y%m%d')}_{date_to.strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        }
    )


@router.get("/cost/fl-cost", summary="FLコスト分析")
def get_fl_cost(
    year: int = Query(default=None, description="年"),
    month: int = Query(default=None, description="月"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)  # マネージャーのみ
):
    """
    FL（Food + Labor）コスト分析を返す
    - Fコスト: 食材費（原価）
    - Lコスト: 人件費（給与合計）
    - FLコスト比率: (F + L) / 売上 × 100
    飲食店の経営指標として60%以下が目標
    マネージャー権限が必要
    """
    today = date.today()
    year = year or today.year
    month = month or today.month

    last_day = calendar.monthrange(year, month)[1]
    month_start = datetime(year, month, 1)
    month_end = datetime(year, month, last_day, 23, 59, 59)

    # 月次売上を計算
    sessions = db.query(BarSession).filter(
        BarSession.closed_at >= month_start,
        BarSession.closed_at <= month_end,
        BarSession.status == "closed"
    ).all()

    total_sales = sum(s.total for s in sessions)
    session_ids = [s.id for s in sessions]

    # Fコスト（食材費・原価）を計算
    f_cost = 0
    if session_ids:
        f_cost_result = db.query(
            func.sum(OrderItem.qty * Product.cost)
        ).join(
            Product, Product.id == OrderItem.product_id
        ).filter(
            OrderItem.session_id.in_(session_ids)
        ).scalar() or 0
        f_cost = int(f_cost_result)

    # Lコスト（人件費）を計算
    l_cost_result = db.query(
        func.sum(Attendance.wage)
    ).filter(
        Attendance.date >= date(year, month, 1),
        Attendance.date <= date(year, month, last_day),
        Attendance.wage != None  # noqa: E711
    ).scalar() or 0
    l_cost = int(l_cost_result)

    fl_cost = f_cost + l_cost
    fl_rate = (fl_cost / total_sales * 100) if total_sales > 0 else 0
    f_rate = (f_cost / total_sales * 100) if total_sales > 0 else 0
    l_rate = (l_cost / total_sales * 100) if total_sales > 0 else 0

    return {
        "year": year,
        "month": month,
        "total_sales": total_sales,
        "total_cost": f_cost,
        "total_labor": l_cost,
        "food_cost_rate": round(f_rate, 1),
        "labor_cost_rate": round(l_rate, 1),
        "fl_cost_rate": round(fl_rate, 1),
        "is_healthy": fl_rate <= 60.0,
    }


@router.get("/cost/product-margins", summary="商品別粗利分析")
def get_product_margins(
    date_from: Optional[date] = Query(None, description="開始日"),
    date_to: Optional[date] = Query(None, description="終了日"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)  # マネージャーのみ
):
    """
    商品別の粗利・粗利率を分析する
    メニュー価格設定・コスト管理に使用
    マネージャー権限が必要
    """
    if not date_from:
        date_from = date.today() - timedelta(days=30)
    if not date_to:
        date_to = date.today()

    from_dt = datetime.combine(date_from, datetime.min.time())
    to_dt = datetime.combine(date_to + timedelta(days=1), datetime.min.time())

    session_ids = [
        s.id for s in db.query(BarSession.id).filter(
            BarSession.closed_at >= from_dt,
            BarSession.closed_at < to_dt,
            BarSession.status == "closed"
        ).all()
    ]

    # 全商品（販売中）の粗利を計算
    all_products = db.query(Product).filter(Product.is_active == True).all()  # noqa: E712

    products_data = []
    for product in all_products:
        # 販売実績を取得
        sales_data = db.query(
            func.sum(OrderItem.qty).label("total_qty"),
            func.sum(OrderItem.qty * OrderItem.unit_price).label("total_sales"),
        ).filter(
            OrderItem.product_id == product.id,
            OrderItem.session_id.in_(session_ids) if session_ids else False
        ).first()

        total_qty = sales_data.total_qty or 0
        total_sales = sales_data.total_sales or 0
        total_cost = total_qty * product.cost
        gross_profit = total_sales - total_cost
        # 原価率 = 原価 / 販売価格
        cost_rate = (product.cost / product.price * 100) if product.price > 0 else 0
        # 粗利率 = 粗利 / 売上
        margin_rate = (gross_profit / total_sales * 100) if total_sales > 0 else 0

        products_data.append({
            "id": product.id,
            "name": product.name,
            "category": product.category,
            "price": product.price,
            "cost": product.cost,
            "margin": gross_profit,
            "margin_rate": round(margin_rate, 1),
        })

    # 粗利額の高い順にソート
    products_data.sort(key=lambda x: x["gross_profit"], reverse=True)

    return {
        "date_from": date_from.isoformat(),
        "date_to": date_to.isoformat(),
        "products": products_data,
    }
