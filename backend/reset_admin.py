#!/usr/bin/env python3
"""管理者パスワードをリセットするスクリプト"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import SessionLocal
from app.models.staff import Staff
from app.core.security import get_password_hash

db = SessionLocal()
try:
    staff = db.query(Staff).filter(Staff.name == "マネージャー田中").first()
    if not staff:
        staff = db.query(Staff).first()

    if staff:
        staff.name = "admin"
        staff.password_hash = get_password_hash("admin")
        db.commit()
        print(f"リセット完了: name=admin, password=admin")
    else:
        print("スタッフが見つかりません")
finally:
    db.close()
