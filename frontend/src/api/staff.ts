// バー管理システム - スタッフAPI
// スタッフ管理に関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { Staff, CreateStaffForm } from '../types';

// スタッフ一覧を取得
export const fetchStaff = async (): Promise<Staff[]> => {
  const response = await apiClient.get<Staff[]>('/staff');
  return response.data;
};

// スタッフ詳細を取得
export const fetchStaffById = async (id: number): Promise<Staff> => {
  const response = await apiClient.get<Staff>(`/staff/${id}`);
  return response.data;
};

// スタッフを新規作成
export const createStaff = async (data: CreateStaffForm): Promise<Staff> => {
  const response = await apiClient.post<Staff>('/staff', data);
  return response.data;
};

// スタッフ情報を更新
export const updateStaff = async (id: number, data: Partial<CreateStaffForm>): Promise<Staff> => {
  const response = await apiClient.put<Staff>(`/staff/${id}`, data);
  return response.data;
};

// スタッフを無効化（論理削除）
export const deactivateStaff = async (id: number): Promise<Staff> => {
  const response = await apiClient.patch<Staff>(`/staff/${id}/deactivate`);
  return response.data;
};

// スタッフを有効化
export const activateStaff = async (id: number): Promise<Staff> => {
  const response = await apiClient.patch<Staff>(`/staff/${id}/activate`);
  return response.data;
};
