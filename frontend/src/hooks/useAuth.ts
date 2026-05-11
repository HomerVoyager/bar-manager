// バー管理システム - 認証フック
// ユーザー認証状態の管理とログイン・ログアウト機能を提供します

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../api/auth';
import type { Staff, LoginCredentials } from '../types';

// ローカルストレージのキー定数
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

// 認証フックの返り値の型定義
interface UseAuthReturn {
  user: Staff | null;
  isAuthenticated: boolean;
  isMaster: boolean;
  isManager: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = (): UseAuthReturn => {
  // ローカルストレージからユーザー情報を初期化
  const [user, setUser] = useState<Staff | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Staff;
      } catch {
        // パースエラーの場合はnullを返す
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  // ページロード時にトークンの有効性を確認
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token && user) {
      // トークンがない場合はユーザー情報もクリア
      setUser(null);
    }
  }, [user]);

  // ログイン処理
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await loginApi(credentials);
      // トークンとユーザー情報をローカルストレージに保存
      localStorage.setItem(TOKEN_KEY, response.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
      setUser(response.user);
      // ダッシュボードへリダイレクト
      navigate('/dashboard');
    } catch (err: unknown) {
      // エラーメッセージの設定
      const error = err as { response?: { data?: { detail?: string } } };
      if (error?.response?.data?.detail) {
        setError(error.response.data.detail);
      } else {
        setError('ログインに失敗しました。ユーザー名またはパスワードを確認してください。');
      }
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  // ログアウト処理
  const logout = useCallback(() => {
    // ローカルストレージをクリア
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    // ログインページへリダイレクト
    navigate('/login');
  }, [navigate]);

  return {
    user,
    isAuthenticated: !!user && !!localStorage.getItem(TOKEN_KEY),
    isMaster: user?.role === 'master',
    isManager: user?.role === 'master' || user?.role === 'manager',
    login,
    logout,
    isLoading,
    error,
  };
};

export default useAuth;
