# バー管理システム メインアプリケーション
# FastAPI + PostgreSQL + WebSocket対応

import logging
import re
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import create_tables

# ルーターをインポート
from app.routers import (
    auth,
    staff,
    products,
    tables,
    sessions,
    stock,
    attendance,
    reports,
    dashboard,
    ws,
)
from app.routers import shifts
from app.routers import staff_drinks
from app.routers import customers

# ロガーの設定
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    アプリケーションのライフサイクル管理
    起動時: テーブル作成
    終了時: クリーンアップ
    """
    # 起動時の処理
    logger.info("バー管理システムを起動しています...")
    try:
        # データベーステーブルを作成（存在しない場合のみ）
        create_tables()
        logger.info("データベーステーブルの確認・作成が完了しました")
    except Exception as e:
        logger.error(f"データベース初期化エラー: {e}")
        raise

    yield

    # 終了時の処理
    logger.info("バー管理システムをシャットダウンしています...")


# FastAPIアプリケーションインスタンスの作成
app = FastAPI(
    title=settings.APP_NAME,
    description="居酒屋・バー向け POSシステム API\n\nAndroid Termux + PostgreSQL環境対応",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


def is_tailscale_origin(origin: str) -> bool:
    """
    TailscaleのIPアドレス（100.x.x.x）からのアクセスかチェック
    Tailscaleはプライベートネットワークのため許可する
    """
    # http://100.x.x.x または https://100.x.x.x の形式
    pattern = r"^https?://100\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$"
    return bool(re.match(pattern, origin))


class TailscaleCORSMiddleware:
    """
    TailscaleのIPアドレスからのCORSを動的に許可するミドルウェア
    """
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            origin = headers.get(b"origin", b"").decode("utf-8")
            if origin and is_tailscale_origin(origin):
                # Tailscaleオリジンを一時的に許可リストに追加
                if origin not in settings.ALLOWED_ORIGINS:
                    settings.ALLOWED_ORIGINS.append(origin)
        await self.app(scope, receive, send)


# CORSミドルウェアの設定
# フロントエンド（React/Expo）からのアクセスを許可
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_allowed_origins,
    allow_origin_regex=r"https?://100\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?",  # Tailscale全IP許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== APIルーターの登録 =====
# 全エンドポイントに /api/v1 プレフィックスを付ける

app.include_router(
    auth.router,
    prefix="/api/v1/auth",
    tags=["認証"],
)

app.include_router(
    staff.router,
    prefix="/api/v1/staff",
    tags=["スタッフ管理"],
)

app.include_router(
    products.router,
    prefix="/api/v1/products",
    tags=["商品管理"],
)

app.include_router(
    tables.router,
    prefix="/api/v1/tables",
    tags=["テーブル管理"],
)

app.include_router(
    sessions.router,
    prefix="/api/v1/sessions",
    tags=["セッション管理"],
)

app.include_router(
    stock.router,
    prefix="/api/v1/stock",
    tags=["在庫管理"],
)

app.include_router(
    attendance.router,
    prefix="/api/v1/attendance",
    tags=["勤怠管理"],
)

app.include_router(
    reports.router,
    prefix="/api/v1/reports",
    tags=["レポート"],
)

app.include_router(
    dashboard.router,
    prefix="/api/v1/dashboard",
    tags=["ダッシュボード"],
)

app.include_router(
    shifts.router,
    prefix="/api/v1/shifts",
    tags=["シフト管理"],
)

app.include_router(
    staff_drinks.router,
    prefix="/api/v1/staff_drinks",
    tags=["スタッフドリンク"],
)

app.include_router(
    customers.router,
    prefix="/api/v1/customers",
    tags=["顧客管理"],
)

# WebSocketルーター（/ws プレフィックス）
app.include_router(
    ws.router,
    prefix="/ws",
    tags=["WebSocket"],
)


# ===== ヘルスチェックエンドポイント =====
@app.get("/health", tags=["システム"])
async def health_check():
    """
    サーバーの稼働状況を確認するエンドポイント
    監視ツールやフロントエンドの接続確認に使用
    """
    from app.core.database import engine
    try:
        # データベース接続確認
        with engine.connect() as conn:
            conn.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "database": db_status,
    }


@app.get("/", tags=["システム"])
async def root():
    """ルートエンドポイント（APIドキュメントへのリダイレクト情報）"""
    return {
        "message": f"{settings.APP_NAME} API",
        "docs": "/docs",
        "version": "1.0.0",
    }


# ===== グローバルエラーハンドラー =====
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    予期しないエラーをキャッチして適切なレスポンスを返す
    本番環境ではエラー詳細を隠蔽
    """
    logger.error(f"予期しないエラー: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "サーバー内部エラーが発生しました",
            "error": str(exc) if settings.DEBUG else "内部エラー",
        }
    )


if __name__ == "__main__":
    import uvicorn
    # Termux環境での起動設定
    # --host 0.0.0.0: 全インターフェースで待ち受け（Tailscaleアクセスに必要）
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # 開発時のホットリロード
        log_level="info",
    )
