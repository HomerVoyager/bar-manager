// バー管理システム - ダッシュボードAPI
// ダッシュボードに表示するデータを取得するAPI呼び出しを定義します

import { apiClient } from './client';
import type { DashboardData } from '../types';

// ダッシュボードデータを取得
export const fetchDashboard = async (): Promise<DashboardData> => {
  const response = await apiClient.get<DashboardData>('/dashboard/');
  return response.data;
};

// リアルタイムの売上サマリーを取得
export const fetchTodaySummary = async () => {
  const response = await apiClient.get('/dashboard/today-summary');
  return response.data;
};
