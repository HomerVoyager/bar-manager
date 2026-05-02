// バー管理システム - 原価管理ページ
// FLコスト分析と商品別利益率を管理します

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import { getYear, getMonth } from 'date-fns';
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';
import { fetchCostData, fetchProductCostData } from '../api/reports';
import { fetchCategories } from '../api/products';
import LoadingSpinner from '../components/LoadingSpinner';
import AlertBadge from '../components/AlertBadge';
import type { CostData } from '../types';

// 日本円フォーマット
const formatYen = (amount: number): string => `¥${amount.toLocaleString('ja-JP')}`;

// 利益率に基づいたカラー判定
const getMarginColor = (margin: number): string => {
  if (margin >= 60) return 'text-green-400';
  if (margin >= 40) return 'text-yellow-400';
  return 'text-red-400';
};

const getMarginBg = (margin: number): string => {
  if (margin >= 60) return 'bg-green-900/30 border-green-800';
  if (margin >= 40) return 'bg-yellow-900/30 border-yellow-800';
  return 'bg-red-900/30 border-red-800';
};

// 商品原価データの型
interface ProductCostItem {
  id: number;
  name: string;
  price: number;
  cost: number;
  margin: number;
  margin_rate: number;
  category?: string;
}

const Cost: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<number>(getYear(new Date()));
  const [selectedMonth, setSelectedMonth] = useState<number>(getMonth(new Date()) + 1);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // FLコストデータの取得
  const { data: costData, isLoading: costLoading } = useQuery<CostData>({
    queryKey: ['cost', selectedYear, selectedMonth],
    queryFn: () => fetchCostData(selectedYear, selectedMonth),
  });

  // 商品別原価データの取得
  const { data: productCosts, isLoading: productsLoading } = useQuery<ProductCostItem[]>({
    queryKey: ['product-costs'],
    queryFn: fetchProductCostData,
  });

  // カテゴリ一覧の取得
  const { data: categories } = useQuery<string[]>({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  // カテゴリフィルタの適用
  const filteredProducts = productCosts?.filter((p) =>
    selectedCategory === 'all' || p.category === selectedCategory
  ) ?? [];

  // 利益率の高い順・低い順でソート
  const topProducts = [...filteredProducts].sort((a, b) => b.margin_rate - a.margin_rate).slice(0, 5);
  const bottomProducts = [...filteredProducts].sort((a, b) => a.margin_rate - b.margin_rate).slice(0, 5);

  // FLコスト円グラフデータ
  const flChartData = costData
    ? [
        { name: '食材費(F)', value: costData.food_cost_rate, fill: '#f59e0b' },
        { name: '人件費(L)', value: costData.labor_cost_rate, fill: '#6366f1' },
        { name: 'その他', value: Math.max(0, 100 - costData.fl_cost_rate), fill: '#374151' },
      ]
    : [];

  // FLコストの業界ベンチマーク評価
  const getFLAssessment = (rate: number) => {
    if (rate < 50) return { label: '優秀', color: 'text-green-400', bg: 'bg-green-900/30 border-green-700' };
    if (rate <= 60) return { label: '良好（業界基準内）', color: 'text-amber-400', bg: 'bg-amber-900/30 border-amber-700' };
    if (rate <= 70) return { label: '要改善', color: 'text-yellow-400', bg: 'bg-yellow-900/30 border-yellow-700' };
    return { label: '危険水準', color: 'text-red-400', bg: 'bg-red-900/30 border-red-700' };
  };

  const yearOptions = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
  const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* ページヘッダー */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">原価管理</h2>
          <p className="text-gray-400 text-sm mt-1">FLコスト分析と商品別利益率の管理</p>
        </div>
        {/* 期間選択 */}
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-gray-800 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="px-3 py-1.5 bg-gray-800 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            {monthOptions.map((m) => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
      </div>

      {/* FLコスト分析セクション */}
      {costLoading ? (
        <LoadingSpinner message="コストデータを読み込み中..." />
      ) : costData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FLコスト円グラフ */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              FLコスト構成
            </h3>
            {/* 業界ベンチマーク注釈 */}
            <p className="text-gray-500 text-xs mb-4">
              業界基準: FL比率 55〜60% が理想的とされています
            </p>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={flChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {flChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* コスト内訳 */}
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">食材費率 (F)</span>
                    <span className="text-amber-400 font-semibold">{costData.food_cost_rate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, costData.food_cost_rate)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">人件費率 (L)</span>
                    <span className="text-indigo-400 font-semibold">{costData.labor_cost_rate.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-indigo-500 h-2 rounded-full"
                      style={{ width: `${Math.min(100, costData.labor_cost_rate)}%` }}
                    />
                  </div>
                </div>
                <div className="pt-2 border-t border-gray-700">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300 font-medium">FL合計</span>
                    <span className={`font-bold ${getFLAssessment(costData.fl_cost_rate).color}`}>
                      {costData.fl_cost_rate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FL評価バッジ */}
            <div className={`mt-4 p-3 rounded-lg border ${getFLAssessment(costData.fl_cost_rate).bg}`}>
              <div className="flex items-center gap-2">
                {costData.fl_cost_rate > 60
                  ? <AlertTriangle className="w-4 h-4 text-yellow-400" />
                  : <TrendingDown className="w-4 h-4 text-green-400" />
                }
                <span className={`text-sm font-medium ${getFLAssessment(costData.fl_cost_rate).color}`}>
                  評価: {getFLAssessment(costData.fl_cost_rate).label}
                </span>
              </div>
            </div>
          </div>

          {/* コストサマリー */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              月次コストサマリー
            </h3>
            <div className="space-y-4">
              {[
                { label: '総売上', value: formatYen(costData.total_sales), color: 'text-green-400' },
                { label: '食材費合計', value: formatYen(costData.total_cost), color: 'text-amber-400' },
                { label: '人件費合計', value: formatYen(costData.total_labor), color: 'text-indigo-400' },
                {
                  label: '粗利益',
                  value: formatYen(costData.total_sales - costData.total_cost - costData.total_labor),
                  color: 'text-white',
                },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
                  <span className="text-gray-400 text-sm">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* 商品別利益率テーブル */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h3 className="text-white font-semibold">商品別利益率</h3>
          {/* カテゴリフィルター */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">カテゴリ:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 bg-gray-900 border border-gray-600 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">すべて</option>
              {categories?.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* カラーコード説明 */}
        <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            利益率 60%以上（優秀）
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
            利益率 40〜60%（普通）
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
            利益率 40%未満（要改善）
          </span>
        </div>

        {productsLoading ? (
          <LoadingSpinner message="商品データを読み込み中..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 pb-3 font-medium">商品名</th>
                  <th className="text-left text-gray-400 pb-3 font-medium">カテゴリ</th>
                  <th className="text-right text-gray-400 pb-3 font-medium">販売価格</th>
                  <th className="text-right text-gray-400 pb-3 font-medium">原価</th>
                  <th className="text-right text-gray-400 pb-3 font-medium">粗利益</th>
                  <th className="text-right text-gray-400 pb-3 font-medium">利益率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className={`hover:bg-gray-700/30 transition-colors ${getMarginBg(product.margin_rate)} rounded`}
                  >
                    <td className="py-3 text-white font-medium">{product.name}</td>
                    <td className="py-3 text-gray-400">{product.category ?? '-'}</td>
                    <td className="py-3 text-right text-gray-300">{formatYen(product.price)}</td>
                    <td className="py-3 text-right text-gray-400">{formatYen(product.cost)}</td>
                    <td className="py-3 text-right text-gray-300">{formatYen(product.margin)}</td>
                    <td className={`py-3 text-right font-bold ${getMarginColor(product.margin_rate)}`}>
                      {product.margin_rate.toFixed(1)}%
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-gray-500">
                      データがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* トップ/ボトム5 */}
      {filteredProducts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 利益率上位5商品 */}
          <div className="bg-gray-800 rounded-xl border border-green-900 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              利益率上位5商品
            </h3>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-900/50 border border-green-700 flex items-center justify-center text-xs text-green-400 font-bold flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-white text-sm flex-1 truncate">{product.name}</span>
                  <span className="text-green-400 font-semibold text-sm">
                    {product.margin_rate.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 利益率下位5商品 */}
          <div className="bg-gray-800 rounded-xl border border-red-900 p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-400" />
              利益率下位5商品（要改善）
            </h3>
            <div className="space-y-3">
              {bottomProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-red-900/50 border border-red-700 flex items-center justify-center text-xs text-red-400 font-bold flex-shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-white text-sm flex-1 truncate">{product.name}</span>
                  <AlertBadge
                    label={`${product.margin_rate.toFixed(1)}%`}
                    variant={product.margin_rate >= 40 ? 'warning' : 'danger'}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cost;
