// ============================================================
// 型定義ファイル - バー管理システム共通型
// フロントエンドと共通の型定義を使用
// ============================================================

// スタッフ情報
export interface Staff {
  id: number;
  username: string;
  full_name: string;        // 氏名
  role: 'admin' | 'manager' | 'staff'; // 権限
  is_active: boolean;
  hourly_rate?: number;     // 時給
  created_at: string;
}

// 商品情報
export interface Product {
  id: number;
  name: string;             // 商品名
  category: string;         // カテゴリ（ドリンク/フード/その他）
  price: number;            // 価格（円）
  stock: number;            // 在庫数
  low_stock_threshold: number; // 在庫警告閾値
  is_available: boolean;    // 販売可否
  description?: string;     // 説明
  image_url?: string;       // 画像URL
}

// テーブル情報
export interface Table {
  id: number;
  name: string;             // テーブル名
  capacity: number;         // 定員
  status: 'empty' | 'occupied' | 'reserved'; // 状態
  session_id?: number;      // 現在のセッションID
  position_x?: number;      // テーブルマップ上のX座標
  position_y?: number;      // テーブルマップ上のY座標
}

// セッション情報（来店1組分）
export interface Session {
  id: number;
  table_id: number;
  table_name: string;
  guest_count: number;      // 人数
  staff_id: number;
  staff_name: string;
  start_time: string;       // 開始時刻
  end_time?: string;        // 終了時刻（会計済みの場合）
  status: 'active' | 'closed';
  total_amount: number;     // 合計金額
  order_items: OrderItem[]; // 注文明細
}

// 注文明細
export interface OrderItem {
  id: number;
  session_id: number;
  product_id: number;
  product_name: string;     // 商品名
  quantity: number;         // 数量
  unit_price: number;       // 単価
  subtotal: number;         // 小計
  ordered_at: string;       // 注文時刻
  note?: string;            // 備考
}

// 打刻情報（勤怠）
export interface Attendance {
  id: number;
  staff_id: number;
  staff_name: string;
  clock_in: string;         // 出勤時刻
  clock_out?: string;       // 退勤時刻
  work_hours?: number;      // 勤務時間（時間）
  night_hours?: number;     // 深夜勤務時間（22時以降）
  date: string;             // 日付（YYYY-MM-DD）
}

// ダッシュボードデータ
export interface DashboardData {
  today_sales: number;           // 本日売上
  active_tables: number;         // 稼働中テーブル数
  total_tables: number;          // 総テーブル数
  staff_on_duty: number;         // 出勤中スタッフ数
  low_stock_items: Product[];    // 在庫少商品
  recent_sessions: Session[];    // 直近のセッション
  hourly_sales: HourlySales[];   // 時間別売上
}

// 時間別売上データ
export interface HourlySales {
  hour: number;       // 時刻（0-23）
  amount: number;     // 売上金額
  orders: number;     // 注文数
}

// ログイン認証レスポンス
export interface AuthResponse {
  access_token: string;
  token_type: string;
  staff: Staff;
}

// ログインリクエスト
export interface LoginRequest {
  username: string;
  password: string;
}

// 新規セッション作成リクエスト
export interface CreateSessionRequest {
  table_id: number;
  guest_count: number;
}

// 注文追加リクエスト
export interface AddOrderItemRequest {
  session_id: number;
  product_id: number;
  quantity: number;
  note?: string;
}

// 打刻リクエスト
export interface AttendanceRequest {
  staff_id: number;
  action: 'clock_in' | 'clock_out';
  face_verified?: boolean;  // 顔認証による打刻かどうか
}

// WebSocketメッセージ
export interface WebSocketMessage {
  type: 'table_update' | 'order_update' | 'session_update' | 'ping' | 'pong';
  payload?: unknown;
  table_id?: number;
  session_id?: number;
  timestamp: string;
}

// ナビゲーションパラメータ型
export type RootStackParamList = {
  Login: undefined;
  TableMap: undefined;
  Order: { sessionId: number; tableId: number; tableName: string };
  Checkout: { sessionId: number; tableId: number; tableName: string };
  Attendance: undefined;
  Menu: undefined;
};

// テーブルカードの色設定
export interface TableCardColors {
  background: string;
  border: string;
  text: string;
  badge: string;
}
