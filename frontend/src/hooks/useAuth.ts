// バー管理システム - 認証フック
// ユーザー認証状態の管理とログイン・ログアウト機能を提供します

import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginApi } from '../api/auth';
import { apiClient } from '../api/client';
import type { Staff, LoginCredentials, AuthResponse } from '../types';

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

// JWTペイロードから有効期限（ミリ秒）を取得
const getTokenExpiry = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

export const useAuth = (): UseAuthReturn => {
  // ローカルストレージからユーザー情報を初期化
  const [user, setUser] = useState<Staff | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Staff;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // トークンを更新してストレージとstateに反映
  const applyToken = useCallback((res: AuthResponse) => {
    localStorage.setItem(TOKEN_KEY, res.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }, []);

  // バックグラウンドでトークンを自動更新するタイマーをセット
  const scheduleRefresh = useCallback((token: string) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);

    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    // 期限30分前に更新（最低でも10秒後）
    const delay = Math.max(expiry - Date.now() - 30 * 60 * 1000, 10_000);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiClient.post<AuthResponse>('/auth/refresh');
        applyToken(res.data);
        scheduleRefresh(res.data.access_token);
      } catch {
        // 更新失敗はインターセプターが401として処理するので何もしない
      }
    }, delay);
  }, [applyToken]);

  // ページロード時にトークンの有効性を確認し、リフレッシュタイマーをセット
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(null);
      return;
    }
    const expiry = getTokenExpiry(token);
    if (expiry && expiry <= Date.now()) {
      // すでに期限切れ
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      return;
    }
    scheduleRefresh(token);
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ログイン処理
  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await loginApi(credentials);
      applyToken(response);
      scheduleRefresh(response.access_token);
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
  }, [navigate, applyToken, scheduleRefresh]);

  // ログアウト処理
  const logout = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
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
