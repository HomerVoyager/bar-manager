// バー管理システム - 型定義
// アプリケーション全体で使用するTypeScript型を定義します

// スタッフ情報
export interface Staff {
  id: number;
  name: string;
  employee_number?: string;
  face_id?: string;
  role: 'master' | 'manager' | 'staff';
  hourly_wage: number;
  drink_back_rate: number;
  is_active: boolean;
  created_at: string;
}

// 商品・ドリンク情報
export interface Product {
  id: number;
  name: string;
  price: number;
  cost: number;
  category?: string;
  stock_qty: number;
  alert_qty: number;
  unit?: string;
  is_active: boolean;
  is_low_stock?: boolean;
}

// テーブル（卓）情報
export interface Table {
  id: number;
  name: string;
  capacity: number;
  status: 'empty' | 'occupied' | 'reserved';
  current_session?: Session;
}

// セッション（接客）情報
export interface Session {
  id: number;
  table_id: number;
  staff_id: number;
  guest_count: number;
  started_at: string;
  closed_at?: string;
  total: number;
  status: 'open' | 'closed';
  plan_type: 'tanpin' | 'nomi_hodai';
  time_limit_minutes?: number;
  items?: OrderItem[];
}

// 注文アイテム
export interface OrderItem {
  id: number;
  session_id: number;
  product_id: number;
  qty: number;
  unit_price: number;
  ordered_at: string;
  product_name?: string;
}

// 在庫ログ
export interface StockLog {
  id: number;
  product_id: number;
  change_qty: number;
  reason: 'purchase' | 'sale' | 'loss';
  staff_id?: number;
  created_at: string;
  product_name?: string;
}

// 勤怠情報
export interface Attendance {
  id: number;
  staff_id: number;
  clock_in?: string;
  clock_out?: string;
  date: string;
  work_minutes?: number;
  night_minutes?: number;
  wage?: number;
  staff_name?: string;
}

// ダッシュボードデータ
export interface DashboardData {
  today_sales: number;
  today_guests: number;
  active_sessions: number;
  low_stock_alerts: Product[];
  on_duty_staff: Staff[];
  table_status: Table[];
  monthly_comparison: { date: string; this_month: number; last_month: number }[];
}

// 売上レポート
export interface SalesReport {
  period: string;
  total_sales: number;
  total_guests: number;
  avg_per_guest: number;
  daily_data: { date: string; sales: number; guests: number }[];
  product_breakdown: { product_name: string; qty: number; total: number; category?: string }[];
  hourly_data: { hour: number; sales: number; guests: number }[];
}

// 原価データ
export interface CostData {
  food_cost_rate: number;
  labor_cost_rate: number;
  fl_cost_rate: number;
  total_sales: number;
  total_cost: number;
  total_labor: number;
}

// ログイン認証情報
export interface LoginCredentials {
  username: string;
  password: string;
}

// 認証トークンレスポンス
export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: Staff;
}

// 在庫調整フォーム
export interface StockAdjustForm {
  product_id: number;
  change_qty: number;
  reason: 'purchase' | 'loss';
}

// 勤怠月次サマリー
export interface AttendanceSummary {
  staff_id: number;
  staff_name: string;
  work_days: number;
  total_work_minutes: number;
  total_night_minutes: number;
  drink_back_total: number;
  total_wage: number;
}

// スタッフドリンク（ドリンクバック）
export interface StaffDrink {
  id: number;
  session_id: number;
  staff_id: number;
  product_id?: number;
  qty: number;
  unit_price: number;
  back_amount: number;
  note?: string;
  ordered_at: string;
  staff_name?: string;
  product_name?: string;
}

// セッション開始フォーム
export interface OpenSessionForm {
  table_id: number;
  staff_id: number;
  guest_count: number;
  plan_type: 'tanpin' | 'nomi_hodai';
  time_limit_minutes?: number;
}

// 注文追加フォーム
export interface AddOrderItemForm {
  session_id: number;
  product_id: number;
  qty: number;
}

// スタッフ作成フォーム
export interface CreateStaffForm {
  name: string;
  employee_number?: string;
  role: 'master' | 'manager' | 'staff';
  hourly_wage: number;
  drink_back_rate: number;
  password: string;
}

// WebSocketメッセージ
export interface WebSocketMessage {
  type: 'table_update' | 'session_update' | 'stock_alert' | 'ping';
  data?: Table[] | Session | Product;
  timestamp?: string;
}

// APIエラー
export interface ApiError {
  detail: string;
  status_code?: number;
}

// シフト
export interface Shift {
  id: number;
  staff_id: number;
  date: string;
  start_time: string;
  end_time: string;
  note?: string;
  staff?: { id: number; name: string; role: string };
}
