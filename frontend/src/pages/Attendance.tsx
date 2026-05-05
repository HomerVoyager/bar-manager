// バー管理システム - 勤怠管理ページ

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, getYear, getMonth } from 'date-fns';
import {
  Clock, Users, Download, Lock, LogIn, LogOut,
  CheckCircle, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  fetchAttendance,
  fetchTodayAttendance,
  fetchMonthlySummary,
  clockIn,
  clockOut,
  monthlyClose,
  downloadPayslipPdf,
} from '../api/attendance';
import { fetchStaff } from '../api/staff';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';
import type { Attendance, AttendanceSummary, Staff } from '../types';

const minutesToHM = (minutes?: number): string => {
  if (!minutes || minutes === 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}時間${m > 0 ? m + '分' : ''}`;
};

const formatYen = (amount?: number): string => {
  if (!amount) return '-';
  return `¥${amount.toLocaleString('ja-JP')}`;
};

const AttendancePage: React.FC = () => {
  const { user, isManager } = useAuth();
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()) + 1);
  const [activeView, setActiveView] = useState<'detail' | 'summary'>('summary');
  const [managerSectionOpen, setManagerSectionOpen] = useState(false);
  const queryClient = useQueryClient();

  const yearOptions = Array.from({ length: 3 }, (_, i) => getYear(new Date()) - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // 本日の勤怠（自分の打刻状態確認用）
  const { data: todayList, isLoading: todayLoading } = useQuery<Attendance[]>({
    queryKey: ['attendance-today'],
    queryFn: fetchTodayAttendance,
    refetchInterval: 30000,
  });

  // ログイン中ユーザーの本日記録
  const myToday = todayList?.find((a) => a.staff_id === user?.id);
  const isClockedIn = !!myToday?.clock_in;
  const isClockedOut = !!myToday?.clock_out;

  const { data: staffList } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  const { data: attendanceList, isLoading: attendanceLoading } = useQuery<Attendance[]>({
    queryKey: ['attendance', selectedYear, selectedMonth],
    queryFn: () => fetchAttendance(selectedYear, selectedMonth),
    enabled: activeView === 'detail',
  });

  const { data: summaryList, isLoading: summaryLoading } = useQuery<AttendanceSummary[]>({
    queryKey: ['attendance-summary', selectedYear, selectedMonth],
    queryFn: () => fetchMonthlySummary(selectedYear, selectedMonth),
    enabled: activeView === 'summary',
  });

  const clockInMutation = useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      alert(detail || '出勤打刻に失敗しました。');
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: clockOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: any) => {
      const detail = error?.response?.data?.detail;
      alert(detail || '退勤打刻に失敗しました。');
    },
  });

  const monthlyCloseMutation = useMutation({
    mutationFn: () => monthlyClose(selectedYear, selectedMonth),
    onSuccess: () => {
      alert('月次締め処理が完了しました。');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: () => alert('月次締め処理に失敗しました。'),
  });

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

  const handleMonthlyClose = () => {
    if (window.confirm(
      `${selectedYear}年${selectedMonth}月の月次締め処理を実行しますか？\nこの操作は元に戻せません。`
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
          <p className="text-gray-400 text-sm mt-1">
            {format(new Date(), 'yyyy年M月d日')}
          </p>
        </div>
        {isManager && (
          <button
            onClick={handleMonthlyClose}
            disabled={monthlyCloseMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:bg-red-900 text-white rounded-lg transition-colors text-sm"
          >
            <Lock className="w-4 h-4" />
            月次締め処理
          </button>
        )}
      </div>

      {/* ===== 自分の打刻カード ===== */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-semibold text-lg">今日の打刻</h3>
        </div>

        {todayLoading ? (
          <LoadingSpinner message="打刻状態を確認中..." />
        ) : (
          <div className="flex flex-col items-center gap-5">
            {/* ユーザーアバター & 名前 */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-full bg-amber-700 flex items-center justify-center">
                <span className="text-white text-3xl font-bold">
                  {user?.name?.charAt(0) ?? '?'}
                </span>
              </div>
              <div className="text-center">
                <p className="text-white text-xl font-bold">{user?.name}</p>
                <p className="text-gray-400 text-sm">
                  {user?.role === 'manager' ? 'マネージャー' : 'スタッフ'}
                </p>
              </div>
            </div>

            {/* 打刻状態 */}
            {isClockedOut ? (
              /* 退勤済み */
              <div className="w-full max-w-xs bg-gray-700/50 rounded-xl p-4 text-center space-y-1">
                <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-semibold">本日の勤務完了</p>
                <p className="text-gray-400 text-sm">
                  出勤 {myToday?.clock_in ? format(new Date(myToday.clock_in), 'HH:mm') : '-'}
                  　→
                  退勤 {myToday?.clock_out ? format(new Date(myToday.clock_out), 'HH:mm') : '-'}
                </p>
                {myToday?.work_minutes && (
                  <p className="text-gray-400 text-sm">
                    勤務時間: {minutesToHM(myToday.work_minutes)}
                  </p>
                )}
              </div>
            ) : isClockedIn ? (
              /* 出勤中 → 退勤ボタン */
              <div className="w-full max-w-xs flex flex-col items-center gap-3">
                <div className="bg-green-900/30 border border-green-700 rounded-xl p-3 text-center w-full">
                  <p className="text-green-400 text-sm font-medium">出勤中</p>
                  <p className="text-white text-lg font-bold">
                    {myToday?.clock_in ? format(new Date(myToday.clock_in), 'HH:mm') : '-'} から
                  </p>
                </div>
                <button
                  onClick={() => user && clockOutMutation.mutate(user.id)}
                  disabled={clockOutMutation.isPending}
                  className="w-full py-5 bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-red-900 text-white rounded-2xl text-xl font-bold transition-colors flex items-center justify-center gap-3 shadow-lg"
                >
                  <LogOut className="w-6 h-6" />
                  退勤する
                </button>
              </div>
            ) : (
              /* 未打刻 → 出勤ボタン */
              <div className="w-full max-w-xs">
                <button
                  onClick={() => user && clockInMutation.mutate(user.id)}
                  disabled={clockInMutation.isPending}
                  className="w-full py-5 bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:bg-green-900 text-white rounded-2xl text-xl font-bold transition-colors flex items-center justify-center gap-3 shadow-lg"
                >
                  <LogIn className="w-6 h-6" />
                  出勤する
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== マネージャー専用: 他スタッフ打刻 ===== */}
      {isManager && (
        <div className="bg-gray-800 rounded-xl border border-gray-700">
          <button
            onClick={() => setManagerSectionOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              <span className="text-white font-medium text-sm">他スタッフの打刻（マネージャー操作）</span>
            </div>
            {managerSectionOpen
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />
            }
          </button>

          {managerSectionOpen && (
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 border-t border-gray-700 pt-4">
              {staffList?.filter((s) => s.is_active && s.id !== user?.id).map((staff) => {
                const staffToday = todayList?.find((a) => a.staff_id === staff.id);
                const sIn = !!staffToday?.clock_in;
                const sOut = !!staffToday?.clock_out;
                return (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between bg-gray-900 rounded-lg px-3 py-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${sIn && !sOut ? 'bg-green-700' : sOut ? 'bg-gray-600' : 'bg-amber-700'}`}>
                        <span className="text-white text-sm font-medium">{staff.name.charAt(0)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{staff.name}</p>
                        <p className="text-gray-500 text-xs">
                          {sOut ? `退勤済み ${staffToday?.clock_out ? format(new Date(staffToday.clock_out), 'HH:mm') : ''}` : sIn ? `出勤中 ${staffToday?.clock_in ? format(new Date(staffToday.clock_in), 'HH:mm') : ''}〜` : '未打刻'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => clockInMutation.mutate(staff.id)}
                        disabled={clockInMutation.isPending || sIn}
                        className="p-2 rounded-lg bg-green-900/50 hover:bg-green-700/50 disabled:opacity-30 text-green-400 transition-colors"
                        title="出勤打刻"
                      >
                        <LogIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => clockOutMutation.mutate(staff.id)}
                        disabled={clockOutMutation.isPending || !sIn || sOut}
                        className="p-2 rounded-lg bg-red-900/50 hover:bg-red-700/50 disabled:opacity-30 text-red-400 transition-colors"
                        title="退勤打刻"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== 月次データ ===== */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex flex-wrap items-center gap-4">
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
        <div className="flex bg-gray-900 rounded-lg p-1">
          <button
            onClick={() => setActiveView('summary')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'summary' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4" />
            月次サマリー
          </button>
          <button
            onClick={() => setActiveView('detail')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeView === 'detail' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Clock className="w-4 h-4" />
            日次詳細
          </button>
        </div>
      </div>

      {/* 月次サマリー */}
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
                    {isManager && (
                      <th className="text-center text-gray-400 px-5 py-3 font-medium">給与明細</th>
                    )}
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
                      <td className="px-5 py-3 text-right text-gray-300">{summary.work_days}日</td>
                      <td className="px-5 py-3 text-right text-gray-300">{minutesToHM(summary.total_work_minutes)}</td>
                      <td className="px-5 py-3 text-right text-indigo-400">{minutesToHM(summary.total_night_minutes)}</td>
                      <td className="px-5 py-3 text-right text-amber-400 font-semibold">{formatYen(summary.total_wage)}</td>
                      {isManager && (
                        <td className="px-5 py-3 text-center">
                          <button
                            onClick={() => handleDownloadPayslip(summary.staff_id, summary.staff_name)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs transition-colors mx-auto"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {(!summaryList || summaryList.length === 0) && (
                    <tr>
                      <td colSpan={isManager ? 6 : 5} className="px-5 py-10 text-center text-gray-500">
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

      {/* 日次詳細 */}
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
                    <th className="text-center text-gray-400 px-5 py-3 font-medium">出勤</th>
                    <th className="text-center text-gray-400 px-5 py-3 font-medium">退勤</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">労働時間</th>
                    <th className="text-right text-gray-400 px-5 py-3 font-medium">日給</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {attendanceList?.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-700/30 transition-colors">
                      <td className="px-5 py-3 text-white">
                        {record.staff_name ?? `ID: ${record.staff_id}`}
                      </td>
                      <td className="px-5 py-3 text-gray-400">
                        {format(new Date(record.date), 'M/d')}
                      </td>
                      <td className="px-5 py-3 text-center text-green-400">
                        {record.clock_in ? format(new Date(record.clock_in), 'HH:mm') : <span className="text-gray-600">-</span>}
                      </td>
                      <td className="px-5 py-3 text-center text-red-400">
                        {record.clock_out ? format(new Date(record.clock_out), 'HH:mm') : <span className="text-yellow-500 text-xs">勤務中</span>}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-300">
                        {minutesToHM(record.work_minutes)}
                      </td>
                      <td className="px-5 py-3 text-right text-amber-400 font-medium">
                        {formatYen(record.wage)}
                      </td>
                    </tr>
                  ))}
                  {(!attendanceList || attendanceList.length === 0) && (
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
    </div>
  );
};

export default AttendancePage;
