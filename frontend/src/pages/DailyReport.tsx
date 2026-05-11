// 日次レポートページ
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { TrendingUp, Users, BarChart2, DollarSign, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';

const yen = (n: number) => `¥${n.toLocaleString('ja-JP')}`;
const hm = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}m`;

interface DailyData {
  period: string;
  total_sales: number;
  total_guests: number;
  avg_per_guest: number;
  labor_cost: number;
  product_breakdown: { product_name: string; category?: string; qty: number; total: number }[];
  hourly_data: { hour: number; sales: number; guests: number }[];
  on_duty: { staff_name: string; clock_in?: string; clock_out?: string; work_minutes: number; wage: number }[];
}

const fetchDailyReport = async (date: string): Promise<DailyData> => {
  const res = await apiClient.get('/reports/sales/daily', { params: { date } });
  return res.data;
};

const DailyReport: React.FC = () => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['daily-report', date],
    queryFn: () => fetchDailyReport(date),
  });

  const changeDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    setDate(format(d, 'yyyy-MM-dd'));
  };

  const maxHourlySales = data ? Math.max(...data.hourly_data.map((h) => h.sales), 1) : 1;
  const flRate = data && data.total_sales > 0
    ? ((data.labor_cost / data.total_sales) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">日次レポート</h2>
          <p className="text-gray-400 text-sm mt-1">1日の売上・勤務状況サマリー</p>
        </div>
        {/* 日付ナビ */}
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={() => changeDate(1)} className="p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => setDate(format(new Date(), 'yyyy-MM-dd'))} className="px-3 py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors">
            今日
          </button>
        </div>
      </div>

      <p className="text-gray-400 text-sm">
        {format(new Date(date + 'T00:00:00'), 'yyyy年M月d日（E）', { locale: ja })}
      </p>

      {isLoading ? (
        <div className="text-gray-400 text-center py-16">読み込み中...</div>
      ) : !data ? (
        <div className="text-gray-500 text-center py-16">データがありません</div>
      ) : (
        <>
          {/* KPIカード */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: TrendingUp, label: '売上合計', value: yen(data.total_sales), color: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-800' },
              { icon: Users, label: '来客数', value: `${data.total_guests}名`, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800' },
              { icon: BarChart2, label: '客単価', value: yen(data.avg_per_guest), color: 'text-indigo-400', bg: 'bg-indigo-900/20 border-indigo-800' },
              { icon: DollarSign, label: '人件費 (L率)', value: `${yen(data.labor_cost)} (${flRate}%)`, color: Number(flRate) > 40 ? 'text-red-400' : 'text-blue-400', bg: 'bg-blue-900/20 border-blue-800' },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className={`rounded-xl border p-4 ${bg}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-gray-400 text-xs">{label}</span>
                </div>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 商品別売上TOP10 */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-white font-semibold text-sm mb-4">商品別売上</h3>
              {data.product_breakdown.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-6">売上なし</p>
              ) : (
                <div className="space-y-2.5">
                  {data.product_breakdown.slice(0, 10).map((p, i) => (
                    <div key={p.product_name} className="flex items-center gap-3">
                      <span className="text-gray-600 text-xs w-4 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-gray-300 text-xs truncate">{p.product_name}</span>
                          <span className="text-amber-400 text-xs font-medium ml-2 flex-shrink-0">{yen(p.total)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-700 rounded-full">
                          <div
                            className="h-1.5 bg-amber-500 rounded-full"
                            style={{ width: `${(p.total / (data.product_breakdown[0]?.total || 1)) * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-gray-500 text-xs w-8 text-right">{p.qty}杯</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 時間帯別売上 */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-white font-semibold text-sm mb-4">時間帯別売上</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {data.hourly_data.filter((h) => h.sales > 0 || (h.hour >= 18 && h.hour <= 5)).map((h) => (
                  <div key={h.hour} className="flex items-center gap-2">
                    <span className="text-gray-500 text-xs w-12 text-right">{String(h.hour).padStart(2, '0')}:00</span>
                    <div className="flex-1 h-4 bg-gray-700 rounded">
                      <div
                        className={`h-4 rounded ${h.sales > 0 ? 'bg-indigo-600' : ''}`}
                        style={{ width: `${(h.sales / maxHourlySales) * 100}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs w-20 text-right">{h.sales > 0 ? yen(h.sales) : '-'}</span>
                    {h.guests > 0 && <span className="text-gray-600 text-xs w-10 text-right">{h.guests}名</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 出勤スタッフ */}
          {data.on_duty.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" /> 当日勤務スタッフ
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-gray-700">
                      <th className="pb-2 text-left">名前</th>
                      <th className="pb-2 text-center">出勤</th>
                      <th className="pb-2 text-center">退勤</th>
                      <th className="pb-2 text-right">勤務時間</th>
                      <th className="pb-2 text-right">人件費</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {data.on_duty.map((s, i) => (
                      <tr key={i} className="text-gray-300">
                        <td className="py-2 font-medium text-white">{s.staff_name}</td>
                        <td className="py-2 text-center text-sm">{s.clock_in ?? '-'}</td>
                        <td className="py-2 text-center text-sm">{s.clock_out ?? '-'}</td>
                        <td className="py-2 text-right text-sm">{s.work_minutes > 0 ? hm(s.work_minutes) : '-'}</td>
                        <td className="py-2 text-right text-amber-400 font-medium">{s.wage > 0 ? yen(s.wage) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="text-gray-400 text-xs border-t border-gray-700 font-semibold">
                      <td colSpan={4} className="pt-2">合計</td>
                      <td className="pt-2 text-right text-amber-400">{yen(data.labor_cost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DailyReport;
