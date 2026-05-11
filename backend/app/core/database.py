# データベース接続モジュール
# SQLAlchemyを使用したPostgreSQL接続管理

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from typing import Generator

from app.core.config import settings

# データベースエンジンの作成
# pool_pre_ping: 接続の有効性を事前確認（長時間アイドル後の切断対策）
# pool_size: 接続プールのサイズ（Termux環境に合わせて小さめに設定）
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=settings.DEBUG,  # デバッグモード時にSQLクエリをログ出力
)

# セッションファクトリの作成
# autocommit=False: 明示的にcommit()を呼ぶ必要がある
# autoflush=False: flush()を明示的に呼ぶ必要がある
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ORMモデルの基底クラス
Base = declarative_base()


def get_db() -> Generator:
    """
    データベースセッションの依存性注入関数
    リクエスト毎に新しいセッションを作成し、終了後に自動でクローズする
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        # リクエスト終了後に必ずセッションをクローズ（リソースリーク防止）
        db.close()


def create_tables():
    """
    全テーブルを作成する（存在しない場合のみ）
    アプリケーション起動時に呼び出される
    """
    # インポートは循環参照を避けるためにここで行う
    from app.models import staff, product, table, session, order_item, stock_log, attendance, shift, staff_drink  # noqa: F401
    Base.metadata.create_all(bind=engine)
