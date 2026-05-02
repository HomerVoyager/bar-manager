// バー管理システム - 在庫API
// 在庫管理（入出庫・履歴）に関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { StockLog, StockAdjustForm } from '../types';

// 在庫ログ一覧を取得
export const fetchStockLogs = async (params?: {
  product_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
}): Promise<StockLog[]> => {
  const response = await apiClient.get<StockLog[]>('/stock/logs', { params });
  return response.data;
};

// 在庫を調整（入庫・損失）
export const adjustStock = async (data: StockAdjustForm): Promise<StockLog> => {
  const response = await apiClient.post<StockLog>('/stock/adjust', data);
  return response.data;
};

// 在庫ログの詳細を取得
export const fetchStockLogById = async (id: number): Promise<StockLog> => {
  const response = await apiClient.get<StockLog>(`/stock/logs/${id}`);
  return response.data;
};

// 日付範囲の在庫ログを取得
export const fetchStockLogsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<StockLog[]> => {
  const response = await apiClient.get<StockLog[]>('/stock/logs', {
    params: { start_date: startDate, end_date: endDate },
  });
  return response.data;
};
