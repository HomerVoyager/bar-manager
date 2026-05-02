// バー管理システム - APIクライアント設定
// axiosインスタンスを設定し、認証トークンの自動付与と401エラーハンドリングを行います

import axios from 'axios';

// バックエンドAPIのベースURL
const BASE_URL = 'http://localhost:8000/api/v1';

// axiosインスタンスの作成
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // タイムアウト設定（10秒）
  timeout: 10000,
});

// リクエストインターセプター: 認証トークンを自動付与
apiClient.interceptors.request.use(
  (config) => {
    // ローカルストレージからトークンを取得
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター: 401エラー時にログインページへリダイレクト
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 認証切れの場合はトークンをクリアしてログインページへ
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
