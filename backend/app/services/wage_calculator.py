# 給与計算サービス
# 深夜割増・残業割増を含む給与計算ロジック

from datetime import datetime, date, timedelta, time
from typing import TYPE_CHECKING
import calendar

if TYPE_CHECKING:
    from app.models.staff import Staff
    from app.models.attendance import Attendance

# 深夜時間帯の定義（22:00〜翌5:00）
NIGHT_START_HOUR = 22
NIGHT_END_HOUR = 5   # 翌朝5時

# 深夜割増率（1.25倍 = 基本25%増）
NIGHT_PREMIUM_RATE = 0.25

# 残業の基準時間（日8時間 = 480分）
OVERTIME_THRESHOLD_MINUTES = 480

# 残業割増率（1.25倍 = 基本25%増）
OVERTIME_PREMIUM_RATE = 0.25


def calculate_night_minutes(clock_in: datetime, clock_out: datetime) -> int:
    """
    深夜勤務時間（分）を計算する
    深夜時間帯: 22:00〜翌5:00

    バーの営業時間は夜間が多いため、複数の深夜時間帯をまたぐケースに対応

    Args:
        clock_in: 出勤時刻
        clock_out: 退勤時刻

    Returns:
        深夜勤務時間（分）
    """
    if not clock_in or not clock_out:
        return 0

    if clock_out <= clock_in:
        return 0

    night_minutes = 0
    current = clock_in

    # 1分単位で深夜時間帯かどうかチェック（精度よりも処理速度優先のため15分単位でも良い）
    # ここでは効率的な範囲計算を使用
    work_date = clock_in.date()

    # 当日22:00〜深夜0:00の深夜時間帯
    night_start_today = datetime.combine(work_date, time(NIGHT_START_HOUR, 0))
    midnight = datetime.combine(work_date + timedelta(days=1), time(0, 0))

    # 翌日0:00〜翌日5:00の深夜時間帯
    night_end_tomorrow = datetime.combine(work_date + timedelta(days=1), time(NIGHT_END_HOUR, 0))

    # 深夜時間帯1: 当日22:00〜深夜0:00
    overlap_start = max(clock_in, night_start_today)
    overlap_end = min(clock_out, midnight)
    if overlap_end > overlap_start:
        night_minutes += int((overlap_end - overlap_start).total_seconds() / 60)

    # 深夜時間帯2: 0:00〜翌5:00
    overlap_start2 = max(clock_in, midnight)
    overlap_end2 = min(clock_out, night_end_tomorrow)
    if overlap_end2 > overlap_start2:
        night_minutes += int((overlap_end2 - overlap_start2).total_seconds() / 60)

    # 翌々日以降に及ぶ場合（連続勤務）
    # 通常のバー営業では発生しないが念のため対応
    for extra_day in range(1, 3):
        extra_date = work_date + timedelta(days=extra_day)
        night_start_extra = datetime.combine(extra_date, time(NIGHT_START_HOUR, 0))
        midnight_extra = datetime.combine(extra_date + timedelta(days=1), time(0, 0))
        night_end_extra = datetime.combine(extra_date + timedelta(days=1), time(NIGHT_END_HOUR, 0))

        # 当日22:00〜深夜0:00
        os = max(clock_in, night_start_extra)
        oe = min(clock_out, midnight_extra)
        if oe > os:
            night_minutes += int((oe - os).total_seconds() / 60)

        # 0:00〜翌5:00
        os2 = max(clock_in, midnight_extra)
        oe2 = min(clock_out, night_end_extra)
        if oe2 > os2:
            night_minutes += int((oe2 - os2).total_seconds() / 60)

    return night_minutes


def calculate_overtime_minutes(work_minutes: int) -> int:
    """
    残業時間（分）を計算する
    8時間（480分）を超えた時間が残業

    Args:
        work_minutes: 総勤務時間（分）

    Returns:
        残業時間（分）。8時間以内の場合は0
    """
    if work_minutes <= OVERTIME_THRESHOLD_MINUTES:
        return 0
    return work_minutes - OVERTIME_THRESHOLD_MINUTES


def calculate_daily_wage(staff, attendance) -> int:
    """
    日次給与を計算する
    基本給 + 深夜割増 + 残業割増

    計算式:
    - 通常時給: hourly_wage
    - 深夜割増: hourly_wage × 0.25（深夜時間帯の25%増し分）
    - 残業割増: hourly_wage × 0.25（残業時間の25%増し分）

    Args:
        staff: Staffモデルインスタンス
        attendance: Attendanceモデルインスタンス

    Returns:
        日次支給額（円）
    """
    if not attendance.work_minutes:
        return 0

    work_minutes = attendance.work_minutes
    night_minutes = attendance.night_minutes or 0

    # 残業時間を計算
    overtime_minutes = calculate_overtime_minutes(work_minutes)

    # 基本給（全勤務時間分、通常時給で計算）
    # 時給を分給に変換して計算
    base_pay = int(staff.hourly_wage * work_minutes / 60)

    # 深夜割増（深夜時間の25%増し分のみ追加）
    # 深夜時間分の基本給は既にbase_payに含まれているため、25%増し分のみ加算
    night_premium = int(staff.hourly_wage * NIGHT_PREMIUM_RATE * night_minutes / 60)

    # 残業割増（残業時間の25%増し分のみ追加）
    # 残業時間分の基本給は既にbase_payに含まれているため、25%増し分のみ加算
    overtime_premium = int(staff.hourly_wage * OVERTIME_PREMIUM_RATE * overtime_minutes / 60)

    total_wage = base_pay + night_premium + overtime_premium
    return total_wage


def calculate_monthly_wages(db, staff_id: int, year: int, month: int):
    """
    月次給与を計算する
    全日分の勤怠記録を集計し、日次明細付きで返す

    Args:
        db: データベースセッション
        staff_id: スタッフID
        year: 年
        month: 月

    Returns:
        MonthlyWageResponseスキーマに対応する辞書
    """
    from app.models.staff import Staff
    from app.models.attendance import Attendance
    from app.schemas.attendance import MonthlyWageResponse

    # スタッフ情報を取得
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise ValueError(f"スタッフID {staff_id} が見つかりません")

    # 指定月の勤怠記録を全て取得
    last_day = calendar.monthrange(year, month)[1]
    attendances = db.query(Attendance).filter(
        Attendance.staff_id == staff_id,
        Attendance.date >= date(year, month, 1),
        Attendance.date <= date(year, month, last_day),
    ).order_by(Attendance.date).all()

    # ドリンクバック（日別）を先に計算
    from app.models.staff_drink import StaffDrink
    from app.models.session import Session as BarSession
    from sqlalchemy import extract

    drink_back_rows = (
        db.query(StaffDrink, BarSession.started_at)
        .join(BarSession, StaffDrink.session_id == BarSession.id)
        .filter(
            StaffDrink.staff_id == staff_id,
            extract("year", BarSession.started_at) == year,
            extract("month", BarSession.started_at) == month,
        )
        .all()
    )
    drink_back_by_date: dict = {}
    for drink, started_at in drink_back_rows:
        d = started_at.date().isoformat()
        drink_back_by_date[d] = drink_back_by_date.get(d, 0) + drink.back_amount
    drink_back_total = sum(drink_back_by_date.values())

    # 呼びバック（日別）を計算 - この月に精算された卓で yobiback_staff_id = このスタッフのセッション
    yobiback_sessions = db.query(BarSession).filter(
        BarSession.yobiback_staff_id == staff_id,
        BarSession.status == "closed",
        extract("year", BarSession.closed_at) == year,
        extract("month", BarSession.closed_at) == month,
    ).all()
    yobiback_by_date: dict = {}
    for s in yobiback_sessions:
        d = s.closed_at.date().isoformat()
        amount = int(s.total * 0.10)
        yobiback_by_date[d] = yobiback_by_date.get(d, 0) + amount
    yobiback_total = sum(yobiback_by_date.values())

    # 月次集計
    total_work_minutes = 0
    total_night_minutes = 0
    total_overtime_minutes = 0
    total_base_pay = 0
    total_night_premium = 0
    total_overtime_premium = 0
    work_days = 0
    daily_details = []

    # シフトをまとめて取得（遅刻・早退判定用）
    from app.models.shift import Shift
    from datetime import time as dtime
    shifts = db.query(Shift).filter(
        Shift.staff_id == staff_id,
        Shift.date >= date(year, month, 1),
        Shift.date <= date(year, month, last_day),
    ).all()
    shift_map = {s.date: s for s in shifts}

    for att in attendances:
        if not att.work_minutes:
            continue

        work_days += 1
        work_minutes = att.work_minutes
        night_minutes = att.night_minutes or 0
        overtime_minutes = calculate_overtime_minutes(work_minutes)

        # 日次給与計算
        base_pay = int(staff.hourly_wage * work_minutes / 60)
        night_premium = int(staff.hourly_wage * NIGHT_PREMIUM_RATE * night_minutes / 60)
        overtime_premium = int(staff.hourly_wage * OVERTIME_PREMIUM_RATE * overtime_minutes / 60)
        daily_total = base_pay + night_premium + overtime_premium

        total_work_minutes += work_minutes
        total_night_minutes += night_minutes
        total_overtime_minutes += overtime_minutes
        total_base_pay += base_pay
        total_night_premium += night_premium
        total_overtime_premium += overtime_premium

        # 遅刻・早退判定
        shift = shift_map.get(att.date)
        is_late = False
        is_early_leave = False
        if shift and att.clock_in:
            try:
                sh, sm = map(int, shift.start_time.split(":"))
                shift_start = datetime.combine(att.date, dtime(sh, sm))
                is_late = (att.clock_in - shift_start).total_seconds() > 5 * 60
            except Exception:
                pass
        if shift and att.clock_out:
            try:
                eh, em = map(int, shift.end_time.split(":"))
                shift_end = datetime.combine(att.date, dtime(eh, em))
                # バーは深夜営業なので終業が翌日の場合を考慮
                if eh < 12:
                    shift_end = datetime.combine(att.date + timedelta(days=1), dtime(eh, em))
                is_early_leave = (shift_end - att.clock_out).total_seconds() > 5 * 60
            except Exception:
                pass

        day_drink_back = drink_back_by_date.get(att.date.isoformat(), 0)
        day_yobiback = yobiback_by_date.get(att.date.isoformat(), 0)
        daily_details.append({
            "date": att.date.isoformat(),
            "attendance_id": att.id,
            "clock_in": att.clock_in.strftime("%H:%M") if att.clock_in else None,
            "clock_out": att.clock_out.strftime("%H:%M") if att.clock_out else None,
            "break_minutes": att.break_minutes or 0,
            "work_minutes": work_minutes,
            "night_minutes": night_minutes,
            "overtime_minutes": overtime_minutes,
            "base_pay": base_pay,
            "night_premium": night_premium,
            "overtime_premium": overtime_premium,
            "drink_back": day_drink_back,
            "yobiback": day_yobiback,
            "daily_total": daily_total + day_drink_back + day_yobiback,
            "is_late": is_late,
            "is_early_leave": is_early_leave,
            "absence_type": getattr(att, "absence_type", None),
        })

    total_wage = total_base_pay + total_night_premium + total_overtime_premium + drink_back_total + yobiback_total

    return MonthlyWageResponse(
        staff_id=staff_id,
        staff_name=staff.name,
        year=year,
        month=month,
        work_days=work_days,
        total_work_minutes=total_work_minutes,
        total_night_minutes=total_night_minutes,
        total_overtime_minutes=total_overtime_minutes,
        base_pay=total_base_pay,
        night_premium=total_night_premium,
        overtime_premium=total_overtime_premium,
        drink_back_total=drink_back_total,
        yobiback_total=yobiback_total,
        total_wage=total_wage,
        daily_details=daily_details,
    )
