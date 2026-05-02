// ============================================================
// APIエンドポイント定義
// バックエンドとの通信関数をすべてここに集約
// ============================================================

import apiClient from './client';
import {
  AuthResponse,
  LoginRequest,
  Staff,
  Table,
  Session,
  OrderItem,
  Product,
  Attendance,
  DashboardData,
  CreateSessionRequest,
  AddOrderItemRequest,
  AttendanceRequest,
} from '../types';

// ==============================
// 認証 API
// ==============================

/**
 * ログイン
 */
export const login = async (data: LoginRequest): Promise<AuthResponse> => {
  // フォームデータ形式で送信（OAuth2 Password Flow）
  const formData = new URLSearchParams();
  formData.append('username', data.username);
  formData.append('password', data.password);

  const response = await apiClient.post<AuthResponse>('/auth/token', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return response.data;
};

/**
 * 現在のスタッフ情報取得
 */
export const getCurrentStaff = async (): Promise<Staff> => {
  const response = await apiClient.get<Staff>('/auth/me');
  return response.data;
};

// ==============================
// テーブル API
// ==============================

/**
 * 全テーブル一覧取得
 */
export const getTables = async (): Promise<Table[]> => {
  const response = await apiClient.get<Table[]>('/tables');
  return response.data;
};

/**
 * テーブル詳細取得
 */
export const getTable = async (tableId: number): Promise<Table> => {
  const response = await apiClient.get<Table>(`/tables/${tableId}`);
  return response.data;
};

// ==============================
// セッション API
// ==============================

/**
 * 新規セッション開始（テーブルへの来客）
 */
export const createSession = async (data: CreateSessionRequest): Promise<Session> => {
  const response = await apiClient.post<Session>('/sessions', data);
  return response.data;
};

/**
 * セッション詳細取得（注文明細を含む）
 */
export const getSession = async (sessionId: number): Promise<Session> => {
  const response = await apiClient.get<Session>(`/sessions/${sessionId}`);
  return response.data;
};

/**
 * アクティブなセッション一覧取得
 */
export const getActiveSessions = async (): Promise<Session[]> => {
  const response = await apiClient.get<Session[]>('/sessions?status=active');
  return response.data;
};

/**
 * セッションを会計済みにする（クローズ）
 */
export const closeSession = async (
  sessionId: number,
  paymentData: { payment_method: string; cash_received?: number }
): Promise<Session> => {
  const response = await apiClient.post<Session>(`/sessions/${sessionId}/close`, paymentData);
  return response.data;
};

// ==============================
// 注文 API
// ==============================

/**
 * 注文明細を追加する
 */
export const addOrderItem = async (data: AddOrderItemRequest): Promise<OrderItem> => {
  const response = await apiClient.post<OrderItem>('/orders', data);
  return response.data;
};

/**
 * 注文明細の数量を更新する
 */
export const updateOrderItemQty = async (
  orderId: number,
  quantity: number
): Promise<OrderItem> => {
  const response = await apiClient.put<OrderItem>(`/orders/${orderId}`, { quantity });
  return response.data;
};

/**
 * 注文明細を削除する
 */
export const deleteOrderItem = async (orderId: number): Promise<void> => {
  await apiClient.delete(`/orders/${orderId}`);
};

/**
 * セッションの全注文明細を取得
 */
export const getOrderItems = async (sessionId: number): Promise<OrderItem[]> => {
  const response = await apiClient.get<OrderItem[]>(`/sessions/${sessionId}/orders`);
  return response.data;
};

// ==============================
// 商品 API
// ==============================

/**
 * 全商品一覧取得
 */
export const getProducts = async (category?: string): Promise<Product[]> => {
  const url = category ? `/products?category=${encodeURIComponent(category)}` : '/products';
  const response = await apiClient.get<Product[]>(url);
  return response.data;
};

/**
 * 商品詳細取得
 */
export const getProduct = async (productId: number): Promise<Product> => {
  const response = await apiClient.get<Product>(`/products/${productId}`);
  return response.data;
};

/**
 * 商品を追加する（マネージャー以上）
 */
export const createProduct = async (
  data: Omit<Product, 'id'>
): Promise<Product> => {
  const response = await apiClient.post<Product>('/products', data);
  return response.data;
};

/**
 * 商品を更新する（マネージャー以上）
 */
export const updateProduct = async (
  productId: number,
  data: Partial<Product>
): Promise<Product> => {
  const response = await apiClient.put<Product>(`/products/${productId}`, data);
  return response.data;
};

/**
 * 商品カテゴリ一覧取得
 */
export const getCategories = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>('/products/categories');
  return response.data;
};

// ==============================
// 勤怠 API
// ==============================

/**
 * 打刻処理（出勤 / 退勤）
 */
export const recordAttendance = async (data: AttendanceRequest): Promise<Attendance> => {
  const response = await apiClient.post<Attendance>('/attendance/clock', data);
  return response.data;
};

/**
 * 本日の勤怠一覧取得（全スタッフ）
 */
export const getTodayAttendance = async (): Promise<Attendance[]> => {
  const today = new Date().toISOString().split('T')[0];
  const response = await apiClient.get<Attendance[]>(`/attendance?date=${today}`);
  return response.data;
};

/**
 * スタッフ別勤怠履歴取得
 */
export const getStaffAttendance = async (
  staffId: number,
  startDate: string,
  endDate: string
): Promise<Attendance[]> => {
  const response = await apiClient.get<Attendance[]>(
    `/attendance?staff_id=${staffId}&start_date=${startDate}&end_date=${endDate}`
  );
  return response.data;
};

// ==============================
// スタッフ API
// ==============================

/**
 * 全スタッフ一覧取得（マネージャー以上）
 */
export const getStaffList = async (): Promise<Staff[]> => {
  const response = await apiClient.get<Staff[]>('/staff');
  return response.data;
};

// ==============================
// ダッシュボード API
// ==============================

/**
 * ダッシュボードデータ取得
 */
export const getDashboard = async (): Promise<DashboardData> => {
  const response = await apiClient.get<DashboardData>('/dashboard');
  return response.data;
};
