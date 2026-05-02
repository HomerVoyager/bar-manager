# アプリケーション設定モジュール
# 環境変数から設定を読み込む

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """アプリケーション全体の設定クラス"""

    # アプリケーション基本設定
    APP_NAME: str = "バー管理システム"
    DEBUG: bool = False

    # データベース設定
    DATABASE_URL: str = "postgresql://baruser:barpassword@localhost:5432/bardb"

    # JWTトークン設定
    SECRET_KEY: str = "your-secret-key-change-this-in-production"
    ALGORITHM: str = "HS256"
    # トークン有効期限（分）: 480分 = 8時間（営業時間中に失効しない設定）
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Termux環境のバックアップディレクトリ
    BACKUP_DIR: str = "/data/data/com.termux/files/home/backups"

    # CORS設定 - フロントエンドの許可オリジン（ListはJSON形式で環境変数に設定可能）
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",       # React開発サーバー
        "http://localhost:19006",      # Expo開発サーバー
        "http://127.0.0.1:3000",
        "http://127.0.0.1:19006",
    ]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


# グローバル設定インスタンス
settings = Settings()
