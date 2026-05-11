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
import AttendanceManage from './pages/AttendanceManage';
import Shifts from './pages/Shifts';
import Tables from './pages/Tables';
import Staff from './pages/Staff';
import Payslip from './pages/Payslip';
import DailyReport from './pages/DailyReport';
import Customers from './pages/Customers';
import LoadingSpinner from './components/LoadingSpinner';

class PageErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <p className="text-red-400 text-lg font-semibold">ページの読み込みに失敗しました</p>
          <p className="text-gray-500 text-sm">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg"
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// 認証済みユーザーのみアクセス可能なルートラッパー
const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  masterOnly?: boolean;
  managerOrAbove?: boolean;
}> = ({ children, masterOnly = false, managerOrAbove = false }) => {
  const { isAuthenticated, isMaster, isManager } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (masterOnly && !isMaster) {
    return <Navigate to="/dashboard" replace />;
  }
  if (managerOrAbove && !isManager) {
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
        <Route path="/dashboard" element={<PageErrorBoundary><Dashboard /></PageErrorBoundary>} />
        <Route path="/sales" element={
          <ProtectedRoute masterOnly>
            <PageErrorBoundary><Sales /></PageErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute managerOrAbove>
            <PageErrorBoundary><Inventory /></PageErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/cost" element={
          <ProtectedRoute masterOnly>
            <PageErrorBoundary><Cost /></PageErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/attendance" element={<PageErrorBoundary><Attendance /></PageErrorBoundary>} />
        <Route path="/attendance/manage" element={
          <ProtectedRoute managerOrAbove>
            <PageErrorBoundary><AttendanceManage /></PageErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/shifts" element={
          <ProtectedRoute managerOrAbove>
            <PageErrorBoundary><Shifts /></PageErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/tables" element={<PageErrorBoundary><Tables /></PageErrorBoundary>} />
        {/* マスター専用 */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute masterOnly>
              <PageErrorBoundary><Staff /></PageErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/payslip/:staffId/:year/:month" element={
          <ProtectedRoute managerOrAbove>
            <PageErrorBoundary><Payslip /></PageErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/daily-report" element={
          <ProtectedRoute managerOrAbove>
            <PageErrorBoundary><DailyReport /></PageErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/customers" element={
          <ProtectedRoute managerOrAbove>
            <PageErrorBoundary><Customers /></PageErrorBoundary>
          </ProtectedRoute>
        } />
      </Route>

      {/* 未定義パスはダッシュボードへ */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default App;
