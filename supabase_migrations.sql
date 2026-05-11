-- =====================================================
-- Bar Manager - Supabase マイグレーションSQL
-- 前回以降に追加したカラム・テーブルをまとめたもの
-- =====================================================

-- ①  sessions テーブル: セット料金・飲み放題価格・延長料金
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS set_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS nomi_hodai_price INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS extension_fee INTEGER NOT NULL DEFAULT 0;

-- ①b sessions テーブル: 呼びバック担当スタッフ
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS yobiback_staff_id INTEGER REFERENCES staff(id) ON DELETE SET NULL;

-- ②  attendance テーブル: 欠勤・有給管理
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absence_type VARCHAR(20);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS absence_note VARCHAR(200);

-- ③  shifts テーブル（未作成の場合のみ作成）
CREATE TABLE IF NOT EXISTS shifts (
    id SERIAL PRIMARY KEY,
    staff_id INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL,
    end_time VARCHAR(5) NOT NULL,
    note VARCHAR(200),
    UNIQUE(staff_id, date)
);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date ON shifts(date);

-- ⑥  customers テーブル（顧客管理）
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(200),
    birthday DATE,
    notes TEXT,
    visit_count INTEGER NOT NULL DEFAULT 0,
    last_visit_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
