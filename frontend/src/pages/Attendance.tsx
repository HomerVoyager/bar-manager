// バー管理システム - 勤怠管理ページ
// スタッフの勤怠記録・集計・月次締め処理を行います

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getYear, getMonth } from 'date-fns';
import { Clock, Users, Download, Lock, LogIn, LogOut, AlertTriangle } from 'lucide-react';
import {
  fetchAttendance,
  fetchMonthlySummary,
  clockIn,
  clockOut,
  monthlyClose,
  downloadPayslipPdf,
} from '../api/attendance';
import { fetchStaff } from '../api/staff';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Attendance, AttendanceSummary, Staff } from '../types';

// 分を時間:分形式に変換
const minutesToHM = (minutes?: number): string => {
  if (!minutes || minutes === 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}時間${m > 0 ? m + '分' : ''}`;
};

// 日本円フォーマット
const formatYen = (amount?: number): string => {
  if (!amount) return '-';
  return `¥${amount.toLocaleString('ja-JP')}`;
};

const AttendancePage: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()) + 1);
  const [activeView, setActiveView] = useState<'detail' | 'summary'>('summary');
  const queryClient = useQueryClient();

  // 年・月オプション
  const yearOptions = Array.from({ length: 3 }, (_, i) => getYear(new Date()) - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // スタッフ一覧の取得
  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  // 勤怠詳細データの取得
  const { data: attendanceList, isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ['attendance', selectedYear, selectedMonth],
    queryFn: () => fetchAttendance(selectedYear, selectedMonth),
    enabled: activeView === 'detail',
  });

  // 月次サマリーの取得
  const { data: summaryList, isLoading: summaryLoading } = useQuery<AttendanceSummary[]>({
    queryKey: ['attendance-summary', selectedYear, selectedMonth],
    queryFn: () => fetchMonthlySummary(selectedYear, selectedMonth),
    enabled: activeView === 'summary',
  });

  // クロックインミューテーション
  const clockInMutation = useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => alert('出勤打刻に失敗しました。'),
  });

  // クロックアウトミューテーション
  const clockOutMutation = useMutation({
    mutationFn: clockOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => alert('退勤打刻に失敗しました。'),
  });

  // 月次締め処理ミューテーション
  const monthlyCloseMutation = useMutation({
    mutationFn: () => monthlyClose(selectedYear, selectedMonth),
    onSuccess: (data) => {
      alert(data.message || '月次締め処理が完了しました。');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: () => alert('月次締め処理に失敗しました。'),
  });

  // 給与明細PDFダウンロード
  const handleDownloadPayslip = async (staffId: number, staffName: string) => {
    try {
      const blob = await downloadPayslipPdf(staffId, selectedYear, selectedMonth);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payslip_${staffName}_${selectedYear}${String(selectedMonth).padStart(2, '0')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('給与明細PDFのダウンロードに失敗しました。');
    }
  };

  // 月次締め確認
  const handleMonthlyClose = () => {
    if (window.confirm(
      `${selectedYear}年${selectedMonth}月の勤怠月次締め処理を実行しますか？\nこの操作は元に戻せません。`
    )) {
      monthlyCloseMutation.mutate();
    }
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">勤怠管理</h2>
          <p className="text-gray-400 text-sm mt-1">スタッフの勤怠記録と月次集計</p>
        </div>
        {/* 月次締めボタン */}
        <button
          onClick={handleMonthlyClose}
          disabled={monthlyCloseMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-red-900 text-white rounded-lg transition-colors text-sm"
        >
          <Lock className="w-4 h-4" />
          月次締め処理
        </button>
      </div>

      {/* 期間選択とビュー切り替え */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-wrap items-center gap-4">
        {/* 年月選択 */}
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>

        {/* ビュー切り替え */}
        <div className="flex bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => setActiveView('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeView === 'summary' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            月次サマリー
          </button>
          <button
            onClick={() => setActiveView('detail')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              activeView === 'detail' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            日次詳細
          </button>
        </div>
      </div>

      {/* クイック打刻ボタン */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <h3 className="text-white font-medium mb-3 text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          クイック打刻（マネージャー操作用）
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {staffList?.filter((s) => s.is_active).map((staff) => (
            <div
              key={staff.id}
              className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-medium">{staff.name.charAt(0)}</span>
                </div>
                <span className="text-white text-sm">{staff.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => clockInMutation.mutate(staff.id)}
                  disabled={clockInMutation.isPending}
                  className="p-1.5 rounded-md bg-green-900/50 hover:bg-green-700/50 text-green-400 transition-colors"
                  title="出勤打刻"
                >
                  <LogIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => clockOutMutation.mutate(staff.id)}
                  disabled={clockOutMutation.isPending}
                  className="p-1.5 rounded-md bg-red-900/50 hover:bg-red-700/50 text-red-400 transition-colors"
                  title="退勤打刻"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 月次サマリービュー */}
      {activeView === 'summary' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-5 py-4 border-b border-gray-700">
            <h3 className="text-white font-semibold">
              {selectedYear}年{selectedMonth}月 月次サマリー
            </h3>
          </div>
          {summaryLoading ? (
            <LoadingSpinner message="サマリーを読み込み中..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 px-5 py-3 font-medium">スタッフ名</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">出勤日数</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">総労働時間</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">深夜時間</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">推定給与</th>
                    <th className="text-center text-gray-400 px-5 py-3 font-medium">給与明細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {summaryList?.map((summary) => (
                    <tr key={summary.staff_id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-medium">
                              {summary.staff_name.charAt(0)}
                            </span>
                          </div>
                          <span className="text-white">{summary.staff_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {summary.total_days}日
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {minutesToHM(summary.total_work_minutes)}
                      </td>
                      <td className="px-5 py-3 text-right text-indigo-400">
                        {minutesToHM(summary.total_night_minutes)}
                      </td>
                      <td className="px-5 py-3 text-right text-amber-400 font-semibold">
                        {formatYen(summary.estimated_wage)}
                      </td>
                      <td className="px-5 py-3 text-center">
                        <button
                          onClick={() => handleDownloadPayslip(summary.staff_id, summary.staff_name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors mx-auto"
                        >
                          <Download className="w-3.5 h-3.5" />
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!summaryList || summaryList.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-gray-500">
                        この月の勤怠データがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 日次詳細ビュー */}
      {activeView === 'detail' && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <div className="px-5 py-4 border-b border-gray-700">
            <h3 className="text-white font-semibold">
              {selectedYear}年{selectedMonth}月 勤怠詳細
            </h3>
          </div>
          {attendanceLoading ? (
            <LoadingSpinner message="勤怠データを読み込み中..." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left text-gray-400 px-5 py-3 font-medium">スタッフ名</th>
                    <th className="text-left text-gray-400 px-5 py-3 font-medium">日付</th>
                    <th className="text-center text-gray-400 px-5 py-3 font-medium">出勤時刻</th>
                    <th className="text-center text-gray-400 px-5 py-3 font-medium">退勤時刻</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">労働時間</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">深夜時間</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">日給</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {attendanceList?.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3 text-white">
                        {record.staff_name ?? `スタッフID: ${record.staff_id}`}
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {format(new Date(record.date), 'M月d日 (E)', { locale: undefined })}
                      </td>
                      <td className="px-5 py-3 text-center text-green-400">
                        {record.clock_in
                          ? format(new Date(record.clock_in), 'HH:mm')
                          : <span className="text-gray-600">-</span>
                        }
                      </td>
                      <td className="px-5 py-3 text-center text-red-400">
                        {record.clock_out
                          ? format(new Date(record.clock_out), 'HH:mm')
                          : <span className="text-yellow-500">未退勤</span>
                        }
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {minutesToHM(record.work_minutes)}
                      </td>
                      <td className="px-5 py-3 text-right text-indigo-400">
                        {minutesToHM(record.night_minutes)}
                      </td>
                      <td className="px-5 py-3 text-right text-amber-400 font-medium">
                        {formatYen(record.wage)}
                      </td>
                    </tr>
                  ))}
                  {(!attendanceList || attendanceList.length === 0) && (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                        この月の勤怠データがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
