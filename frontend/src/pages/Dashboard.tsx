// バー管理システム - ダッシュボードページ
// 売上・客数・卓状況・在庫アラートをリアルタイムで表示します

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Users,
  Layout,
  AlertTriangle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { fetchDashboard } from '../api/dashboard';
import StatCard from '../components/StatCard';
import AlertBadge from '../components/AlertBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { useWebSocket } from '../hooks/useWebSocket';
import type { Table, DashboardData } from '../types';

// 日本円フォーマット
const formatYen = (amount: number): string =>
  `¥${amount.toLocaleString('ja-JP')}`;

// テーブルステータスの色マッピング
const tableStatusConfig = {
  empty: { bg: 'bg-green-900/40', border: 'border-green-700', text: 'text-green-400', label: '空き' },
  occupied: { bg: 'bg-red-900/40', border: 'border-red-700', text: 'text-red-300', label: '使用中' },
  reserved: { bg: 'bg-yellow-900/40', border: 'border-yellow-700', text: 'text-yellow-300', label: '予約中' },
};

const Dashboard: React.FC = () => {
  // WebSocketからのリアルタイムテーブル更新
  const { lastMessage, isConnected } = useWebSocket();
  // ローカルのテーブルステータス（WebSocketで上書き）
  const [tableStatus, setTableStatus] = useState<Table[]>([]);

  // ダッシュボードデータの取得（30秒ごとに自動更新）
  const {
    data: dashboard,
    isLoading,
    error,
    refetch,
    dataUpdatedAt,
  } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 30000, // 30秒ごとに更新
    staleTime: 15000,
  });

  // ダッシュボードデータが更新されたらテーブルステータスを同期
  useEffect(() => {
    if (dashboard?.table_status) {
      setTableStatus(dashboard.table_status);
    }
  }, [dashboard]);

  // WebSocketからテーブル更新を受信
  useEffect(() => {
    if (lastMessage?.type === 'table_update' && Array.isArray(lastMessage.data)) {
      setTableStatus(lastMessage.data as Table[]);
    }
  }, [lastMessage]);

  if (isLoading) {
    return <LoadingSpinner size="large" message="ダッシュボードを読み込み中..." />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-400">データの読み込みに失敗しました</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
        >
          再試行
        </button>
      </div>
    );
  }

  const stats = dashboard!;

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">ダッシュボード</h2>
          <p className="text-gray-400 text-sm mt-1">
            {format(new Date(), 'yyyy年M月d日 (EEEE)', { locale: ja })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* WebSocket接続状態 */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}
            />
            {isConnected ? 'リアルタイム接続中' : '接続中断'}
          </div>
          {/* 最終更新時刻 */}
          {dataUpdatedAt > 0 && (
            <span className="text-xs text-gray-500">
              最終更新: {format(new Date(dataUpdatedAt), 'HH:mm:ss')}
            </span>
          )}
          {/* 手動更新ボタン */}
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="データを更新"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPIカード群 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="本日売上"
          value={formatYen(stats.today_sales)}
          icon={<TrendingUp />}
          color="green"
        />
        <StatCard
          title="本日客数"
          value={`${stats.today_guests}名`}
          icon={<Users />}
          color="blue"
        />
        <StatCard
          title="営業中卓数"
          value={`${stats.active_sessions}卓`}
          icon={<Layout />}
          color="yellow"
        />
        <StatCard
          title="在庫アラート"
          value={`${stats.low_stock_alerts?.length ?? 0}件`}
          icon={<AlertTriangle />}
          color={stats.low_stock_alerts?.length > 0 ? 'red' : 'blue'}
        />
      </div>

      {/* メインコンテンツ: グラフと詳細情報 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* 月次売上比較グラフ（2/3幅） */}
        <div className="xl:col-span-2 bg-gray-800 rounded-xl border border-gray-700 p-5">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            月次売上比較（今月 vs 先月）
          </h3>
          {stats.monthly_comparison && stats.monthly_comparison.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={stats.monthly_comparison}
                margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickLine={false}
                  interval={4}
                  tickFormatter={(value: string) => `${value}日`}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  tickLine={false}
                  tickFormatter={(value: number) => `¥${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                  formatter={(value: number) => [formatYen(value), '']}
                  labelFormatter={(label: string) => `${label}日`}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-gray-300 text-sm">{value}</span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="this_month"
                  name="今月"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#f59e0b' }}
                />
                <Line
                  type="monotone"
                  dataKey="last_month"
                  name="先月"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={false}
                  activeDot={{ r: 4, fill: '#6b7280' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              データがありません
            </div>
          )}
        </div>

        {/* 右サイドパネル（1/3幅） */}
        <div className="space-y-4">
          {/* 出勤中スタッフ */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              出勤中スタッフ
              <span className="ml-auto text-amber-400 font-bold">
                {stats.on_duty_staff?.length ?? 0}名
              </span>
            </h3>
            {stats.on_duty_staff && stats.on_duty_staff.length > 0 ? (
              <ul className="space-y-2">
                {stats.on_duty_staff.map((staff) => (
                  <li
                    key={staff.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-medium">
                        {staff.name.charAt(0)}
                      </span>
                    </div>
                    <span className="text-gray-300 truncate">{staff.name}</span>
                    <AlertBadge
                      label={staff.role === 'manager' ? 'MGR' : 'STF'}
                      variant={staff.role === 'manager' ? 'info' : 'neutral'}
                      className="ml-auto"
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">出勤中のスタッフはいません</p>
            )}
          </div>

          {/* 在庫アラート */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <h3 className="text-white font-semibold mb-3 flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              在庫アラート
              {stats.low_stock_alerts?.length > 0 && (
                <span className="ml-auto bg-red-900/50 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-700">
                  {stats.low_stock_alerts.length}件
                </span>
              )}
            </h3>
            {stats.low_stock_alerts && stats.low_stock_alerts.length > 0 ? (
              <ul className="space-y-2">
                {stats.low_stock_alerts.slice(0, 5).map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-gray-300 truncate flex-1 mr-2">
                      {product.name}
                    </span>
                    <div className="flex items-center gap-1 text-right flex-shrink-0">
                      <span className={product.stock_qty === 0 ? 'text-red-400 font-medium' : 'text-yellow-400'}>
                        {product.stock_qty}
                      </span>
                      <span className="text-gray-600">/</span>
                      <span className="text-gray-500">{product.alert_qty}</span>
                      <span className="text-gray-600">{product.unit ?? '個'}</span>
                    </div>
                  </li>
                ))}
                {stats.low_stock_alerts.length > 5 && (
                  <p className="text-gray-500 text-xs text-center mt-1">
                    他 {stats.low_stock_alerts.length - 5}件
                  </p>
                )}
              </ul>
            ) : (
              <p className="text-gray-500 text-sm">在庫アラートはありません</p>
            )}
          </div>
        </div>
      </div>

      {/* テーブル状況グリッド */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
          <Layout className="w-4 h-4 text-amber-400" />
          卓状況
        </h3>
        {tableStatus && tableStatus.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {tableStatus.map((table) => {
              const config = tableStatusConfig[table.status];
              return (
                <div
                  key={table.id}
                  className={`
                    ${config.bg} border ${config.border}
                    rounded-lg p-3 flex flex-col items-center gap-1
                  `}
                >
                  <span className="text-white font-medium text-sm">{table.name}</span>
                  <span className={`text-xs ${config.text}`}>{config.label}</span>
                  {table.current_session && (
                    <span className="text-gray-400 text-xs">
                      {table.current_session.guest_count}名
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">テーブル情報がありません</p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
