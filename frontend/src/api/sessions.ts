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
  const response = await apiClient.post<OrderItem>('/sessions/order-items', data);
  return response.data;
};

// 注文アイテムを削除
export const removeOrderItem = async (itemId: number): Promise<void> => {
  await apiClient.delete(`/sessions/order-items/${itemId}`);
};

// セッションの注文アイテム一覧を取得
export const fetchSessionItems = async (sessionId: number): Promise<OrderItem[]> => {
  const response = await apiClient.get<OrderItem[]>(`/sessions/${sessionId}/items`);
  return response.data;
};
