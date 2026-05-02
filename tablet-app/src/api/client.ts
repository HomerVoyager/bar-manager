// ============================================================
// APIクライアント設定
// axiosインスタンスの設定とインターセプター
// ============================================================

import axios, { AxiosInstance, AxiosResponse, AxiosError, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// デフォルトのAPIベースURL（Termux上のバックエンド）
const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';

// AsyncStorageのキー定数
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',       // 認証トークン
  BASE_URL: 'api_base_url',       // カスタムAPIベースURL
  STAFF_INFO: 'staff_info',       // ログイン中のスタッフ情報
} as const;

// axiosインスタンスの作成（デフォルト設定）
const apiClient: AxiosInstance = axios.create({
  baseURL: DEFAULT_BASE_URL,
  timeout: 10000,  // タイムアウト10秒
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// ナビゲーション参照（401エラー時にLoginへリダイレクト）
let navigationRef: { navigate: (screen: string) => void } | null = null;

/**
 * ナビゲーション参照をセットする
 * AppNavigator.tsx から呼び出す
 */
export const setNavigationRef = (ref: { navigate: (screen: string) => void }) => {
  navigationRef = ref;
};

/**
 * AsyncStorageからベースURLを取得してaxiosに設定する
 * アプリ起動時に呼び出す
 */
export const initializeApiClient = async (): Promise<void> => {
  try {
    // カスタムベースURLの取得（設定されていればTailscale IPなど）
    const customBaseUrl = await AsyncStorage.getItem(STORAGE_KEYS.BASE_URL);
    if (customBaseUrl) {
      apiClient.defaults.baseURL = customBaseUrl;
      console.log('カスタムAPIベースURLを使用:', customBaseUrl);
    } else {
      console.log('デフォルトAPIベースURLを使用:', DEFAULT_BASE_URL);
    }

    // 保存済みトークンの取得
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      console.log('保存済みトークンを設定しました');
    }
  } catch (error) {
    console.error('APIクライアント初期化エラー:', error);
  }
};

/**
 * ベースURLを変更する（Tailscale IPアドレスなど）
 */
export const setBaseUrl = async (url: string): Promise<void> => {
  apiClient.defaults.baseURL = url;
  await AsyncStorage.setItem(STORAGE_KEYS.BASE_URL, url);
  console.log('APIベースURLを変更しました:', url);
};

/**
 * 認証トークンをセットする
 */
export const setAuthToken = async (token: string): Promise<void> => {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
};

/**
 * 認証トークンをクリアする（ログアウト時）
 */
export const clearAuthToken = async (): Promise<void> => {
  delete apiClient.defaults.headers.common['Authorization'];
  await AsyncStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  await AsyncStorage.removeItem(STORAGE_KEYS.STAFF_INFO);
};

// ==============================
// リクエストインターセプター
// ==============================
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // リクエスト前にトークンを最新化する
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    console.error('リクエストエラー:', error);
    return Promise.reject(error);
  }
);

// ==============================
// レスポンスインターセプター
// ==============================
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // 正常レスポンスはそのまま返す
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // 401 Unauthorized: トークン期限切れまたは無効
      console.warn('認証エラー: ログイン画面へリダイレクトします');
      await clearAuthToken();
      // ナビゲーション参照があればLoginへ移動
      if (navigationRef) {
        navigationRef.navigate('Login');
      }
    } else if (error.response?.status === 403) {
      console.warn('権限エラー: この操作は許可されていません');
    } else if (error.response?.status === 404) {
      console.warn('リソースが見つかりません:', error.config?.url);
    } else if (error.response?.status && error.response.status >= 500) {
      console.error('サーバーエラー:', error.response.status, error.config?.url);
    } else if (!error.response) {
      // ネットワークエラー（バックエンドに接続できない）
      console.error('ネットワークエラー: バックエンドに接続できません');
    }
    return Promise.reject(error);
  }
);

export default apiClient;
