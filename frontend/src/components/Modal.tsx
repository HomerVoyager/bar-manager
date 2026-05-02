// バー管理システム - モーダルコンポーネント
// 汎用モーダルダイアログ。バックドロップクリックとEscキーで閉じます

import React, { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  // モーダルのタイトル
  title: string;
  // モーダル内のコンテンツ
  children: React.ReactNode;
  // 閉じるコールバック
  onClose: () => void;
  // モーダルの幅サイズ
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  // フッターコンテンツ（ボタン類）
  footer?: React.ReactNode;
}

// サイズごとの最大幅クラス
const sizeClasses = {
  small: 'max-w-sm',
  medium: 'max-w-md',
  large: 'max-w-2xl',
  xlarge: 'max-w-4xl',
};

const Modal: React.FC<ModalProps> = ({
  title,
  children,
  onClose,
  size = 'medium',
  footer,
}) => {
  // Escキーで閉じる処理
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    // イベントリスナーを追加
    document.addEventListener('keydown', handleKeyDown);
    // スクロールを防止
    document.body.style.overflow = 'hidden';

    return () => {
      // クリーンアップ
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // バックドロップクリックで閉じる
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    // バックドロップ（半透明の背景）
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* モーダルコンテナ */}
      <div
        className={`
          ${sizeClasses[size]} w-full
          bg-gray-800 border border-gray-700 rounded-xl shadow-2xl
          flex flex-col max-h-[90vh]
          animate-in fade-in zoom-in-95 duration-200
        `}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2
            id="modal-title"
            className="text-lg font-semibold text-white"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            aria-label="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* モーダルボディ（スクロール可能） */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* オプションフッター */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
