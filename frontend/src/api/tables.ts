// バー管理システム - 卓（テーブル）API
// テーブル管理に関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { Table } from '../types';

// テーブル一覧を取得（現在のステータス含む）
export const fetchTables = async (): Promise<Table[]> => {
  const response = await apiClient.get<Table[]>('/tables');
  return response.data;
};

// テーブル詳細を取得
export const fetchTableById = async (id: number): Promise<Table> => {
  const response = await apiClient.get<Table>(`/tables/${id}`);
  return response.data;
};

// テーブルを新規作成
export const createTable = async (data: { name: string; capacity: number }): Promise<Table> => {
  const response = await apiClient.post<Table>('/tables', data);
  return response.data;
};

// テーブル情報を更新
export const updateTable = async (id: number, data: Partial<Table>): Promise<Table> => {
  const response = await apiClient.put<Table>(`/tables/${id}`, data);
  return response.data;
};
