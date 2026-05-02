// バー管理システム - 認証API
// ログイン・ログアウト関連のAPI呼び出しを定義します

import { apiClient } from './client';
import type { LoginCredentials, AuthResponse } from '../types';

// ログインAPIの呼び出し
export const loginApi = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  // FastAPIのOAuth2形式に対応（application/x-www-form-urlencoded）
  const formData = new FormData();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);

  const response = await apiClient.post<AuthResponse>('/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data;
};

// 現在のユーザー情報を取得
export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

// パスワード変更API
export const changePassword = async (data: { current_password: string; new_password: string }) => {
  const response = await apiClient.post('/auth/change-password', data);
  return response.data;
};
