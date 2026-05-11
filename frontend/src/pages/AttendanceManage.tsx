// マネージャー用勤怠管理ページ
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getYear, getMonth, getDaysInMonth } from 'date-fns';
import { Lock, Download, User, FileSpreadsheet } from 'lucide-react';
import {
  fetchAttendance, fetchTodayAttendance, fetchMonthlySummary,
  fetchMonthlyDetail, monthlyClose, downloadPayslipPdf,
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

const AttendanceManagePage: React.FC = () => {
  const [year, setYear] = useState(getYear(new Date()));
  const [month, setMonth] = useState(getMonth(new Date()) + 1);
  const [tab, setTab] = useState<'today' | 'summary' | 'detail' | 'person'>('today');
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
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

  const handleExcelDownload = async () => {
    if (!personDetail) return;
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(`${year}年${month}月`);

    const toHM = (m?: number) => (!m ? '' : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`);
    const DAY_JP = ['日', '月', '火', '水', '木', '金', '土'];
    const thin = { style: 'thin' as const, color: { argb: 'FFBBBBBB' } };
    const medium = { style: 'medium' as const, color: { argb: 'FF888888' } };
    const border = (t = thin, b = thin, l = thin, r = thin) => ({ top: t, bottom: b, left: l, right: r });
    const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
    const center = { horizontal: 'center' as const, vertical: 'middle' as const };
    const right  = { horizontal: 'right'  as const, vertical: 'middle' as const };

    ws.columns = [
      { width: 5 }, { width: 5 }, { width: 9 }, { width: 9 },
      { width: 11 }, { width: 11 }, { width: 11 }, { width: 14 },
    ];

    // ── タイトル行 ──
    ws.addRow(['勤務時間表']);
    ws.mergeCells('A1:H1');
    Object.assign(ws.getCell('A1'), {
      font: { bold: true, size: 16, color: { argb: 'FFFFFFFF' } },
      fill: fill('FF1F3864'), alignment: center,
    });
    ws.getRow(1).height = 32;

    // ── 情報行 ──
    ws.addRow([`${year}年${month}月`, '', '', '', '氏名', '', personDetail.staff_name]);
    ws.mergeCells('A2:D2'); ws.mergeCells('E2:F2'); ws.mergeCells('G2:H2');
    ws.getCell('A2').font = { bold: true, size: 12 };
    ws.getCell('E2').font = { bold: true };
    ws.getCell('G2').font = { bold: true, size: 12 };
    ws.getRow(2).height = 24;

    // ── 空行 ──
    ws.addRow([]); ws.getRow(3).height = 6;

    // ── ヘッダー行 ──
    const hRow = ws.addRow(['日', '曜', '出勤', '退勤', '勤務時間', '深夜時間', '残業時間', '日給']);
    hRow.height = 22;
    hRow.eachCell(cell => {
      cell.font = { bold: true, size: 10 };
      cell.fill = fill('FF404040');
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = center;
      cell.border = border(medium, medium);
    });

    // ── 日別データ ──
    buildDayRows().forEach(({ day, dow, detail }) => {
      const isSun = dow === 0, isSat = dow === 6, hasWork = !!detail;
      const bg = isSun ? 'FFFCE4EC' : isSat ? 'FFE3F2FD' : hasWork ? 'FFFFFFFF' : 'FFF5F5F5';
      const dowColor = isSun ? 'FFCC0000' : isSat ? 'FF1565C0' : 'FF333333';

      const row = ws.addRow([
        day, DAY_JP[dow],
        detail?.clock_in ?? '', detail?.clock_out ?? '',
        detail ? toHM(detail.work_minutes) : '',
        detail && detail.night_minutes > 0 ? toHM(detail.night_minutes) : '',
        detail && detail.overtime_minutes > 0 ? toHM(detail.overtime_minutes) : '',
        detail ? detail.daily_total : '',
      ]);
      row.height = 17;

      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.fill = fill(bg);
        cell.border = border();
        cell.alignment = col <= 4 ? center : right;
      });
      row.getCell(1).font = { bold: hasWork, color: { argb: dowColor } };
      row.getCell(2).font = { bold: hasWork, color: { argb: dowColor } };
      if (hasWork && detail) {
        row.getCell(8).numFmt = '#,##0';
        row.getCell(8).font = { bold: true, color: { argb: 'FFC67B00' } };
        row.getCell(5).font = { bold: true };
      }
    });

    // ── 合計行 ──
    ws.addRow([]); // 空行
    const tRow = ws.addRow([
      `出勤 ${personDetail.work_days}日`, '', '', '合計',
      toHM(personDetail.total_work_minutes),
      toHM(personDetail.total_night_minutes),
      toHM(personDetail.total_overtime_minutes),
      personDetail.total_wage,
    ]);
    ws.mergeCells(`A${tRow.number}:C${tRow.number}`);
    tRow.height = 22;
    tRow.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.fill = fill('FF263238');
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.border = border(medium, medium);
      cell.alignment = col <= 4 ? center : right;
      if (col === 8) { cell.numFmt = '#,##0'; cell.font = { bold: true, color: { argb: 'FFFFCC00' } }; }
    });

    // ── 給与サマリー ──
    ws.addRow([]);
    const payLabels = ['基本給', '深夜手当', '残業手当', 'ドリンクバック', '合計支給額'];
    const payValues = [
      personDetail.base_pay, personDetail.night_premium,
      personDetail.overtime_premium, personDetail.drink_back_total, personDetail.total_wage,
    ];
    const lRow = ws.addRow([...payLabels, '', '', '']);
    lRow.height = 21;
    payLabels.forEach((_, i) => {
      const cell = lRow.getCell(i + 1);
      cell.fill = fill('FF546E7A');
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = center;
      cell.border = border(medium, medium);
    });

    const vRow = ws.addRow([...payValues, '', '', '']);
    vRow.height = 24;
    payValues.forEach((v, i) => {
      const cell = vRow.getCell(i + 1);
      cell.value = v;
      cell.numFmt = '¥#,##0';
      const isTotal = i === 4;
      cell.fill = fill(isTotal ? 'FFFFF2CC' : 'FFFAFAFA');
      cell.font = { bold: isTotal, size: isTotal ? 12 : 10, color: { argb: isTotal ? 'FFC67B00' : 'FF333333' } };
      cell.alignment = right;
      cell.border = border(thin, medium);
    });

    // ── ダウンロード ──
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `勤務時間表_${personDetail.staff_name}_${year}${String(month).padStart(2, '0')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="bg-gray-700 text-gray-300 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-center w-10">日</th>
                      <th className="px-3 py-2 text-center w-10">曜</th>
                      <th className="px-3 py-2 text-center">出勤</th>
                      <th className="px-3 py-2 text-center">退勤</th>
                      <th className="px-3 py-2 text-right">勤務時間</th>
                      <th className="px-3 py-2 text-right">深夜</th>
                      <th className="px-3 py-2 text-right">残業</th>
                      <th className="px-3 py-2 text-right">日給</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {dayRows.map(({ day, dateStr, dow, detail }) => {
                      const isSun = dow === 0;
                      const isSat = dow === 6;
                      const rowBg = isSun
                        ? 'bg-red-900/10'
                        : isSat
                        ? 'bg-blue-900/10'
                        : '';
                      const dowLabel = DAY_LABELS[dow === 0 ? 6 : dow - 1];
                      const dowColor = isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-400';

                      return (
                        <tr key={dateStr} className={`${rowBg} hover:bg-white/5`}>
                          <td className="px-3 py-1.5 text-center text-gray-300">{day}</td>
                          <td className={`px-3 py-1.5 text-center text-xs font-medium ${dowColor}`}>{dowLabel}</td>
                          <td className="px-3 py-1.5 text-center text-gray-300">{detail?.clock_in ?? '-'}</td>
                          <td className="px-3 py-1.5 text-center text-gray-300">{detail?.clock_out ?? '-'}</td>
                          <td className="px-3 py-1.5 text-right text-white font-medium">
                            {detail ? minutesToHM(detail.work_minutes) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-indigo-400">
                            {detail && detail.night_minutes > 0 ? minutesToHM(detail.night_minutes) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-yellow-400">
                            {detail && detail.overtime_minutes > 0 ? minutesToHM(detail.overtime_minutes) : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-amber-400">
                            {detail ? yen(detail.daily_total) : '-'}
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
                      <td colSpan={2}></td>
                      <td className="px-3 py-2 text-right">{minutesToHM(personDetail.total_work_minutes)}</td>
                      <td className="px-3 py-2 text-right text-indigo-300">{minutesToHM(personDetail.total_night_minutes)}</td>
                      <td className="px-3 py-2 text-right text-yellow-300">{minutesToHM(personDetail.total_overtime_minutes)}</td>
                      <td className="px-3 py-2 text-right text-amber-400">{yen(personDetail.total_wage)}</td>
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
    </div>
  );
};

export default AttendanceManagePage;
