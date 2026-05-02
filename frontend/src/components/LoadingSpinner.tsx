// バー管理システム - ローディングスピナーコンポーネント
// データ読み込み中に表示する中央揃えのスピナーです

import React from 'react';

interface LoadingSpinnerProps {
  // スピナーのサイズ（デフォルト: medium）
  size?: 'small' | 'medium' | 'large';
  // テキストメッセージ（省略可）
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'medium', message }) => {
  // サイズに応じたクラス名を決定
  const sizeClasses = {
    small: 'w-6 h-6 border-2',
    medium: 'w-10 h-10 border-3',
    large: 'w-16 h-16 border-4',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      {/* スピナーアニメーション */}
      <div
        className={`${sizeClasses[size]} rounded-full border-gray-600 border-t-amber-400 animate-spin`}
        role="status"
        aria-label="読み込み中"
      />
      {/* オプションのメッセージ */}
      {message && (
        <p className="mt-3 text-gray-400 text-sm">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
