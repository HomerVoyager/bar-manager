// バー管理システム - レイアウトコンポーネント
// サイドバーナビゲーションとトップヘッダーを含むメインレイアウト

import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Bell } from 'lucide-react';
import Sidebar from './Sidebar';
import type { Staff } from '../types';

interface LayoutProps {
  // 現在ログイン中のユーザー
  currentUser: Staff | null;
  // ログアウトコールバック
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ currentUser, onLogout }) => {
  // サイドバーの折りたたみ状態管理
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    if (window.confirm('ログアウトしますか？')) {
      onLogout();
      navigate('/login');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* サイドバーナビゲーション */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((prev) => !prev)}
        currentUser={currentUser}
      />

      {/* メインコンテンツエリア */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* トップヘッダー */}
        <header className="h-16 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
          {/* 店舗名 */}
          <div className="flex items-center gap-3">
            <h1 className="text-white font-semibold text-lg tracking-wide">
              バー管理システム
            </h1>
            {/* 営業状態バッジ */}
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-900/50 border border-green-700 text-green-400 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              営業中
            </span>
          </div>

          {/* 右側: ユーザー情報とアクション */}
          <div className="flex items-center gap-4">
            {/* 通知ベルアイコン（将来の拡張用） */}
            <button className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
              <Bell className="w-5 h-5" />
            </button>

            {/* ログインユーザー情報 */}
            {currentUser && (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-white text-sm font-medium">{currentUser.name}</p>
                  <p className="text-gray-400 text-xs">
                    {currentUser.role === 'manager' ? 'マネージャー' : 'スタッフ'}
                  </p>
                </div>
                {/* アバター */}
                <div className="w-9 h-9 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-sm font-semibold">
                    {currentUser.name.charAt(0)}
                  </span>
                </div>
              </div>
            )}

            {/* ログアウトボタン */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
              title="ログアウト"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm hidden md:inline">ログアウト</span>
            </button>
          </div>
        </header>

        {/* ページコンテンツ */}
        <main className="flex-1 overflow-auto p-6 bg-gray-950">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
