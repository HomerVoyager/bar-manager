// ============================================================
// useAuth カスタムフック
// 認証状態の管理とログイン/ログアウト処理
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Staff, LoginRequest, AuthResponse } from '../types';
import { login as apiLogin, getCurrentStaff } from '../api/endpoints';
import { setAuthToken, clearAuthToken, STORAGE_KEYS } from '../api/client';

// 認証フックの戻り値の型
interface UseAuthReturn {
  staff: Staff | null;           // ログイン中のスタッフ情報
  isLoading: boolean;            // ローディング状態
  isAuthenticated: boolean;      // 認証済みかどうか
  error: string | null;          // エラーメッセージ
  login: (data: LoginRequest) => Promise<boolean>; // ログイン関数
  logout: () => Promise<void>;   // ログアウト関数
  refreshStaff: () => Promise<void>; // スタッフ情報を再取得
}

/**
 * 認証管理カスタムフック
 * AppNavigatorとLoginScreenで使用する
 */
export const useAuth = (): UseAuthReturn => {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // アプリ起動時に保存済みトークンを確認
  useEffect(() => {
    checkStoredAuth();
  }, []);

  /**
   * AsyncStorageに保存されたトークンとスタッフ情報を確認
   */
  const checkStoredAuth = async (): Promise<void> => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
      const staffJson = await AsyncStorage.getItem(STORAGE_KEYS.STAFF_INFO);

      if (token && staffJson) {
        // 保存済みスタッフ情報を復元
        const savedStaff: Staff = JSON.parse(staffJson);
        setStaff(savedStaff);

        // バックエンドにトークンが有効かどうか確認
        try {
          const currentStaff = await getCurrentStaff();
          setStaff(currentStaff);
          await AsyncStorage.setItem(STORAGE_KEYS.STAFF_INFO, JSON.stringify(currentStaff));
        } catch {
          // トークンが無効な場合はクリア
          console.warn('トークンが無効です。再ログインが必要です。');
          await clearAuthToken();
          setStaff(null);
        }
      }
    } catch (err) {
      console.error('認証確認エラー:', err);
      setStaff(null);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * ログイン処理
   * @returns ログイン成功時 true
   */
  const login = useCallback(async (data: LoginRequest): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const response: AuthResponse = await apiLogin(data);

      // トークンとスタッフ情報を保存
      await setAuthToken(response.access_token);
      await AsyncStorage.setItem(STORAGE_KEYS.STAFF_INFO, JSON.stringify(response.staff));

      setStaff(response.staff);
      console.log(`ログイン成功: ${response.staff.full_name}`);
      return true;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error
        ? err.message
        : 'ログインに失敗しました。ユーザー名またはパスワードを確認してください。';
      setError(errorMessage);
      console.error('ログインエラー:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * ログアウト処理
   * トークンとスタッフ情報をクリア
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await clearAuthToken();
      setStaff(null);
      setError(null);
      console.log('ログアウトしました');
    } catch (err) {
      console.error('ログアウトエラー:', err);
    }
  }, []);

  /**
   * スタッフ情報を再取得する
   * （権限変更などがあった場合に使用）
   */
  const refreshStaff = useCallback(async (): Promise<void> => {
    try {
      const currentStaff = await getCurrentStaff();
      setStaff(currentStaff);
      await AsyncStorage.setItem(STORAGE_KEYS.STAFF_INFO, JSON.stringify(currentStaff));
    } catch (err) {
      console.error('スタッフ情報更新エラー:', err);
    }
  }, []);

  return {
    staff,
    isLoading,
    isAuthenticated: !!staff,
    error,
    login,
    logout,
    refreshStaff,
  };
};
