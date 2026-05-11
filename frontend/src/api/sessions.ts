// バー管理システム - セッション（接客）API
// 卓のセッション管理（開卓・会計・注文）に関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { Session, OrderItem, OpenSessionForm, AddOrderItemForm } from '../types';

// セッション一覧を取得
export const fetchSessions = async (): Promise<Session[]> => {
  const response = await apiClient.get<Session[]>('/sessions/active');
  return response.data;
};

// セッション詳細を取得（注文アイテム含む）
export const fetchSessionById = async (id: number): Promise<Session> => {
  const response = await apiClient.get<Session>(`/sessions/${id}`);
  return response.data;
};

// セッションを開始（開卓）
export const openSession = async (data: OpenSessionForm): Promise<Session> => {
  const response = await apiClient.post<Session>('/sessions/', data);
  return response.data;
};

// セッションを終了（会計・閉卓）
export const closeSession = async (id: number): Promise<Session> => {
  const response = await apiClient.post<Session>(`/sessions/${id}/close`);
  return response.data;
};

// 注文アイテムを追加
export const addOrderItem = async (data: AddOrderItemForm): Promise<OrderItem> => {
  const response = await apiClient.post<OrderItem>(`/sessions/${data.session_id}/items`, data);
  return response.data;
};

// 注文アイテムを削除
export const removeOrderItem = async ({ sessionId, itemId }: { sessionId: number; itemId: number }): Promise<void> => {
  await apiClient.delete(`/sessions/${sessionId}/items/${itemId}`);
};

// セッションの注文アイテム一覧を取得
export const fetchSessionItems = async (sessionId: number): Promise<OrderItem[]> => {
  const response = await apiClient.get<OrderItem[]>(`/sessions/${sessionId}/items`);
  return response.data;
};

// セッション情報を直接修正（操作ミス訂正用）
export const updateSession = async (
  sessionId: number,
  data: { time_limit_minutes?: number; extension_fee?: number }
): Promise<{ session_id: number; time_limit_minutes: number; extension_fee: number }> => {
  const response = await apiClient.patch(`/sessions/${sessionId}`, data);
  return response.data;
};

// 飲み放題を30分延長（feePerPerson: 延長料金/人）
export const extendSession = async (
  sessionId: number,
  feePerPerson: number = 0
): Promise<{ session_id: number; time_limit_minutes: number; extension_fee: number }> => {
  const response = await apiClient.patch(`/sessions/${sessionId}/extend`, { fee_per_person: feePerPerson });
  return response.data;
};
