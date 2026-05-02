# PDF給与明細生成サービス
# ReportLabを使用して日本語給与明細PDFを生成

import io
import os
import logging
from datetime import date
from typing import Optional

logger = logging.getLogger(__name__)

# IPAexゴシックフォントの検索パス（Termux/Linux環境）
FONT_SEARCH_PATHS = [
    "/usr/share/fonts/opentype/ipaexfont-gothic/ipaexg.ttf",
    "/usr/share/fonts/truetype/fonts-japanese-gothic.ttf",
    "/usr/share/fonts/ipaexg.ttf",
    "/data/data/com.termux/files/usr/share/fonts/ipaexg.ttf",
    # macOS（開発環境）
    "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
    "/Library/Fonts/ipaexg.ttf",
]

# 登録するフォント名
JAPANESE_FONT_NAME = "IPAexGothic"
FALLBACK_FONT = "Helvetica"

_font_registered = False


def _register_japanese_font() -> str:
    """
    日本語フォントをReportLabに登録する
    フォントが見つからない場合はHelventicaにフォールバック

    Returns:
        使用するフォント名
    """
    global _font_registered

    if _font_registered:
        return JAPANESE_FONT_NAME

    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        # フォントファイルを探索
        font_path = None
        for path in FONT_SEARCH_PATHS:
            if os.path.exists(path):
                font_path = path
                break

        if font_path:
            pdfmetrics.registerFont(TTFont(JAPANESE_FONT_NAME, font_path))
            _font_registered = True
            logger.info(f"日本語フォント登録成功: {font_path}")
            return JAPANESE_FONT_NAME
        else:
            logger.warning(
                "日本語フォント(IPAexGothic)が見つかりません。"
                "Helveticaにフォールバックします。"
                "日本語文字が正しく表示されない可能性があります。"
            )
            return FALLBACK_FONT

    except Exception as e:
        logger.error(f"フォント登録エラー: {e}")
        return FALLBACK_FONT


def generate_payslip_pdf(staff, wage_data, year: int, month: int) -> bytes:
    """
    給与明細PDFを生成してバイト列で返す

    レイアウト:
    - ヘッダー: バー名・給与明細タイトル
    - スタッフ情報: 氏名・対象期間
    - 勤怠サマリー: 出勤日数・総勤務時間・深夜時間・残業時間
    - 給与明細: 基本給・深夜割増・残業割増・支給合計
    - フッター: 発行日

    Args:
        staff: Staffモデルインスタンス
        wage_data: MonthlyWageResponseスキーマ
        year: 対象年
        month: 対象月

    Returns:
        PDF バイト列
    """
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

    # フォントを登録・取得
    font_name = _register_japanese_font()

    # PDFバッファ
    buffer = io.BytesIO()

    # A4縦向き
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
    )

    # スタイル定義
    styles = getSampleStyleSheet()

    # タイトルスタイル
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=18,
        alignment=TA_CENTER,
        spaceAfter=6,
    )

    # サブタイトルスタイル
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=12,
        alignment=TA_CENTER,
        spaceAfter=4,
    )

    # 通常テキストスタイル
    normal_style = ParagraphStyle(
        "Normal_JP",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10,
    )

    # 右寄せスタイル
    right_style = ParagraphStyle(
        "Right_JP",
        parent=styles["Normal"],
        fontName=font_name,
        fontSize=10,
        alignment=TA_RIGHT,
    )

    # コンテンツ要素リスト
    elements = []

    # ===== ヘッダー =====
    elements.append(Paragraph("バー管理システム", subtitle_style))
    elements.append(Paragraph("給　与　明　細　書", title_style))
    elements.append(Spacer(1, 8 * mm))

    # ===== スタッフ情報テーブル =====
    staff_info_data = [
        ["スタッフ名", staff.name],
        ["対象期間", f"{year}年{month}月度"],
        ["時給", f"¥{staff.hourly_wage:,}"],
        ["ロール", "マネージャー" if staff.role == "manager" else "スタッフ"],
    ]

    staff_info_table = Table(
        staff_info_data,
        colWidths=[40 * mm, 110 * mm],
    )
    staff_info_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (0, -1), colors.lightblue),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elements.append(staff_info_table)
    elements.append(Spacer(1, 6 * mm))

    # ===== 勤怠サマリー =====
    elements.append(Paragraph("【勤怠サマリー】", normal_style))
    elements.append(Spacer(1, 3 * mm))

    # 分を時間:分の表記に変換するヘルパー
    def minutes_to_hm(minutes: int) -> str:
        h = minutes // 60
        m = minutes % 60
        return f"{h}時間{m}分"

    attendance_data = [
        ["項目", "時間"],
        ["出勤日数", f"{wage_data.work_days}日"],
        ["総勤務時間", minutes_to_hm(wage_data.total_work_minutes)],
        ["深夜勤務時間（22:00〜翌5:00）", minutes_to_hm(wage_data.total_night_minutes)],
        ["残業時間（日8時間超）", minutes_to_hm(wage_data.total_overtime_minutes)],
    ]

    attendance_table = Table(
        attendance_data,
        colWidths=[100 * mm, 50 * mm],
    )
    attendance_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.darkblue),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
    ]))
    elements.append(attendance_table)
    elements.append(Spacer(1, 6 * mm))

    # ===== 給与明細 =====
    elements.append(Paragraph("【給与明細】", normal_style))
    elements.append(Spacer(1, 3 * mm))

    wage_detail_data = [
        ["項目", "計算式", "金額"],
        [
            "基本給",
            f"¥{staff.hourly_wage:,} × {wage_data.total_work_minutes / 60:.1f}時間",
            f"¥{wage_data.base_pay:,}"
        ],
        [
            "深夜割増手当",
            f"¥{staff.hourly_wage:,} × 25% × {wage_data.total_night_minutes / 60:.1f}時間",
            f"¥{wage_data.night_premium:,}"
        ],
        [
            "残業割増手当",
            f"¥{staff.hourly_wage:,} × 25% × {wage_data.total_overtime_minutes / 60:.1f}時間",
            f"¥{wage_data.overtime_premium:,}"
        ],
    ]

    wage_detail_table = Table(
        wage_detail_data,
        colWidths=[55 * mm, 75 * mm, 20 * mm],
    )
    wage_detail_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("BACKGROUND", (0, 0), (-1, 0), colors.darkblue),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (2, 0), (2, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
    ]))
    elements.append(wage_detail_table)
    elements.append(Spacer(1, 4 * mm))

    # ===== 支給合計 =====
    total_data = [
        ["当月支給合計", f"¥{wage_data.total_wage:,}"],
    ]
    total_table = Table(
        total_data,
        colWidths=[130 * mm, 20 * mm],
    )
    total_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("FONTSIZE", (0, 0), (-1, -1), 14),
        ("FONTNAME", (0, 0), (-1, -1), font_name),
        ("BACKGROUND", (0, 0), (-1, -1), colors.orange),
        ("GRID", (0, 0), (-1, -1), 1, colors.darkred),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(total_table)
    elements.append(Spacer(1, 10 * mm))

    # ===== 日次明細 =====
    if wage_data.daily_details:
        elements.append(Paragraph("【日次勤務明細】", normal_style))
        elements.append(Spacer(1, 3 * mm))

        daily_header = ["日付", "出勤", "退勤", "勤務時間", "深夜", "残業", "日給"]
        daily_rows = [daily_header]

        for detail in wage_data.daily_details:
            work_h = detail["work_minutes"] // 60
            work_m = detail["work_minutes"] % 60
            night_h = detail["night_minutes"] // 60
            night_m = detail["night_minutes"] % 60
            ot_h = detail["overtime_minutes"] // 60
            ot_m = detail["overtime_minutes"] % 60

            daily_rows.append([
                detail["date"],
                detail["clock_in"] or "-",
                detail["clock_out"] or "-",
                f"{work_h}:{work_m:02d}",
                f"{night_h}:{night_m:02d}",
                f"{ot_h}:{ot_m:02d}",
                f"¥{detail['daily_total']:,}",
            ])

        daily_table = Table(
            daily_rows,
            colWidths=[25 * mm, 18 * mm, 18 * mm, 22 * mm, 18 * mm, 18 * mm, 23 * mm],
        )
        daily_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (-1, 0), colors.steelblue),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
            ("ALIGN", (1, 0), (-1, -1), "CENTER"),
            ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.lightyellow]),
        ]))
        elements.append(daily_table)

    # ===== フッター =====
    elements.append(Spacer(1, 10 * mm))
    today_str = date.today().strftime("%Y年%m月%d日")
    elements.append(Paragraph(f"発行日: {today_str}", right_style))

    # PDFを生成
    doc.build(elements)

    # バイト列を返す
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes
