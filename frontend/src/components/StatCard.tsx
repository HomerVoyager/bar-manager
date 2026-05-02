// バー管理システム - 統計カードコンポーネント
// ダッシュボードのKPI指標を表示するカードです

import React from 'react';

// カードのカラーテーマ
type CardColor = 'blue' | 'green' | 'yellow' | 'red';

interface StatCardProps {
  // カードのタイトル
  title: string;
  // 表示する値
  value: string | number;
  // アイコン（lucide-reactコンポーネント等）
  icon: React.ReactNode;
  // 前期比較テキスト（例: "+12% vs先月"）
  change?: string;
  // カラーテーマ
  color?: CardColor;
}

// カラーテーマごとのスタイル設定
const colorStyles: Record<CardColor, {
  border: string;
  iconBg: string;
  iconText: string;
  changePositive: string;
  changeNegative: string;
}> = {
  blue: {
    border: 'border-blue-800',
    iconBg: 'bg-blue-900/50',
    iconText: 'text-blue-400',
    changePositive: 'text-green-400',
    changeNegative: 'text-red-400',
  },
  green: {
    border: 'border-green-800',
    iconBg: 'bg-green-900/50',
    iconText: 'text-green-400',
    changePositive: 'text-green-400',
    changeNegative: 'text-red-400',
  },
  yellow: {
    border: 'border-amber-800',
    iconBg: 'bg-amber-900/50',
    iconText: 'text-amber-400',
    changePositive: 'text-green-400',
    changeNegative: 'text-red-400',
  },
  red: {
    border: 'border-red-800',
    iconBg: 'bg-red-900/50',
    iconText: 'text-red-400',
    changePositive: 'text-green-400',
    changeNegative: 'text-red-400',
  },
};

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  change,
  color = 'blue',
}) => {
  const styles = colorStyles[color];

  // 変化率の正負を判定（+ で始まる場合はポジティブ）
  const isPositiveChange = change?.startsWith('+');
  const isNegativeChange = change?.startsWith('-');
  const changeTextColor = isPositiveChange
    ? styles.changePositive
    : isNegativeChange
      ? styles.changeNegative
      : 'text-gray-400';

  return (
    <div className={`bg-gray-800 rounded-xl border ${styles.border} p-5 flex flex-col gap-3 hover:bg-gray-750 transition-colors`}>
      {/* カードヘッダー: アイコンとタイトル */}
      <div className="flex items-center justify-between">
        <span className="text-gray-400 text-sm font-medium">{title}</span>
        <div className={`p-2 rounded-lg ${styles.iconBg}`}>
          <span className={`${styles.iconText} [&>svg]:w-5 [&>svg]:h-5`}>
            {icon}
          </span>
        </div>
      </div>

      {/* メイン値の表示 */}
      <div className="flex flex-col gap-1">
        <span className="text-2xl font-bold text-white">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </span>
        {/* 変化率の表示 */}
        {change && (
          <span className={`text-xs ${changeTextColor}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
