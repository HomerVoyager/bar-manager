#!/usr/bin/env python3
"""sessionsテーブルにplan_type/time_limit_minutesカラムを追加"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import engine
from sqlalchemy import text

# DDLはオートコミットモードで実行（トランザクション不要）
with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
    for sql, label in [
        ("ALTER TABLE sessions ADD COLUMN plan_type VARCHAR(20) NOT NULL DEFAULT 'tanpin'", "plan_type"),
        ("ALTER TABLE sessions ADD COLUMN time_limit_minutes INTEGER", "time_limit_minutes"),
    ]:
        try:
            conn.execute(text(sql))
            print(f"{label} カラム追加完了")
        except Exception as e:
            if "already exists" in str(e) or "duplicate" in str(e).lower():
                print(f"{label} は既に存在します（スキップ）")
            else:
                print(f"{label} エラー: {e}")

print("マイグレーション完了")
