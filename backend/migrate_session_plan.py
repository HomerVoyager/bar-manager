#!/usr/bin/env python3
"""sessionsテーブルにplan_type/time_limit_minutesカラムを追加"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN plan_type VARCHAR(20) NOT NULL DEFAULT 'tanpin'"
        ))
        print("plan_type カラム追加完了")
    except Exception as e:
        if "already exists" in str(e) or "duplicate" in str(e).lower():
            print("plan_type は既に存在します")
        else:
            print(f"plan_type エラー: {e}")

    try:
        conn.execute(text(
            "ALTER TABLE sessions ADD COLUMN time_limit_minutes INTEGER"
        ))
        print("time_limit_minutes カラム追加完了")
    except Exception as e:
        if "already exists" in str(e) or "duplicate" in str(e).lower():
            print("time_limit_minutes は既に存在します")
        else:
            print(f"time_limit_minutes エラー: {e}")

    conn.commit()
    print("マイグレーション完了")
