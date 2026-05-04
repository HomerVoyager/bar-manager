// バー管理システム - レポートAPI
// 売上・原価レポートの生成と取得に関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { SalesReport, CostData } from '../types';

// 日次売上レポートを取得
export const fetchDailySalesReport = async (date: string): Promise<SalesReport> => {
  const response = await apiClient.get<SalesReport>('/reports/sales/daily', {
    params: { date },
  });
  return response.data;
};

// 月次売上レポートを取得
export const fetchMonthlySalesReport = async (
  year: number,
  month: number
): Promise<SalesReport> => {
  const response = await apiClient.get<SalesReport>('/reports/sales/monthly', {
    params: { year, month },
  });
  return response.data;
};

// 年次売上レポートを取得
export const fetchYearlySalesReport = async (year: number): Promise<SalesReport> => {
  const response = await apiClient.get<SalesReport>('/reports/sales/yearly', {
    params: { year },
  });
  return response.data;
};

// 原価データを取得（FLコスト計算用）
export const fetchCostData = async (year: number, month: number): Promise<CostData> => {
  const response = await apiClient.get<CostData>('/reports/cost/fl-cost', {
    params: { year, month },
  });
  return response.data;
};

// 商品別原価・利益率データを取得
export const fetchProductCostData = async () => {
  const response = await apiClient.get('/reports/cost/product-margins');
  return response.data.products;
};

// 売上データをCSVエクスポート
export const exportSalesCsv = async (params: {
  period?: 'daily' | 'monthly' | 'yearly';
  date?: string;
  year?: number;
  month?: number;
}): Promise<Blob> => {
  const response = await apiClient.get('/reports/sales/export-csv', {
    params,
    responseType: 'blob',
  });
  return response.data;
};
