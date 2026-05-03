# 認証スキーマ
# ログインリクエストとJWTトークンのPydanticスキーマ

from pydantic import BaseModel
from typing import Optional

from app.schemas.staff import StaffResponse


class LoginRequest(BaseModel):
    """ログインリクエストスキーマ"""
    # ユーザー名（スタッフ名）
    username: str
    # パスワード
    password: str

    model_config = {
        "json_schema_extra": {
            "example": {
                "username": "admin",
                "password": "admin"
            }
        }
    }


class Token(BaseModel):
    """JWTトークンレスポンススキーマ"""
    # アクセストークン
    access_token: str
    # トークンタイプ（Bearer固定）
    token_type: str = "bearer"
    # ログインユーザー情報
    user: Optional[StaffResponse] = None


class TokenData(BaseModel):
    """トークンのデコードデータスキーマ"""
    # スタッフID（subクレームに格納）
    staff_id: Optional[int] = None
    # スタッフ名
    name: Optional[str] = None
    # ロール
    role: Optional[str] = None
