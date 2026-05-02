// バー管理システム - 売上管理ページ
// 日次・月次・年次の売上データを可視化します

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, subMonths, getYear, getMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Download, TrendingUp, Users, DollarSign, AlertTriangle } from 'lucide-react';
import {
  fetchDailySalesReport,
  fetchMonthlySalesReport,
  fetchYearlySalesReport,
  exportSalesCsv,
} from '../api/reports';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';
import type { SalesReport } from '../types';

// 日本円フォーマット
const formatYen = (amount: number): string => `¥${amount.toLocaleString('ja-JP')}`;

// タブの型定義
type TabType = 'daily' | 'monthly' | 'yearly';

const Sales: React.FC = () => {
  // アクティブなタブ状態
  const [activeTab, setActiveTab] = useState<TabType>('daily');
  // 日次: 選択日付
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );
  // 月次: 選択年月
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()) + 1);
  // 年次: 選択年
  const [selectedYearOnly, setSelectedYearOnly] = useState<number>(getYear(new Date()));

  // 日次売上レポートの取得
  const dailyQuery = useQuery<SalesReport>({
    queryKey: ['sales-daily', selectedDate],
    queryFn: () => fetchDailySalesReport(selectedDate),
    enabled: activeTab === 'daily',
  });

  // 月次売上レポートの取得
  const monthlyQuery = useQuery<SalesReport>({
    queryKey: ['sales-monthly', selectedYear, selectedMonth],
    queryFn: () => fetchMonthlySalesReport(selectedYear, selectedMonth),
    enabled: activeTab === 'monthly',
  });

  // 年次売上レポートの取得
  const yearlyQuery = useQuery<SalesReport>({
    queryKey: ['sales-yearly', selectedYearOnly],
    queryFn: () => fetchYearlySalesReport(selectedYearOnly),
    enabled: activeTab === 'yearly',
  });

  // アクティブなクエリの選択
  const activeQuery = activeTab === 'daily' ? dailyQuery : activeTab === 'monthly' ? monthlyQuery : yearlyQuery;
  const report = activeQuery.data;

  // CSVエクスポート処理
  const handleExportCsv = async () => {
    try {
      let blob: Blob;
      if (activeTab === 'daily') {
        blob = await exportSalesCsv({ period: 'daily', date: selectedDate });
      } else if (activeTab === 'monthly') {
        blob = await exportSalesCsv({ period: 'monthly', year: selectedYear, month: selectedMonth });
      } else {
        blob = await exportSalesCsv({ period: 'yearly', year: selectedYearOnly });
      }
      // ダウンロードリンクを生成してクリック
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_${activeTab}_${format(new Date(), 'yyyyMMdd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSVエクスポートに失敗しました:', err);
      alert('CSVのエクスポートに失敗しました。');
    }
  };

  // 過去5年分の年リスト生成
  const yearOptions = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);

  // 月リスト
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // バーチャートのデータキーとラベル
  const chartConfig = {
    daily: { dataKey: 'hour', label: '時間帯別売上', xKey: 'hour', formatter: (v: number) => `${v}時` },
    monthly: { dataKey: 'date', label: '日次売上推移', xKey: 'date', formatter: (v: string) => {
      const d = new Date(v);
      return `${d.getDate()}日`;
    }},
    yearly: { dataKey: 'date', label: '月次売上推移', xKey: 'date', formatter: (v: string) => {
      const d = new Date(v);
      return `${d.getMonth() + 1}月`;
    }},
  };

  // グラフデータの選択
  const getChartData = () => {
    if (!report) return [];
    if (activeTab === 'daily') return report.hourly_data ?? [];
    return report.daily_data ?? [];
  };

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">売上管理</h2>
          <p className="text-gray-400 text-sm mt-1">売上データの分析と可視化</p>
        </div>
        {/* CSVエクスポートボタン */}
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          CSVエクスポート
        </button>
      </div>

      {/* タブ切り替えと期間選択 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* タブボタン */}
          <div className="flex bg-gray-900 rounded-lg p-1">
            {(['daily', 'monthly', 'yearly'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-4 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${activeTab === tab
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-400 hover:text-white'
                  }
                `}
              >
                {tab === 'daily' ? '日次' : tab === 'monthly' ? '月次' : '年次'}
              </button>
            ))}
          </div>

          {/* 日次: 日付ピッカー */}
          {activeTab === 'daily' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          )}

          {/* 月次: 年・月ピッカー */}
          {activeTab === 'monthly' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}年</option>
                ))}
              </select>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
          )}

          {/* 年次: 年ピッカー */}
          {activeTab === 'yearly' && (
            <select
              value={selectedYearOnly}
              onChange={(e) => setSelectedYearOnly(Number(e.target.value))}
              className="px-3 py-1.5 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}年</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* ローディング状態 */}
      {activeQuery.isLoading && <LoadingSpinner message="売上データを読み込み中..." />}

      {/* エラー状態 */}
      {activeQuery.error && (
        <div className="flex items-center gap-3 p-4 bg-red-900/30 border border-red-700 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <p className="text-red-300">データの読み込みに失敗しました</p>
        </div>
      )}

      {/* データ表示 */}
      {report && (
        <>
          {/* サマリーカード */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="合計売上"
              value={formatYen(report.total_sales)}
              icon={<TrendingUp />}
              color="green"
            />
            <StatCard
              title="合計客数"
              value={`${report.total_guests}名`}
              icon={<Users />}
              color="blue"
            />
            <StatCard
              title="客単価"
              value={formatYen(report.avg_per_guest)}
              icon={<DollarSign />}
              color="yellow"
            />
          </div>

          {/* 売上バーチャート */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h3 className="text-white font-semibold mb-4">
              {chartConfig[activeTab].label}
            </h3>
            {getChartData().length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={getChartData()}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey={activeTab === 'daily' ? 'hour' : 'date'}
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={activeTab === 'daily'
                      ? (v: number) => `${v}時`
                      : activeTab === 'monthly'
                        ? (v: string) => { const d = new Date(v); return `${d.getDate()}日`; }
                        : (v: string) => { const d = new Date(v); return `${d.getMonth() + 1}月`; }
                    }
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 12 }}
                    tickLine={false}
                    tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: number) => [formatYen(value), '売上']}
                  />
                  <Bar dataKey="sales" radius={[4, 4, 0, 0]}>
                    {getChartData().map((_, index) => (
                      <Cell key={index} fill="#f59e0b" fillOpacity={0.85} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                この期間のデータがありません
              </div>
            )}
          </div>

          {/* 商品別売上内訳テーブル */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h3 className="text-white font-semibold mb-4">商品別売上内訳</h3>
            {report.product_breakdown && report.product_breakdown.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left text-gray-400 pb-3 font-medium">商品名</th>
                      <th className="text-right text-gray-400 pb-3 font-medium">カテゴリ</th>
                      <th className="text-right text-gray-400 pb-3 font-medium">数量</th>
                      <th className="text-right text-gray-400 pb-3 font-medium">売上金額</th>
                      <th className="text-right text-gray-400 pb-3 font-medium">構成比</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {report.product_breakdown.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-700/30 transition-colors">
                        <td className="py-3 text-white">{item.product_name}</td>
                        <td className="py-3 text-right text-gray-400">{item.category ?? '-'}</td>
                        <td className="py-3 text-right text-gray-300">{item.qty.toLocaleString()}</td>
                        <td className="py-3 text-right text-amber-400 font-medium">
                          {formatYen(item.total)}
                        </td>
                        <td className="py-3 text-right text-gray-400">
                          {report.total_sales > 0
                            ? `${((item.total / report.total_sales) * 100).toFixed(1)}%`
                            : '-'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* 合計行 */}
                  <tfoot>
                    <tr className="border-t-2 border-gray-600">
                      <td className="pt-3 text-white font-semibold" colSpan={3}>合計</td>
                      <td className="pt-3 text-right text-amber-400 font-bold">
                        {formatYen(report.total_sales)}
                      </td>
                      <td className="pt-3 text-right text-gray-400">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                この期間の売上データがありません
              </p>
            )}
          </div>

          {/* 時間帯別分布（日次のみ表示） */}
          {activeTab === 'daily' && report.hourly_data && report.hourly_data.length > 0 && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <h3 className="text-white font-semibold mb-4">時間帯別客数分布</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={report.hourly_data}
                  margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="hour"
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}時`}
                  />
                  <YAxis
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}名`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: number) => [`${value}名`, '客数']}
                    labelFormatter={(label: number) => `${label}時台`}
                  />
                  <Bar dataKey="guests" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Sales;
