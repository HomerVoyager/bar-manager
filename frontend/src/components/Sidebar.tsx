// バー管理システム - サイドバーナビゲーションコンポーネント
// アイコン付きのナビゲーションメニューを提供します
// 折りたたみ機能付き

import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  TrendingUp,
  Package,
  DollarSign,
  Clock,
  CalendarDays,
  ClipboardList,
  Grid,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Staff } from '../types';

interface SidebarProps {
  // サイドバーの折りたたみ状態
  isCollapsed: boolean;
  // 折りたたみ切り替えコールバック
  onToggle: () => void;
  // 現在ログイン中のユーザー
  currentUser: Staff | null;
}

// ナビゲーションアイテム（minRole: 'staff'=全員, 'manager'=manager以上, 'master'=masterのみ）
const navItems = [
  { to: '/dashboard',         icon: LayoutDashboard, label: 'ダッシュボード', minRole: 'staff'   },
  { to: '/sales',             icon: TrendingUp,      label: '売上管理',       minRole: 'master'  },
  { to: '/inventory',         icon: Package,         label: '在庫管理',       minRole: 'manager' },
  { to: '/cost',              icon: DollarSign,      label: '原価管理',       minRole: 'master'  },
  { to: '/attendance',        icon: Clock,           label: '打刻',           minRole: 'staff'   },
  { to: '/attendance/manage', icon: ClipboardList,   label: '勤怠管理',       minRole: 'manager' },
  { to: '/shifts',            icon: CalendarDays,    label: 'シフト管理',     minRole: 'manager' },
  { to: '/tables',            icon: Grid,            label: '卓管理',         minRole: 'staff'   },
  { to: '/staff',             icon: Users,           label: 'スタッフ管理',   minRole: 'master'  },
] as const;

const ROLE_LEVEL: Record<string, number> = { master: 3, manager: 2, staff: 1 };

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggle, currentUser }) => {
  const userLevel = ROLE_LEVEL[currentUser?.role ?? 'staff'] ?? 1;

  return (
    <aside
      className={`
        ${isCollapsed ? 'w-16' : 'w-60'}
        bg-gray-900 border-r border-gray-700
        flex flex-col
        transition-width duration-300 ease-in-out
        min-h-screen
        relative
      `}
    >
      {/* バーのロゴとタイトル */}
      <div className="flex items-center px-4 py-5 border-b border-gray-700 min-h-[65px]">
        <span className="text-2xl flex-shrink-0" aria-hidden="true">🍺</span>
        {!isCollapsed && (
          <div className="ml-3 overflow-hidden">
            <span className="text-amber-400 font-bold text-sm whitespace-nowrap">
              Bar Manager
            </span>
            <p className="text-gray-500 text-xs whitespace-nowrap">バー管理システム</p>
          </div>
        )}
      </div>

      {/* ナビゲーションメニュー */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            if (userLevel < (ROLE_LEVEL[item.minRole] ?? 1)) return null;

            const Icon = item.icon;

            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    `
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-150
                    ${isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }
                    ${isCollapsed ? 'justify-center' : ''}
                  `
                  }
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm font-medium truncate">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ユーザー情報（折りたたみ時は非表示） */}
      {!isCollapsed && currentUser && (
        <div className="px-4 py-3 border-t border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-medium">
                {currentUser.name.charAt(0)}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-white text-xs font-medium truncate">{currentUser.name}</p>
              <p className="text-gray-500 text-xs">
                {currentUser.role === 'master' ? 'マスター' : currentUser.role === 'manager' ? 'マネージャー' : 'スタッフ'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 折りたたみボタン */}
      <button
        onClick={onToggle}
        className="
          absolute -right-3 top-20
          w-6 h-6 rounded-full
          bg-gray-700 border border-gray-600
          flex items-center justify-center
          text-gray-400 hover:text-white hover:bg-gray-600
          transition-colors
          shadow-lg
          z-10
        "
        aria-label={isCollapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </aside>
  );
};

export default Sidebar;
