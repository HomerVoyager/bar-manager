// マネージャー用勤怠管理ページ
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getYear, getMonth, getDaysInMonth } from 'date-fns';
import { Lock, Download, User, FileSpreadsheet, Edit2, X } from 'lucide-react';
import XS from 'xlsx-js-style';
import {
  fetchAttendance, fetchTodayAttendance, fetchMonthlySummary,
  fetchMonthlyDetail, monthlyClose, downloadPayslipPdf, updateAttendance,
  type DailyDetail,
} from '../api/attendance';
import { fetchStaff } from '../api/staff';
import type { Attendance, AttendanceSummary, Staff } from '../types';

const minutesToHM = (m?: number) => {
  if (!m) return '-';
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};
const yen = (n?: number) => (n ? `¥${n.toLocaleString('ja-JP')}` : '-');

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

interface EditForm {
  attendanceId: number;
  dateLabel: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: string;
}

const AttendanceManagePage: React.FC = () => {
  const [year, setYear] = useState(getYear(new Date()));
  const [month, setMonth] = useState(getMonth(new Date()) + 1);
  const [tab, setTab] = useState<'today' | 'summary' | 'detail' | 'person'>('today');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const queryClient = useQueryClient();

  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  const { data: todayList = [] } = useQuery<Attendance[]>({
    queryKey: ['attendance-today'],
    queryFn: fetchTodayAttendance,
    refetchInterval: 30000,
    enabled: tab === 'today',
  });

  const { data: summaryList = [] } = useQuery<AttendanceSummary[]>({
    queryKey: ['attendance-summary', year, month],
    queryFn: () => fetchMonthlySummary(year, month),
    enabled: tab === 'summary',
  });

  const { data: detailList = [] } = useQuery<Attendance[]>({
    queryKey: ['attendance', year, month],
    queryFn: () => fetchAttendance(year, month),
    enabled: tab === 'detail',
  });

  const { data: personDetail } = useQuery({
    queryKey: ['attendance-person', selectedStaffId, year, month],
    queryFn: () => fetchMonthlyDetail(selectedStaffId!, year, month),
    enabled: tab === 'person' && !!selectedStaffId,
  });

  const closeMutation = useMutation({
    mutationFn: () => monthlyClose(year, month),
    onSuccess: () => {
      alert('月次締め処理が完了しました');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateAttendance>[1] }) =>
      updateAttendance(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-person', selectedStaffId, year, month] });
      setEditForm(null);
    },
    onError: (e: any) => alert(e?.response?.data?.detail ?? '更新に失敗しました'),
  });

  const handleEditSave = () => {
    if (!editForm) return;
    updateMutation.mutate({
      id: editForm.attendanceId,
      data: {
        clock_in: editForm.clockIn || undefined,
        clock_out: editForm.clockOut || undefined,
        break_minutes: editForm.breakMinutes !== '' ? Number(editForm.breakMinutes) : undefined,
      },
    });
  };

  const openEdit = (detail: DailyDetail, dateLabel: string) => {
    setEditForm({
      attendanceId: detail.attendance_id,
      dateLabel,
      clockIn: detail.clock_in ?? '',
      clockOut: detail.clock_out ?? '',
      breakMinutes: String(detail.break_minutes ?? 0),
    });
  };

  const handleDownload = async (staffId: number, name: string) => {
    try {
      const blob = await downloadPayslipPdf(staffId, year, month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${name}_${year}${String(month).padStart(2, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('PDFのダウンロードに失敗しました');
    }
  };

  // 人別詳細: 月の全日を埋める
  const buildDayRows = () => {
    if (!personDetail) return [];
    const daysInMonth = getDaysInMonth(new Date(year, month - 1));
    const detailMap = new Map<string, DailyDetail>();
    (personDetail.daily_details || []).forEach((d: DailyDetail) => detailMap.set(d.date, d));

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dow = new Date(dateStr).getDay(); // 0=Sun,6=Sat
      const detail = detailMap.get(dateStr) ?? null;
      return { day, dateStr, dow, detail };
    });
  };

  const dayRows = buildDayRows();

  const handleExcelDownload = () => {
    if (!personDetail) return;


    const toHM = (m?: number) => (!m ? '' : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
    const DAY_JP = ['日', '月', '火', '水', '木', '金', '土'];

    // ── スタイル定義 ──
    const S = {
      title: { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '1F3864' } }, alignment: { horizontal: 'center', vertical: 'center' } },
      info:  { font: { bold: true, sz: 12 } },
      hdr:   { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '37474F' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } } },
      dayBase: (bg: string, textRgb: string, bold: boolean, align: string) => ({
        font: { bold, sz: 10, color: { rgb: textRgb } },
        fill: { patternType: 'solid', fgColor: { rgb: bg } },
        alignment: { horizontal: align, vertical: 'center' },
        border: { top: { style: 'hair', color: { rgb: 'CCCCCC' } }, bottom: { style: 'hair', color: { rgb: 'CCCCCC' } }, left: { style: 'thin', color: { rgb: 'AAAAAA' } }, right: { style: 'thin', color: { rgb: 'AAAAAA' } } },
      }),
      pay_num: (bg: string, bold: boolean) => ({
        font: { bold, sz: 10, color: { rgb: bold ? 'C67B00' : '333333' } },
        fill: { patternType: 'solid', fgColor: { rgb: bg } },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: { top: { style: 'thin' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } },
        numFmt: '¥#,##0',
      }),
    };

    const c = (v: string | number, s: object) => ({ v, s });
    const n = (v: number, s: object) => ({ v, t: 'n', s });
    const E = (s: object) => ({ v: '', s });

    // ── シート行を構築 ──
    const rows: object[][] = [];

    // タイトル
    rows.push([c('勤務時間表', S.title), ...Array(7).fill(E(S.title))]);

    // 情報行
    rows.push([
      c(`${year}年${month}月`, S.info), E(S.info), E(S.info), E(S.info),
      c('氏名', { font: { bold: true } }), E({}),
      c(personDetail.staff_name, { font: { bold: true, sz: 12 } }), E({}),
    ]);

    // 空行
    rows.push(Array(8).fill(c('', {})));

    // ヘッダー
    rows.push(['日','曜','出勤','退勤','勤務時間','深夜時間','残業時間','日給'].map(h => c(h, S.hdr)));

    // 日別データ
    buildDayRows().forEach(({ day, dow, detail }) => {
      const isSun = dow === 0, isSat = dow === 6, hasWork = !!detail;
      const bg = isSun ? 'FCE4EC' : isSat ? 'E3F2FD' : hasWork ? 'FFFFFF' : 'F8F8F8';
      const dowRgb = isSun ? 'CC0000' : isSat ? '1565C0' : '333333';
      const dayS = S.dayBase(bg, dowRgb, hasWork, 'center');
      const numS = S.dayBase(bg, hasWork ? 'C67B00' : '999999', hasWork, 'right');
      const txtS = S.dayBase(bg, '333333', false, 'center');
      const wrkS = S.dayBase(bg, '222222', hasWork, 'right');

      rows.push([
        c(day, dayS),
        c(DAY_JP[dow], dayS),
        c(detail?.clock_in ?? '', txtS),
        c(detail?.clock_out ?? '', txtS),
        c(detail ? toHM(detail.work_minutes) : '', wrkS),
        c(detail && detail.night_minutes > 0 ? toHM(detail.night_minutes) : '', S.dayBase(bg, '1565C0', false, 'right')),
        c(detail && detail.overtime_minutes > 0 ? toHM(detail.overtime_minutes) : '', S.dayBase(bg, 'E65100', false, 'right')),
        detail ? n(detail.daily_total, { ...numS, numFmt: '#,##0' }) : c('', numS),
      ]);
    });

    // 空行
    rows.push(Array(8).fill(c('', {})));

    // 合計行
    const totS = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '263238' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'medium' }, bottom: { style: 'medium' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    const totR = { ...totS, alignment: { horizontal: 'right', vertical: 'center' } };
    rows.push([
      c(`出勤 ${personDetail.work_days}日`, totS), E(totS), E(totS),
      c('合計', totS),
      c(toHM(personDetail.total_work_minutes), totR),
      c(toHM(personDetail.total_night_minutes), totR),
      c(toHM(personDetail.total_overtime_minutes), totR),
      n(personDetail.total_wage, { ...totR, numFmt: '#,##0', font: { bold: true, sz: 11, color: { rgb: 'FFCC00' } } }),
    ]);

    // 空行
    rows.push(Array(8).fill(c('', {})));

    // 給与ヘッダー
    const payHdrS = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '546E7A' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'medium' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } } };
    rows.push([
      c('基本給', payHdrS), c('深夜手当', payHdrS), c('残業手当', payHdrS),
      c('ドリンクバック', payHdrS), c('合計支給額', payHdrS),
      E({}), E({}), E({}),
    ]);

    // 給与値
    rows.push([
      n(personDetail.base_pay,          S.pay_num('FAFAFA', false)),
      n(personDetail.night_premium,     S.pay_num('FAFAFA', false)),
      n(personDetail.overtime_premium,  S.pay_num('FAFAFA', false)),
      n(personDetail.drink_back_total,  S.pay_num('FAFAFA', false)),
      n(personDetail.total_wage,        S.pay_num('FFF8E1', true)),
      E({}), E({}), E({}),
    ]);

    // ── ワークシート生成 ──
    const ws = XS.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 4 }, { wch: 4 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 13 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },  // タイトル
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },  // 年月
      { s: { r: 1, c: 6 }, e: { r: 1, c: 7 } },  // 氏名値
    ];
    ws['!rows'] = [{ hpt: 32 }, { hpt: 22 }, { hpt: 6 }, { hpt: 20 }];

    const wb = XS.utils.book_new();
    XS.utils.book_append_sheet(wb, ws, `${year}年${month}月`);
    XS.writeFile(wb, `勤務時間表_${personDetail.staff_name}_${year}${String(month).padStart(2, '0')}.xlsx`);
  };

  const tabLabels: { key: 'today' | 'summary' | 'detail' | 'person'; label: string }[] = [
    { key: 'today', label: '本日の状況' },
    { key: 'summary', label: '月次サマリー' },
    { key: 'detail', label: '打刻明細' },
    { key: 'person', label: '人別詳細' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-white">勤怠管理</h2>
        <button
          onClick={() => { if (window.confirm(`${year}年${month}月の月次締め処理を実行しますか？`)) closeMutation.mutate(); }}
          disabled={closeMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 text-white rounded-lg text-sm"
        >
          <Lock className="w-4 h-4" /> 月次締め
        </button>
      </div>

      {/* タブ */}
      <div className="flex flex-wrap gap-2">
        {tabLabels.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 月選択 */}
      {tab !== 'today' && (
        <div className="flex flex-wrap gap-3 items-center">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600">
            {[0, 1, 2].map((i) => <option key={i} value={getYear(new Date()) - i}>{getYear(new Date()) - i}年</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}月</option>
            ))}
          </select>
          {tab === 'person' && (
            <select
              value={selectedStaffId ?? ''}
              onChange={(e) => setSelectedStaffId(e.target.value ? Number(e.target.value) : null)}
              className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm border border-gray-600"
            >
              <option value="">スタッフを選択</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* 本日の状況 */}
      {tab === 'today' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {todayList.map((a) => (
            <div key={a.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4">
              <p className="text-white font-semibold">{a.staff_name ?? `スタッフID:${a.staff_id}`}</p>
              <div className="mt-2 text-sm text-gray-400 space-y-1">
                <p>出勤: {a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '-'}</p>
                <p>退勤: {a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : (a.clock_in ? '出勤中' : '-')}</p>
                {a.work_minutes && <p>勤務: {minutesToHM(a.work_minutes)}</p>}
              </div>
            </div>
          ))}
          {todayList.length === 0 && <p className="text-gray-500 col-span-3">本日の打刻記録がありません</p>}
        </div>
      )}

      {/* 月次サマリー */}
      {tab === 'summary' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">スタッフ</th>
                <th className="px-4 py-3 text-right">出勤日数</th>
                <th className="px-4 py-3 text-right">勤務時間</th>
                <th className="px-4 py-3 text-right">深夜時間</th>
                <th className="px-4 py-3 text-right">ドリンクバック</th>
                <th className="px-4 py-3 text-right">支給額</th>
                <th className="px-4 py-3 text-center">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {summaryList.map((s) => (
                <tr key={s.staff_id}
                  className="text-gray-300 hover:bg-gray-700/50 cursor-pointer"
                  onClick={() => { setSelectedStaffId(s.staff_id); setTab('person'); }}>
                  <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-gray-500" />{s.staff_name}
                  </td>
                  <td className="px-4 py-3 text-right">{s.work_days}日</td>
                  <td className="px-4 py-3 text-right">{minutesToHM(s.total_work_minutes)}</td>
                  <td className="px-4 py-3 text-right">{minutesToHM(s.total_night_minutes)}</td>
                  <td className="px-4 py-3 text-right text-indigo-400">{yen(s.drink_back_total)}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-semibold">{yen(s.total_wage)}</td>
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleDownload(s.staff_id, s.staff_name)}
                      className="p-1.5 hover:bg-gray-600 rounded text-gray-400 hover:text-white">
                      <Download className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 打刻明細 */}
      {tab === 'detail' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-700 text-gray-300">
              <tr>
                <th className="px-4 py-3 text-left">日付</th>
                <th className="px-4 py-3 text-left">スタッフ</th>
                <th className="px-4 py-3 text-right">出勤</th>
                <th className="px-4 py-3 text-right">退勤</th>
                <th className="px-4 py-3 text-right">勤務時間</th>
                <th className="px-4 py-3 text-right">日給</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {detailList.map((a) => (
                <tr key={a.id} className="text-gray-300 hover:bg-gray-700/50">
                  <td className="px-4 py-3">{a.date}</td>
                  <td className="px-4 py-3 font-medium text-white">{a.staff_name ?? `ID:${a.staff_id}`}</td>
                  <td className="px-4 py-3 text-right">{a.clock_in ? format(new Date(a.clock_in), 'HH:mm') : '-'}</td>
                  <td className="px-4 py-3 text-right">{a.clock_out ? format(new Date(a.clock_out), 'HH:mm') : '-'}</td>
                  <td className="px-4 py-3 text-right">{minutesToHM(a.work_minutes)}</td>
                  <td className="px-4 py-3 text-right text-amber-400">{yen(a.wage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 人別詳細 */}
      {tab === 'person' && (
        <div className="space-y-4">
          {!selectedStaffId ? (
            <p className="text-gray-500 text-center py-10">スタッフを選択してください</p>
          ) : !personDetail ? (
            <p className="text-gray-500 text-center py-10">読み込み中...</p>
          ) : (
            <>
              {/* ヘッダーカード */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-gray-400 text-xs mb-1">{year}年{month}月</p>
                  <p className="text-white text-xl font-bold">{personDetail.staff_name}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleExcelDownload}
                    className="flex items-center gap-2 px-3 py-2 bg-green-800 hover:bg-green-700 text-green-200 rounded-lg text-sm">
                    <FileSpreadsheet className="w-4 h-4" /> Excel
                  </button>
                  <button onClick={() => handleDownload(selectedStaffId, personDetail.staff_name)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm">
                    <Download className="w-4 h-4" /> PDF
                  </button>
                </div>
              </div>

              {/* 日別テーブル */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
                <table className="w-full text-sm min-w-[760px]">
                  <thead className="bg-gray-700 text-gray-300 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">日</th>
                      <th className="px-3 py-2 text-center w-10">曜</th>
                      <th className="px-3 py-2 text-center">出勤</th>
                      <th className="px-3 py-2 text-center">退勤</th>
                      <th className="px-3 py-2 text-right">休憩</th>
                      <th className="px-3 py-2 text-right">勤務時間</th>
                      <th className="px-3 py-2 text-right">深夜</th>
                      <th className="px-3 py-2 text-right">残業</th>
                      <th className="px-3 py-2 text-right">バック</th>
                      <th className="px-3 py-2 text-right">日給</th>
                      <th className="px-3 py-2 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {dayRows.map(({ day, dateStr, dow, detail }) => {
                      const isSun = dow === 0;
                      const isSat = dow === 6;
                      const rowBg = isSun ? 'bg-red-900/10' : isSat ? 'bg-blue-900/10' : '';
                      const dowLabel = DAY_LABELS[dow === 0 ? 6 : dow - 1];
                      const dowColor = isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-400';

                      return (
                        <tr key={dateStr} className={`${rowBg} hover:bg-white/5`}>
                          <td className="px-3 py-1.5 text-center text-gray-300">{day}</td>
                          <td className={`px-3 py-1.5 text-center text-xs font-medium ${dowColor}`}>{dowLabel}</td>
                          <td className="px-3 py-1.5 text-center text-gray-300">{detail?.clock_in ?? '-'}</td>
                          <td className="px-3 py-1.5 text-center text-gray-300">{detail?.clock_out ?? '-'}</td>
                          <td className="px-3 py-1.5 text-right text-amber-300 text-xs">
                            {detail && detail.break_minutes > 0 ? `${detail.break_minutes}分` : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-white font-medium">
                            {detail ? minutesToHM(detail.work_minutes) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-indigo-400">
                            {detail && detail.night_minutes > 0 ? minutesToHM(detail.night_minutes) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-yellow-400">
                            {detail && detail.overtime_minutes > 0 ? minutesToHM(detail.overtime_minutes) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-purple-400 text-xs">
                            {detail && detail.drink_back > 0 ? yen(detail.drink_back) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-amber-400">
                            {detail ? yen(detail.daily_total) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {detail && (
                              <button
                                onClick={() => openEdit(detail, `${month}/${day}`)}
                                className="p-1 rounded hover:bg-gray-600 text-gray-500 hover:text-white transition-colors"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* 合計行 */}
                  <tfoot className="bg-gray-700 text-white font-semibold text-sm border-t-2 border-gray-500">
                    <tr>
                      <td colSpan={2} className="px-3 py-2 text-gray-300">
                        合計 ({personDetail.work_days}日出勤)
                      </td>
                      <td colSpan={3}></td>
                      <td className="px-3 py-2 text-right">{minutesToHM(personDetail.total_work_minutes)}</td>
                      <td className="px-3 py-2 text-right text-indigo-300">{minutesToHM(personDetail.total_night_minutes)}</td>
                      <td className="px-3 py-2 text-right text-yellow-300">{minutesToHM(personDetail.total_overtime_minutes)}</td>
                      <td className="px-3 py-2 text-right text-purple-300">{yen(personDetail.drink_back_total)}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{yen(personDetail.total_wage)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 給与サマリー */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: '基本給', value: personDetail.base_pay, color: 'text-white' },
                  { label: '深夜手当', value: personDetail.night_premium, color: 'text-indigo-400' },
                  { label: '残業手当', value: personDetail.overtime_premium, color: 'text-yellow-400' },
                  { label: 'ドリンクバック', value: personDetail.drink_back_total, color: 'text-purple-400' },
                  { label: '合計支給額', value: personDetail.total_wage, color: 'text-amber-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-800 rounded-xl border border-gray-700 p-4 text-center">
                    <p className="text-gray-400 text-xs mb-1">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{yen(value)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {/* 打刻修正モーダル */}
      {editForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-white font-bold">{editForm.dateLabel} の打刻修正</h3>
              <button onClick={() => setEditForm(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">出勤時刻</label>
                <input
                  type="time"
                  value={editForm.clockIn}
                  onChange={(e) => setEditForm({ ...editForm, clockIn: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">退勤時刻</label>
                <input
                  type="time"
                  value={editForm.clockOut}
                  onChange={(e) => setEditForm({ ...editForm, clockOut: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">休憩時間（分）</label>
                <input
                  type="number"
                  min="0"
                  max="480"
                  value={editForm.breakMinutes}
                  onChange={(e) => setEditForm({ ...editForm, breakMinutes: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditForm(null)}
                className="flex-1 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleEditSave}
                disabled={updateMutation.isPending}
                className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold text-sm"
              >
                {updateMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceManagePage;
