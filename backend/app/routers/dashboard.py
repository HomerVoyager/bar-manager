# ダッシュボードルーター
# 経営概況・リアルタイム状況を一括取得

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, datetime, timedelta
import calendar

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.staff import Staff
from app.models.table import Table
from app.models.session import Session as BarSession
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.attendance import Attendance

router = APIRouter()


@router.get("/", summary="ダッシュボードデータ一括取得")
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    ダッシュボード表示に必要な全データを一括で返す
    - 本日の売上・客数
    - アクティブセッション数
    - 在庫アラート
    - 出勤中スタッフ
    - テーブル状況
    - 今月と先月の売上比較（日次内訳）
    """
    today = date.today()
    now = datetime.now()

    # ===== 本日の売上 =====
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today + timedelta(days=1), datetime.min.time())

    today_sessions = db.query(BarSession).filter(
        BarSession.closed_at >= today_start,
        BarSession.closed_at < today_end,
        BarSession.status == "closed"
    ).all()

    today_sales = sum(s.total for s in today_sessions)
    today_guests = sum(s.guest_count for s in today_sessions)

    # ===== アクティブセッション数 =====
    active_session_count = db.query(BarSession).filter(
        BarSession.status == "open"
    ).count()

    # ===== 在庫アラート =====
    low_stock_products = db.query(Product).filter(
        Product.is_active == True,  # noqa: E712
        Product.stock_qty <= Product.alert_qty
    ).order_by(Product.stock_qty).all()

    low_stock_alerts = [
        {
            "id": p.id,
            "name": p.name,
            "stock_qty": p.stock_qty,
            "alert_qty": p.alert_qty,
            "category": p.category,
        }
        for p in low_stock_products
    ]

    # ===== 出勤中スタッフ（本日出勤・未退勤）=====
    on_duty_attendances = db.query(Attendance).filter(
        Attendance.date == today,
        Attendance.clock_in != None,  # noqa: E711
        Attendance.clock_out == None   # 未退勤
    ).all()

    on_duty_staff = []
    for att in on_duty_attendances:
        staff = db.query(Staff).filter(Staff.id == att.staff_id).first()
        if staff:
            # 勤務時間（分）を計算
            work_minutes_so_far = int((now - att.clock_in).total_seconds() / 60) if att.clock_in else 0
            on_duty_staff.append({
                "id": staff.id,
                "name": staff.name,
                "role": staff.role,
                "clock_in": att.clock_in.isoformat() if att.clock_in else None,
                "work_minutes_so_far": work_minutes_so_far,
            })

    # ===== テーブル状況 =====
    all_tables = db.query(Table).order_by(Table.name).all()
    table_status = []
    for table in all_tables:
        # 現在のセッションを取得
        active_session = db.query(BarSession).filter(
            BarSession.table_id == table.id,
            BarSession.status == "open"
        ).first()

        table_data = {
            "id": table.id,
            "name": table.name,
            "capacity": table.capacity,
            "status": table.status,
        }

        if active_session:
            table_data["session"] = {
                "id": active_session.id,
                "guest_count": active_session.guest_count,
                "started_at": active_session.started_at.isoformat(),
                # 現在の仮合計（精算前）
                "current_total": db.query(
                    func.coalesce(func.sum(OrderItem.qty * OrderItem.unit_price), 0)
                ).filter(
                    OrderItem.session_id == active_session.id
                ).scalar(),
            }
        else:
            table_data["session"] = None

        table_status.append(table_data)

    # ===== 今月と先月の売上比較 =====
    this_year = today.year
    this_month = today.month

    # 先月の計算
    if this_month == 1:
        last_month = 12
        last_month_year = this_year - 1
    else:
        last_month = this_month - 1
        last_month_year = this_year

    # 今月の日次データ
    this_month_days = calendar.monthrange(this_year, this_month)[1]
    this_month_data = {}
    for d in range(1, this_month_days + 1):
        this_month_data[d] = 0

    this_month_sessions = db.query(BarSession).filter(
        BarSession.closed_at >= datetime(this_year, this_month, 1),
        BarSession.closed_at < datetime(this_year, this_month, this_month_days, 23, 59, 59),
        BarSession.status == "closed"
    ).all()

    for s in this_month_sessions:
        if s.closed_at:
            this_month_data[s.closed_at.day] += s.total

    # 先月の日次データ
    last_month_days = calendar.monthrange(last_month_year, last_month)[1]
    last_month_data = {}
    for d in range(1, last_month_days + 1):
        last_month_data[d] = 0

    last_month_sessions = db.query(BarSession).filter(
        BarSession.closed_at >= datetime(last_month_year, last_month, 1),
        BarSession.closed_at <= datetime(last_month_year, last_month, last_month_days, 23, 59, 59),
        BarSession.status == "closed"
    ).all()

    for s in last_month_sessions:
        if s.closed_at:
            last_month_data[s.closed_at.day] += s.total

    # フロントエンドが期待する { date, this_month, last_month }[] 形式に変換
    max_days = max(this_month_days, last_month_days)
    monthly_comparison = []
    for d in range(1, max_days + 1):
        monthly_comparison.append({
            "date": str(d),
            "this_month": this_month_data.get(d, 0),
            "last_month": last_month_data.get(d, 0),
        })

    return {
        "today_sales": today_sales,
        "today_guests": today_guests,
        "today_session_count": len(today_sessions),
        "active_sessions": active_session_count,
        "low_stock_alerts": low_stock_alerts,
        "on_duty_staff": on_duty_staff,
        "table_status": table_status,
        "monthly_comparison": monthly_comparison,
        "generated_at": now.isoformat(),
    }
