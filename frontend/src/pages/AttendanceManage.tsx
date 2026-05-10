// マネージャー用勤怠管理ページ
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getYear, getMonth } from 'date-fns';
import { Lock, Download } from 'lucide-react';
import {
  fetchAttendance, fetchTodayAttendance, fetchMonthlySummary,
  monthlyClose, downloadPayslipPdf,
} from '../api/attendance';
import type { Attendance, AttendanceSummary } from '../types';

const minutesToHM = (m?: number) => {
  if (!m) return '-';
  return `${Math.floor(m / 60)}時間${m % 60 > 0 ? (m % 60) + '分' : ''}`;
};
const yen = (n?: number) => n ? `¥${n.toLocaleString('ja-JP')}` : '-';

const AttendanceManagePage: React.FC = () => {
  const [year, setYear] = useState(getYear(new Date()));
  const [month, setMonth] = useState(getMonth(new Date()) + 1);
  const [tab, setTab] = useState<'today' | 'summary' | 'detail'>('today');
  const queryClient = useQueryClient();

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
      <div className="flex gap-2">
        {(['today', 'summary', 'detail'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            {t === 'today' ? '本日の状況' : t === 'summary' ? '月次サマリー' : '打刻明細'}
          </button>
        ))}
      </div>

      {/* 月選択（summary / detail タブ） */}
      {tab !== 'today' && (
        <div className="flex gap-3 items-center">
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
                <th className="px-4 py-3 text-right">支給額</th>
                <th className="px-4 py-3 text-center">PDF</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {summaryList.map((s) => (
                <tr key={s.staff_id} className="text-gray-300 hover:bg-gray-700/50">
                  <td className="px-4 py-3 font-medium text-white">{s.staff_name}</td>
                  <td className="px-4 py-3 text-right">{s.work_days}日</td>
                  <td className="px-4 py-3 text-right">{minutesToHM(s.total_work_minutes)}</td>
                  <td className="px-4 py-3 text-right">{minutesToHM(s.total_night_minutes)}</td>
                  <td className="px-4 py-3 text-right text-amber-400 font-semibold">{yen(s.total_wage)}</td>
                  <td className="px-4 py-3 text-center">
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
    </div>
  );
};

export default AttendanceManagePage;
