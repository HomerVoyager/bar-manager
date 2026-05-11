// 給与内訳ページ
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Printer } from 'lucide-react';
import { fetchMonthlyDetail } from '../api/attendance';
import { fetchStaff } from '../api/staff';
import type { Staff } from '../types';

const minutesToHM = (m?: number) => {
  if (!m) return '-';
  return `${Math.floor(m / 60)}時間${String(m % 60).padStart(2, '0')}分`;
};
const yen = (n?: number) => (n != null ? `¥${n.toLocaleString('ja-JP')}` : '-');
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'];

const Payslip: React.FC = () => {
  const { staffId, year, month } = useParams<{ staffId: string; year: string; month: string }>();
  const navigate = useNavigate();

  const sid = Number(staffId);
  const y = Number(year);
  const m = Number(month);

  const { data: detail, isLoading, isError } = useQuery({
    queryKey: ['attendance-person', sid, y, m],
    queryFn: () => fetchMonthlyDetail(sid, y, m),
    enabled: !!sid && !!y && !!m,
  });

  const { data: staffList = [] } = useQuery<Staff[]>({
    queryKey: ['staff'],
    queryFn: fetchStaff,
  });
  const staff = staffList.find((s) => s.id === sid);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-gray-400">読み込み中...</div>;
  if (isError || !detail) return <div className="flex items-center justify-center h-64 text-red-400">データが取得できませんでした</div>;

  const overtimeMinutes = (detail as any).total_overtime_minutes ?? 0;
  const hourlyWage = (detail as any).hourly_wage ?? staff?.hourly_wage ?? 0;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* 操作バー */}
      <div className="flex items-center justify-between print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <ChevronLeft className="w-4 h-4" /> 戻る
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg text-sm"
        >
          <Printer className="w-4 h-4" /> 印刷
        </button>
      </div>

      {/* 明細書 */}
      <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden print:border-0 print:shadow-none">
        {/* ヘッダー */}
        <div className="bg-gray-900 px-8 py-6 text-center border-b border-gray-700">
          <p className="text-gray-400 text-sm">{y}年{m}月分</p>
          <h1 className="text-white text-2xl font-bold mt-1">給与明細書</h1>
          <p className="text-amber-400 text-lg font-semibold mt-2">{detail.staff_name}</p>
        </div>

        {/* サマリーカード */}
        <div className="grid grid-cols-4 divide-x divide-gray-700 border-b border-gray-700">
          {[
            { label: '出勤日数', value: `${detail.work_days}日` },
            { label: '総勤務時間', value: minutesToHM(detail.total_work_minutes) },
            { label: '深夜時間', value: minutesToHM(detail.total_night_minutes) },
            { label: '時給', value: yen(hourlyWage) },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-4 text-center">
              <p className="text-gray-400 text-xs mb-1">{label}</p>
              <p className="text-white font-semibold text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* 給与内訳 */}
        <div className="px-8 py-6 space-y-3">
          <h2 className="text-gray-300 text-sm font-semibold mb-4">支給内訳</h2>
          {[
            { label: '基本給', value: (detail as any).base_pay, color: 'text-white' },
            { label: '深夜割増手当', value: (detail as any).night_premium, color: 'text-blue-400' },
            { label: '残業割増手当', value: (detail as any).overtime_premium, color: 'text-orange-400' },
            { label: 'ドリンクバック', value: detail.drink_back_total, color: 'text-indigo-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-gray-700/50">
              <span className="text-gray-400 text-sm">{label}</span>
              <span className={`font-medium text-sm ${color}`}>{yen(value)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between py-3 bg-amber-900/20 rounded-xl px-4 mt-4">
            <span className="text-amber-300 font-bold">支給合計</span>
            <span className="text-amber-400 text-xl font-bold">{yen(detail.total_wage)}</span>
          </div>
        </div>

        {/* 勤務詳細 */}
        <div className="px-8 pb-6">
          <h2 className="text-gray-300 text-sm font-semibold mb-3">日別勤務明細</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-700">
            <table className="w-full text-xs">
              <thead className="bg-gray-700/60 text-gray-400">
                <tr>
                  {['日', '曜', '出勤', '退勤', '休憩', '勤務時間', '深夜', '残業', 'バック', '日給'].map((h) => (
                    <th key={h} className="px-2 py-2 text-center whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {(detail.daily_details || []).map((d: any) => {
                  const dt = new Date(d.date + 'T00:00:00');
                  const dow = dt.getDay();
                  const dowLabel = DAY_LABELS[dow === 0 ? 6 : dow - 1];
                  const isSun = dow === 0, isSat = dow === 6;
                  return (
                    <tr key={d.date} className={isSun ? 'bg-red-900/10' : isSat ? 'bg-blue-900/10' : ''}>
                      <td className="px-2 py-1.5 text-center text-gray-300">{dt.getDate()}</td>
                      <td className={`px-2 py-1.5 text-center font-medium ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-500'}`}>{dowLabel}</td>
                      <td className="px-2 py-1.5 text-center text-gray-300">{d.clock_in ?? '-'}</td>
                      <td className="px-2 py-1.5 text-center text-gray-300">{d.clock_out ?? '-'}</td>
                      <td className="px-2 py-1.5 text-center text-gray-500">{d.break_minutes > 0 ? `${d.break_minutes}分` : '-'}</td>
                      <td className="px-2 py-1.5 text-center text-white font-medium">{minutesToHM(d.work_minutes)}</td>
                      <td className="px-2 py-1.5 text-center text-blue-400">{d.night_minutes > 0 ? minutesToHM(d.night_minutes) : '-'}</td>
                      <td className="px-2 py-1.5 text-center text-orange-400">{d.overtime_minutes > 0 ? minutesToHM(d.overtime_minutes) : '-'}</td>
                      <td className="px-2 py-1.5 text-center text-indigo-400">{d.drink_back > 0 ? yen(d.drink_back) : '-'}</td>
                      <td className="px-2 py-1.5 text-center text-amber-400 font-semibold">{yen(d.daily_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-700/60 text-gray-300 font-semibold">
                <tr>
                  <td colSpan={5} className="px-2 py-2 text-center text-xs">合計</td>
                  <td className="px-2 py-2 text-center text-xs">{minutesToHM(detail.total_work_minutes)}</td>
                  <td className="px-2 py-2 text-center text-xs text-blue-400">{minutesToHM(detail.total_night_minutes)}</td>
                  <td className="px-2 py-2 text-center text-xs text-orange-400">{minutesToHM(overtimeMinutes)}</td>
                  <td className="px-2 py-2 text-center text-xs text-indigo-400">{yen(detail.drink_back_total)}</td>
                  <td className="px-2 py-2 text-center text-xs text-amber-400">{yen(detail.total_wage)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payslip;
