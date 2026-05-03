# シードデータ投入スクリプト
# バー管理システムのデモデータを作成する
# 使用方法: python seed.py (backendディレクトリから実行)

import sys
import os
from datetime import datetime, date, timedelta, time
import random

# プロジェクトルートをPythonパスに追加
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal, create_tables
from app.core.security import get_password_hash
from app.models.staff import Staff
from app.models.product import Product
from app.models.table import Table
from app.models.session import Session
from app.models.order_item import OrderItem
from app.models.stock_log import StockLog
from app.models.attendance import Attendance


def seed_staff(db):
    """スタッフのシードデータを作成"""
    print("スタッフデータを作成中...")

    staff_data = [
        {
            "name": "admin",
            "role": "manager",
            "hourly_wage": 1500,
            "password": "admin",
        },
        {
            "name": "バーテンダー鈴木",
            "role": "staff",
            "hourly_wage": 1200,
            "password": "pass123",
        },
        {
            "name": "スタッフ佐藤",
            "role": "staff",
            "hourly_wage": 1050,
            "password": "pass123",
        },
    ]

    created_staff = []
    for data in staff_data:
        # 既存チェック
        existing = db.query(Staff).filter(Staff.name == data["name"]).first()
        if existing:
            print(f"  スキップ（既存）: {data['name']}")
            created_staff.append(existing)
            continue

        staff = Staff(
            name=data["name"],
            role=data["role"],
            hourly_wage=data["hourly_wage"],
            password_hash=get_password_hash(data["password"]),
        )
        db.add(staff)
        db.flush()
        created_staff.append(staff)
        print(f"  作成: {data['name']} ({data['role']}, 時給¥{data['hourly_wage']})")

    db.commit()
    return created_staff


def seed_products(db):
    """商品のシードデータを作成"""
    print("商品データを作成中...")

    products_data = [
        # ドリンク
        {"name": "ビール", "price": 600, "cost": 150, "category": "ドリンク", "stock_qty": 48, "alert_qty": 12, "unit": "本"},
        {"name": "ハイボール", "price": 500, "cost": 100, "category": "ドリンク", "stock_qty": 30, "alert_qty": 10, "unit": "杯"},
        {"name": "ウィスキーロック", "price": 800, "cost": 200, "category": "ドリンク", "stock_qty": 20, "alert_qty": 5, "unit": "杯"},
        {"name": "カシスソーダ", "price": 600, "cost": 120, "category": "ドリンク", "stock_qty": 25, "alert_qty": 8, "unit": "杯"},
        {"name": "ジントニック", "price": 700, "cost": 150, "category": "ドリンク", "stock_qty": 20, "alert_qty": 5, "unit": "杯"},
        # フード
        {"name": "枝豆", "price": 300, "cost": 80, "category": "フード", "stock_qty": 15, "alert_qty": 5, "unit": "皿"},
        {"name": "唐揚げ", "price": 500, "cost": 150, "category": "フード", "stock_qty": 20, "alert_qty": 5, "unit": "皿"},
        {"name": "ポテトフライ", "price": 400, "cost": 100, "category": "フード", "stock_qty": 25, "alert_qty": 5, "unit": "皿"},
        {"name": "チーズ盛り合わせ", "price": 600, "cost": 200, "category": "フード", "stock_qty": 10, "alert_qty": 3, "unit": "皿"},
        {"name": "刺身盛り合わせ", "price": 1200, "cost": 500, "category": "フード", "stock_qty": 8, "alert_qty": 3, "unit": "皿"},
    ]

    created_products = []
    for data in products_data:
        existing = db.query(Product).filter(Product.name == data["name"]).first()
        if existing:
            print(f"  スキップ（既存）: {data['name']}")
            created_products.append(existing)
            continue

        product = Product(**data)
        db.add(product)
        db.flush()
        created_products.append(product)
        print(f"  作成: {data['name']} (¥{data['price']}, 原価¥{data['cost']})")

    db.commit()
    return created_products


def seed_tables(db):
    """テーブルのシードデータを作成"""
    print("テーブルデータを作成中...")

    tables_data = [
        {"name": "A1", "capacity": 4},
        {"name": "A2", "capacity": 4},
        {"name": "A3", "capacity": 6},
        {"name": "A4", "capacity": 2},
        {"name": "B1", "capacity": 4},
        {"name": "B2", "capacity": 4},
        {"name": "B3", "capacity": 6},
        {"name": "B4", "capacity": 2},
    ]

    created_tables = []
    for data in tables_data:
        existing = db.query(Table).filter(Table.name == data["name"]).first()
        if existing:
            print(f"  スキップ（既存）: {data['name']}")
            created_tables.append(existing)
            continue

        table = Table(**data)
        db.add(table)
        db.flush()
        created_tables.append(table)
        print(f"  作成: {data['name']} (定員{data['capacity']}名)")

    db.commit()
    return created_tables


def seed_past_sessions(db, staff_list, products, tables):
    """過去のセッション・注文データを作成（リアルなバーデータ）"""
    print("過去セッションデータを作成中...")

    today = date.today()

    # 過去2週間のデータを作成（毎日数セッション）
    session_templates = [
        # セッション1: 2日前 テーブルA1 3人
        {
            "offset_days": 2,
            "open_hour": 19, "open_minute": 30,
            "duration_minutes": 120,
            "table_idx": 0,  # A1
            "staff_idx": 1,  # 鈴木
            "guest_count": 3,
            "orders": [
                (0, 3),   # ビール×3
                (1, 2),   # ハイボール×2
                (5, 2),   # 枝豆×2
                (6, 1),   # 唐揚げ×1
            ]
        },
        # セッション2: 2日前 テーブルB1 2人
        {
            "offset_days": 2,
            "open_hour": 20, "open_minute": 0,
            "duration_minutes": 90,
            "table_idx": 4,  # B1
            "staff_idx": 2,  # 佐藤
            "guest_count": 2,
            "orders": [
                (2, 2),   # ウィスキーロック×2
                (8, 1),   # チーズ盛り合わせ×1
                (9, 1),   # 刺身盛り合わせ×1
            ]
        },
        # セッション3: 3日前 テーブルA2 4人
        {
            "offset_days": 3,
            "open_hour": 18, "open_minute": 45,
            "duration_minutes": 150,
            "table_idx": 1,  # A2
            "staff_idx": 1,  # 鈴木
            "guest_count": 4,
            "orders": [
                (0, 4),   # ビール×4
                (3, 2),   # カシスソーダ×2
                (5, 3),   # 枝豆×3
                (7, 2),   # ポテトフライ×2
                (6, 2),   # 唐揚げ×2
                (9, 1),   # 刺身盛り合わせ×1
            ]
        },
        # セッション4: 5日前 テーブルA3 6人（大人数）
        {
            "offset_days": 5,
            "open_hour": 19, "open_minute": 0,
            "duration_minutes": 180,
            "table_idx": 2,  # A3
            "staff_idx": 0,  # 田中
            "guest_count": 6,
            "orders": [
                (0, 6),   # ビール×6
                (1, 4),   # ハイボール×4
                (4, 2),   # ジントニック×2
                (5, 4),   # 枝豆×4
                (6, 3),   # 唐揚げ×3
                (7, 2),   # ポテトフライ×2
                (8, 2),   # チーズ盛り合わせ×2
                (9, 2),   # 刺身盛り合わせ×2
            ]
        },
        # セッション5: 7日前 テーブルB2 2人（カップル）
        {
            "offset_days": 7,
            "open_hour": 20, "open_minute": 30,
            "duration_minutes": 100,
            "table_idx": 5,  # B2
            "staff_idx": 2,  # 佐藤
            "guest_count": 2,
            "orders": [
                (3, 2),   # カシスソーダ×2
                (4, 1),   # ジントニック×1
                (8, 1),   # チーズ盛り合わせ×1
                (9, 1),   # 刺身盛り合わせ×1
            ]
        },
    ]

    created_sessions = []
    for template in session_templates:
        session_date = today - timedelta(days=template["offset_days"])
        opened_at = datetime.combine(
            session_date,
            time(template["open_hour"], template["open_minute"])
        )
        closed_at = opened_at + timedelta(minutes=template["duration_minutes"])

        table = tables[template["table_idx"]]
        staff = staff_list[template["staff_idx"]]

        # セッションを作成
        session = Session(
            table_id=table.id,
            staff_id=staff.id,
            guest_count=template["guest_count"],
            started_at=opened_at,
            closed_at=closed_at,
            status="closed",
        )
        db.add(session)
        db.flush()

        # 注文アイテムを追加
        total = 0
        for product_idx, qty in template["orders"]:
            product = products[product_idx]
            unit_price = product.price
            subtotal = unit_price * qty
            total += subtotal

            # 注文時刻に少しランダム性を持たせる
            order_offset = random.randint(5, template["duration_minutes"] - 10)
            ordered_at = opened_at + timedelta(minutes=order_offset)

            order_item = OrderItem(
                session_id=session.id,
                product_id=product.id,
                qty=qty,
                unit_price=unit_price,
                ordered_at=ordered_at,
            )
            db.add(order_item)

        # セッションの合計を設定
        session.total = total
        print(f"  作成: セッション {session_date} テーブル{table.name} {template['guest_count']}名 ¥{total:,}")

        created_sessions.append(session)

    db.commit()
    return created_sessions


def seed_stock_logs(db, staff_list, products):
    """在庫ログのシードデータを作成"""
    print("在庫ログデータを作成中...")

    manager = staff_list[0]
    today = date.today()

    # 仕入れ記録
    purchase_logs = [
        (0, 48, 7),   # ビール 48本 7日前
        (1, 30, 7),   # ハイボール原料 30杯分 7日前
        (2, 20, 7),   # ウィスキー 20杯分 7日前
        (5, 15, 3),   # 枝豆 15皿分 3日前
        (6, 20, 3),   # 唐揚げ 20皿分 3日前
        (9, 8, 1),    # 刺身 8皿分 昨日
    ]

    for product_idx, qty, days_ago in purchase_logs:
        product = products[product_idx]
        log_date = datetime.combine(today - timedelta(days=days_ago), time(10, 0))

        log = StockLog(
            product_id=product.id,
            change_qty=qty,
            reason="purchase",
            staff_id=manager.id,
            created_at=log_date,
        )
        db.add(log)
        print(f"  仕入れ: {product.name} +{qty} ({days_ago}日前)")

    # 廃棄記録
    loss_logs = [
        (5, -2, 1),   # 枝豆 2皿廃棄 昨日
        (9, -1, 2),   # 刺身 1皿廃棄 2日前
    ]

    for product_idx, qty, days_ago in loss_logs:
        product = products[product_idx]
        log_date = datetime.combine(today - timedelta(days=days_ago), time(23, 30))

        log = StockLog(
            product_id=product.id,
            change_qty=qty,
            reason="loss",
            staff_id=manager.id,
            created_at=log_date,
        )
        db.add(log)
        print(f"  廃棄: {product.name} {qty} ({days_ago}日前)")

    db.commit()


def seed_attendance(db, staff_list):
    """過去2週間の勤怠データを作成"""
    print("勤怠データを作成中...")

    from app.services.wage_calculator import calculate_night_minutes, calculate_daily_wage

    today = date.today()

    # スタッフごとのシフト（バーの夜間営業を想定）
    # (open_hour, open_minute, duration_minutes)
    shift_templates = {
        "マネージャー田中": [
            # 月〜土: 17:00〜23:30（6.5時間）、日曜休み
            (17, 0, 390),
        ],
        "バーテンダー鈴木": [
            # 火〜日: 18:00〜0:00（6時間）、月曜休み
            (18, 0, 360),
        ],
        "スタッフ佐藤": [
            # 木〜月: 19:00〜23:00（4時間）
            (19, 0, 240),
        ],
    }

    # 休日の設定（曜日: 0=月, 6=日）
    days_off = {
        "マネージャー田中": [6],       # 日曜休み
        "バーテンダー鈴木": [0],        # 月曜休み
        "スタッフ佐藤": [1, 2],          # 火・水休み
    }

    for staff in staff_list:
        shift = shift_templates.get(staff.name)
        off_days = days_off.get(staff.name, [])

        if not shift:
            continue

        open_h, open_m, duration = shift[0]

        # 過去14日間のデータを作成
        for i in range(1, 15):
            work_date = today - timedelta(days=i)
            weekday = work_date.weekday()

            # 休日はスキップ
            if weekday in off_days:
                continue

            # 既存チェック
            existing = db.query(Attendance).filter(
                Attendance.staff_id == staff.id,
                Attendance.date == work_date
            ).first()
            if existing:
                continue

            # 出退勤時刻（少しランダム性を持たせる）
            total_min = open_h * 60 + open_m + random.randint(-5, 10)
            clock_in = datetime.combine(work_date, time(total_min // 60 % 24, total_min % 60))
            clock_out = clock_in + timedelta(minutes=duration + random.randint(-15, 30))

            work_minutes = int((clock_out - clock_in).total_seconds() / 60)
            night_minutes = calculate_night_minutes(clock_in, clock_out)

            # 仮のAttendanceオブジェクトを作成して給与計算
            temp_att = type("TempAttendance", (), {
                "work_minutes": work_minutes,
                "night_minutes": night_minutes,
            })()
            wage = calculate_daily_wage(staff, temp_att)

            attendance = Attendance(
                staff_id=staff.id,
                clock_in=clock_in,
                clock_out=clock_out,
                date=work_date,
                work_minutes=work_minutes,
                night_minutes=night_minutes,
                wage=wage,
            )
            db.add(attendance)

        print(f"  {staff.name}: 過去14日間の勤怠データ作成完了")

    db.commit()


def main():
    """メインのシード実行関数"""
    print("=" * 60)
    print("バー管理システム シードデータ投入")
    print("=" * 60)

    # テーブル作成（存在しない場合）
    print("データベーステーブルを確認・作成中...")
    create_tables()
    print("テーブル準備完了")
    print()

    db = SessionLocal()
    try:
        # シードデータの投入
        staff_list = seed_staff(db)
        print()

        products = seed_products(db)
        print()

        tables = seed_tables(db)
        print()

        seed_past_sessions(db, staff_list, products, tables)
        print()

        seed_stock_logs(db, staff_list, products)
        print()

        seed_attendance(db, staff_list)
        print()

        print("=" * 60)
        print("シードデータの投入が完了しました！")
        print()
        print("ログイン情報:")
        print("  マネージャー田中 / admin123 (manager権限)")
        print("  バーテンダー鈴木 / pass123  (staff権限)")
        print("  スタッフ佐藤    / pass123  (staff権限)")
        print()
        print("APIサーバー起動:")
        print("  uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        print("  または: python main.py")
        print()
        print("APIドキュメント:")
        print("  http://localhost:8000/docs")
        print("=" * 60)

    except Exception as e:
        print(f"エラーが発生しました: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
