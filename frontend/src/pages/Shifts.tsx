// シフト管理ページ（マネージャー用）
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { fetchShifts, createShift, deleteShift } from '../api/shifts';
import { fetchStaff } from '../api/staff';
import type { Staff, Shift } from '../types';

const DAYS = ['月', '火', '水', '木', '金', '土', '日'];

const Shifts: React.FC = () => {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const [modal, setModal] = useState<{ staffId: number; date: string } | null>(null);
  const [form, setForm] = useState({ start_time: '18:00', end_time: '23:00', note: '' });

  const today = new Date();
  const weekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dateFrom = format(weekStart, 'yyyy-MM-dd');
  const dateTo = format(weekDates[6], 'yyyy-MM-dd');

  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['shifts-week', dateFrom, dateTo],
    queryFn: () => fetchShifts(dateFrom, dateTo),
  });

  const activeStaff = staffList.filter((s) => s.is_active);

  const getShift = (staffId: number, date: string) =>
    shifts.find((s) => s.staff_id === staffId && s.date === date);

  const createMutation = useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts-week'] });
      setModal(null);
    },
    onError: (e: any) => alert(e?.response?.data?.detail || 'シフト作成に失敗しました'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteShift,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shifts-week'] }),
  });

  const handleCreate = () => {
    if (!modal) return;
    createMutation.mutate({ staff_id: modal.staffId, date: modal.date, ...form });
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">シフト管理</h2>
        <div className="flex items-center gap-3">
          <button onClick={() => setWeekOffset((o) => o - 1)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-white font-medium min-w-[180px] text-center">
            {format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜
            {format(weekDates[6], 'M月d日', { locale: ja })}
          </span>
          <button onClick={() => setWeekOffset((o) => o + 1)}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => setWeekOffset(0)}
            className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-sm">
            今週
          </button>
        </div>
      </div>

      {/* シフトグリッド */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-gray-400 w-32">スタッフ</th>
              {weekDates.map((d, i) => {
                const isToday = format(d, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                return (
                  <th key={i} className={`px-3 py-3 text-center font-medium
                    ${isToday ? 'text-amber-400' : i >= 5 ? 'text-red-400' : 'text-gray-300'}`}>
                    <div>{DAYS[i]}</div>
                    <div className="text-xs font-normal">{format(d, 'M/d')}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {activeStaff.map((staff) => (
              <tr key={staff.id} className="hover:bg-gray-700/30">
                <td className="px-4 py-3 font-medium text-white">{staff.name}</td>
                {weekDates.map((d) => {
                  const dateStr = format(d, 'yyyy-MM-dd');
                  const shift = getShift(staff.id, dateStr);
                  return (
                    <td key={dateStr} className="px-2 py-2 text-center">
                      {shift ? (
                        <div className="bg-indigo-900/60 border border-indigo-500 rounded-lg px-2 py-1 relative group">
                          <p className="text-indigo-300 text-xs font-medium">
                            {shift.start_time}〜{shift.end_time}
                          </p>
                          {shift.note && <p className="text-gray-500 text-xs truncate">{shift.note}</p>}
                          <button
                            onClick={() => { if (window.confirm('シフトを削除しますか？')) deleteMutation.mutate(shift.id); }}
                            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex w-4 h-4 bg-red-600 rounded-full items-center justify-center">
                            <Trash2 className="w-2.5 h-2.5 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setModal({ staffId: staff.id, date: dateStr }); setForm({ start_time: '18:00', end_time: '23:00', note: '' }); }}
                          className="w-full h-8 rounded-lg border border-dashed border-gray-600 hover:border-indigo-500 hover:bg-indigo-900/20 text-gray-600 hover:text-indigo-400 transition-colors flex items-center justify-center">
                          <Plus className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* シフト作成モーダル */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold text-lg">シフト追加</h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              {activeStaff.find((s) => s.id === modal.staffId)?.name} / {modal.date}
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-gray-400 text-xs mb-1 block">開始</label>
                  <input type="time" value={form.start_time}
                    onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600" />
                </div>
                <div className="flex-1">
                  <label className="text-gray-400 text-xs mb-1 block">終了</label>
                  <input type="time" value={form.end_time}
                    onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600" />
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs mb-1 block">メモ（任意）</label>
                <input type="text" value={form.note} placeholder="例: 早番"
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-600">
                キャンセル
              </button>
              <button onClick={handleCreate} disabled={createMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium disabled:opacity-50">
                {createMutation.isPending ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Shifts;
