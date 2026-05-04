// バー管理システム - 在庫API
import { apiClient } from './client';
import type { StockLog, StockAdjustForm } from '../types';

// 在庫ログ一覧を取得
export const fetchStockLogs = async (params?: {
  product_id?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<StockLog[]> => {
  const response = await apiClient.get<StockLog[]>('/stock/logs', { params });
  return response.data;
};

// 在庫を調整（入庫・損失）
export const adjustStock = async (data: StockAdjustForm): Promise<StockLog> => {
  const response = await apiClient.post<StockLog>('/stock/logs', data);
  return response.data;
};

// 日付範囲の在庫ログを取得
export const fetchStockLogsByDateRange = async (
  startDate: string,
  endDate: string
): Promise<StockLog[]> => {
  const response = await apiClient.get<StockLog[]>('/stock/logs', {
    params: { date_from: startDate, date_to: endDate },
  });
  return response.data;
};
