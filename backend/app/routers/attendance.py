# 勤怠ルーター
# 出退勤管理・給与計算・給与明細PDF生成

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload, contains_eager
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_manager
from app.models.staff import Staff
from app.models.attendance import Attendance
from app.schemas.attendance import (
    ClockInRequest, ClockOutRequest, AttendanceResponse,
    MonthlyWageResponse, PayslipResponse
)
from app.services.wage_calculator import (
    calculate_night_minutes,
    calculate_daily_wage,
    calculate_monthly_wages,
)
from app.services.pdf_generator import generate_payslip_pdf

router = APIRouter()


@router.post("/clock-in", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED, summary="出勤打刻")
def clock_in(
    request: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    出勤打刻を記録する
    既に本日出勤記録がある場合はエラー（二重打刻防止）
    """
    today = date.today()
    clock_in_time = request.clock_in or datetime.now()

    # 二重打刻チェック
    existing = db.query(Attendance).filter(
        Attendance.staff_id == request.staff_id,
        Attendance.date == today
    ).first()

    if existing and existing.clock_in:
        # 既に打刻済みの場合は既存レコードを返す（冪等）
        return db.query(Attendance).options(joinedload(Attendance.staff)).filter(
            Attendance.id == existing.id
        ).first()

    # 新規出勤記録を作成
    attendance = Attendance(
        staff_id=request.staff_id,
        clock_in=clock_in_time,
        date=today,
    )
    db.add(attendance)
    db.commit()

    return db.query(Attendance).options(joinedload(Attendance.staff)).filter(
        Attendance.id == attendance.id
    ).first()


@router.post("/clock-out", response_model=AttendanceResponse, summary="退勤打刻")
def clock_out(
    request: ClockOutRequest,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    退勤打刻を記録する
    勤務時間・深夜時間・日給を自動計算して保存
    """
    today = date.today()
    clock_out_time = request.clock_out or datetime.now()

    # 本日の出勤記録を取得
    attendance = db.query(Attendance).filter(
        Attendance.staff_id == request.staff_id,
        Attendance.date == today
    ).first()

    if not attendance or not attendance.clock_in:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="本日の出勤記録が見つかりません。先に出勤打刻を行ってください"
        )

    if attendance.clock_out:
        # 既に退勤済みの場合は既存レコードを返す（冪等）
        return db.query(Attendance).options(joinedload(Attendance.staff)).filter(
            Attendance.id == attendance.id
        ).first()

    # 勤務時間（分）を計算
    work_minutes = int((clock_out_time - attendance.clock_in).total_seconds() / 60)

    # 深夜勤務時間（22:00〜翌5:00）を計算
    night_minutes = calculate_night_minutes(attendance.clock_in, clock_out_time)

    # スタッフの時給を取得
    staff = db.query(Staff).filter(Staff.id == request.staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"スタッフID {request.staff_id} が見つかりません"
        )

    # 退勤情報を更新
    attendance.clock_out = clock_out_time
    attendance.work_minutes = work_minutes
    attendance.night_minutes = night_minutes

    # 日給を計算（深夜割増・残業割増含む）
    attendance.wage = calculate_daily_wage(staff, attendance)

    db.commit()

    return db.query(Attendance).options(joinedload(Attendance.staff)).filter(
        Attendance.id == attendance.id
    ).first()


@router.get("/", response_model=List[AttendanceResponse], summary="勤怠一覧取得")
def list_attendance(
    staff_id: Optional[int] = Query(None, description="スタッフIDでフィルター"),
    year: Optional[int] = Query(None, description="年でフィルター"),
    month: Optional[int] = Query(None, description="月でフィルター"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    勤怠記録一覧を返す
    スタッフ・年・月でフィルター可能
    """
    query = db.query(Attendance).options(joinedload(Attendance.staff))

    if staff_id:
        query = query.filter(Attendance.staff_id == staff_id)

    if year:
        query = query.filter(
            Attendance.date >= date(year, 1, 1),
            Attendance.date <= date(year, 12, 31)
        )

    if month and year:
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        query = query.filter(
            Attendance.date >= date(year, month, 1),
            Attendance.date <= date(year, month, last_day)
        )

    attendances = query.order_by(Attendance.date.desc(), Attendance.staff_id).all()
    return attendances


@router.get("/today", response_model=List[AttendanceResponse], summary="本日の勤怠一覧")
def get_today_attendance(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    本日の全スタッフの勤怠状況を返す
    ダッシュボードの「出勤中スタッフ」表示に使用
    """
    today = date.today()
    attendances = db.query(Attendance).options(
        joinedload(Attendance.staff)
    ).filter(
        Attendance.date == today
    ).order_by(Attendance.clock_in).all()

    return attendances


@router.get("/monthly-detail/{staff_id}", response_model=MonthlyWageResponse, summary="スタッフ別月次詳細取得")
def get_monthly_detail(
    staff_id: int,
    year: int = Query(..., description="年"),
    month: int = Query(..., description="月"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)
):
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="スタッフが見つかりません")
    return calculate_monthly_wages(db, staff_id, year, month)


@router.get("/monthly-summary", response_model=List[MonthlyWageResponse], summary="月次給与サマリー取得")
def get_monthly_summary(
    year: int = Query(..., description="年"),
    month: int = Query(..., description="月"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)
):
    all_staff = db.query(Staff).filter(Staff.is_active == True).all()  # noqa: E712
    return [calculate_monthly_wages(db, s.id, year, month) for s in all_staff]


@router.post("/monthly-close", response_model=List[MonthlyWageResponse], summary="月次給与締め")
def monthly_close(
    year: int = Query(..., description="年"),
    month: int = Query(..., description="月"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager)  # マネージャーのみ
):
    all_staff = db.query(Staff).filter(Staff.is_active == True).all()  # noqa: E712
    return [calculate_monthly_wages(db, s.id, year, month) for s in all_staff]


@router.get("/payslip/{staff_id}/{year}/{month}", response_model=PayslipResponse, summary="給与明細取得")
def get_payslip(
    staff_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定したスタッフの月次給与明細を返す
    本人またはマネージャーのみアクセス可能
    """
    # 本人またはマネージャーのみアクセス可能
    if current_user.id != staff_id and current_user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="他のスタッフの給与明細は参照できません"
        )

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"スタッフID {staff_id} が見つかりません"
        )

    wage_data = calculate_monthly_wages(db, staff_id, year, month)

    return PayslipResponse(
        staff_id=staff_id,
        staff_name=staff.name,
        year=year,
        month=month,
        hourly_wage=staff.hourly_wage,
        drink_back_rate=staff.drink_back_rate,
        work_days=wage_data.work_days,
        total_work_minutes=wage_data.total_work_minutes,
        total_night_minutes=wage_data.total_night_minutes,
        total_overtime_minutes=wage_data.total_overtime_minutes,
        base_pay=wage_data.base_pay,
        night_premium=wage_data.night_premium,
        overtime_premium=wage_data.overtime_premium,
        drink_back_total=wage_data.drink_back_total,
        total_wage=wage_data.total_wage,
    )


@router.post("/payslip/{staff_id}/{year}/{month}/pdf", summary="給与明細PDF生成")
def generate_payslip(
    staff_id: int,
    year: int,
    month: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定したスタッフの月次給与明細PDFを生成して返す
    ReportLabを使用してJapanese PDFを生成
    本人またはマネージャーのみアクセス可能
    """
    # 本人またはマネージャーのみアクセス可能
    if current_user.id != staff_id and current_user.role != "manager":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="他のスタッフの給与明細は参照できません"
        )

    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"スタッフID {staff_id} が見つかりません"
        )

    wage_data = calculate_monthly_wages(db, staff_id, year, month)

    # PDFバイト列を生成
    pdf_bytes = generate_payslip_pdf(staff, wage_data, year, month)

    # PDFファイルとして返す
    filename = f"payslip_{staff.name}_{year}{month:02d}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        }
    )
