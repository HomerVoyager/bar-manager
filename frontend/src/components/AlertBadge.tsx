// バー管理システム - アラートバッジコンポーネント
// ステータスや状態を視覚的に表示するカラーバッジです

import React from 'react';

// バッジのバリアント定義
type BadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'
  | 'occupied'
  | 'empty'
  | 'reserved';

interface AlertBadgeProps {
  // 表示テキスト
  label: string;
  // バッジのスタイルバリアント
  variant?: BadgeVariant;
  // 点滅アニメーション（緊急時用）
  pulse?: boolean;
  // 追加のCSSクラス
  className?: string;
}

// バリアントごとのスタイルマッピング
const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-green-900/50 text-green-400 border border-green-700',
  warning: 'bg-yellow-900/50 text-yellow-400 border border-yellow-700',
  danger: 'bg-red-900/50 text-red-400 border border-red-700',
  info: 'bg-blue-900/50 text-blue-400 border border-blue-700',
  neutral: 'bg-gray-700/50 text-gray-400 border border-gray-600',
  // テーブルステータス用
  occupied: 'bg-red-900/50 text-red-300 border border-red-700',
  empty: 'bg-green-900/50 text-green-300 border border-green-700',
  reserved: 'bg-yellow-900/50 text-yellow-300 border border-yellow-700',
};

const AlertBadge: React.FC<AlertBadgeProps> = ({
  label,
  variant = 'neutral',
  pulse = false,
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${variantStyles[variant]}
        ${pulse ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {/* 在庫アラートなど緊急状態には点を表示 */}
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5" />
      )}
      {label}
    </span>
  );
};

export default AlertBadge;
