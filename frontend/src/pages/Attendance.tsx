// 共有タブレット打刻ページ
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Clock, LogIn, LogOut, CheckCircle } from 'lucide-react';
import { fetchTodayAttendance, clockIn, clockOut } from '../api/attendance';
import { fetchStaff } from '../api/staff';
import { fetchShifts } from '../api/shifts';
import type { Attendance, Staff, Shift } from '../types';

type ClockStatus = 'before' | 'in' | 'done';

const getStatus = (attendance?: Attendance): ClockStatus => {
  if (!attendance?.clock_in) return 'before';
  if (!attendance?.clock_out) return 'in';
  return 'done';
};

const statusLabel: Record<ClockStatus, string> = {
  before: '未出勤',
  in: '出勤中',
  done: '退勤済',
};

const statusColor: Record<ClockStatus, string> = {
  before: 'bg-gray-700 border-gray-600 text-gray-300',
  in: 'bg-green-900 border-green-500 text-white',
  done: 'bg-gray-800 border-gray-700 text-gray-500',
};

const badgeColor: Record<ClockStatus, string> = {
  before: 'bg-gray-600 text-gray-300',
  in: 'bg-green-500 text-white',
  done: 'bg-gray-600 text-gray-400',
};

const AttendancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(new Date());
  const [confirm, setConfirm] = useState<{ staff: Staff; action: 'in' | 'out' } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const today = format(now, 'yyyy-MM-dd');
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(addDays(startOfWeek(now, { weekStartsOn: 1 }), 6), 'yyyy-MM-dd');

  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  const { data: todayList = [] } = useQuery<Attendance[]>({
    queryKey: ['attendance-today'],
    queryFn: fetchTodayAttendance,
    refetchInterval: 15000,
  });

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['shifts-week', weekStart, weekEnd],
    queryFn: () => fetchShifts(weekStart, weekEnd),
  });

  const activeStaff = staffList.filter((s) => s.is_active);

  const getAttendance = (staffId: number) =>
    todayList.find((a) => a.staff_id === staffId);

  const getTodayShift = (staffId: number) =>
    shifts.find((s) => s.staff_id === staffId && s.date === today);

  const clockInMutation = useMutation({
    mutationFn: clockIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      setConfirm(null);
    },
    onError: (e: any) => {
      alert(e?.response?.data?.detail || '出勤打刻に失敗しました');
      setConfirm(null);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: clockOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      setConfirm(null);
    },
    onError: (e: any) => {
      alert(e?.response?.data?.detail || '退勤打刻に失敗しました');
      setConfirm(null);
    },
  });

  const handleConfirm = () => {
    if (!confirm) return;
    if (confirm.action === 'in') clockInMutation.mutate(confirm.staff.id);
    else clockOutMutation.mutate(confirm.staff.id);
  };

  const handleCardTap = (staff: Staff) => {
    const att = getAttendance(staff.id);
    const status = getStatus(att);
    if (status === 'done') return;
    setConfirm({ staff, action: status === 'before' ? 'in' : 'out' });
  };

  const isPending = clockInMutation.isPending || clockOutMutation.isPending;

  return (
    <div className="min-h-screen bg-gray-950 p-4">
      {/* 時計ヘッダー */}
      <div className="text-center mb-8">
        <p className="text-gray-400 text-lg">
          {format(now, 'yyyy年M月d日（E）', { locale: ja })}
        </p>
        <p className="text-white text-6xl font-bold tracking-widest mt-1">
          {format(now, 'HH:mm:ss')}
        </p>
      </div>

      {/* スタッフカードグリッド */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {activeStaff.map((staff) => {
          const att = getAttendance(staff.id);
          const status = getStatus(att);
          const shift = getTodayShift(staff.id);

          return (
            <button
              key={staff.id}
              onClick={() => handleCardTap(staff)}
              disabled={status === 'done'}
              className={`
                rounded-2xl border-2 p-5 text-left transition-all duration-150
                ${statusColor[status]}
                ${status !== 'done' ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default opacity-60'}
              `}
            >
              {/* アバター */}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0
                  ${status === 'in' ? 'bg-green-600' : 'bg-gray-600'}`}>
                  {staff.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-lg leading-tight">{staff.name}</p>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${badgeColor[status]}`}>
                    {statusLabel[status]}
                  </span>
                </div>
              </div>

              {/* シフト時間 */}
              {shift ? (
                <p className="text-sm text-amber-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {shift.start_time} 〜 {shift.end_time}
                </p>
              ) : (
                <p className="text-sm text-gray-600">シフトなし</p>
              )}

              {/* 打刻時刻 */}
              {status !== 'before' && (
                <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                  {att?.clock_in && (
                    <p className="flex items-center gap-1">
                      <LogIn className="w-3 h-3 text-green-400" />
                      {format(new Date(att.clock_in), 'HH:mm')}
                    </p>
                  )}
                  {att?.clock_out && (
                    <p className="flex items-center gap-1">
                      <LogOut className="w-3 h-3 text-gray-400" />
                      {format(new Date(att.clock_out), 'HH:mm')}
                    </p>
                  )}
                </div>
              )}

              {/* 退勤済みアイコン */}
              {status === 'done' && (
                <CheckCircle className="w-5 h-5 text-gray-500 mt-2" />
              )}
            </button>
          );
        })}
      </div>

      {/* 確認モーダル */}
      {confirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-amber-700 flex items-center justify-center text-4xl font-bold text-white mx-auto mb-4">
              {confirm.staff.name.charAt(0)}
            </div>
            <p className="text-white text-2xl font-bold mb-1">{confirm.staff.name}</p>
            <p className="text-gray-400 mb-6">
              {format(now, 'HH:mm')} に
              <span className={`font-bold ml-1 ${confirm.action === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                {confirm.action === 'in' ? '出勤' : '退勤'}
              </span>
              打刻しますか？
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 py-3 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600 font-medium"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending}
                className={`flex-1 py-3 rounded-xl font-bold text-white disabled:opacity-50
                  ${confirm.action === 'in' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
              >
                {isPending ? '処理中...' : confirm.action === 'in' ? '出勤する' : '退勤する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendancePage;
