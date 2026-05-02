// バー管理システム - ルーティング設定
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Inventory from './pages/Inventory';
import Cost from './pages/Cost';
import Attendance from './pages/Attendance';
import Tables from './pages/Tables';
import Staff from './pages/Staff';
import LoadingSpinner from './components/LoadingSpinner';

// 認証済みユーザーのみアクセス可能なルートラッパー
const ProtectedRoute: React.FC<{ children: React.ReactNode; managerOnly?: boolean }> = ({
  children,
  managerOnly = false,
}) => {
  const { isAuthenticated, isManager } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (managerOnly && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// レイアウト付きルートラッパー
const LayoutRoute: React.FC = () => {
  const { user, logout } = useAuth();
  return <Layout currentUser={user} onLogout={logout} />;
};

const App: React.FC = () => {
  return (
    <Routes>
      {/* 認証不要 */}
      <Route path="/login" element={<Login />} />

      {/* 認証必須（レイアウト共通） */}
      <Route
        element={
          <ProtectedRoute>
            <LayoutRoute />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sales" element={<Sales />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/cost" element={<Cost />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/tables" element={<Tables />} />
        {/* マネージャー専用 */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute managerOnly>
              <Staff />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 未定義パスはダッシュボードへ */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
