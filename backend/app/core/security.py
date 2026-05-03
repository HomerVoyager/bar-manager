# セキュリティモジュール
# JWT認証とパスワードハッシュの管理

from datetime import datetime, timedelta
from typing import Optional, Union
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status

from app.core.config import settings

# パスワードハッシュコンテキスト（pbkdf2_sha256使用、純粋Python）
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    平文パスワードとハッシュを照合する
    ログイン認証時に使用
    """
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """
    パスワードをbcryptでハッシュ化する
    スタッフ作成・パスワード変更時に使用
    """
    return pwd_context.hash(password)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    JWTアクセストークンを生成する

    Args:
        data: トークンに埋め込むペイロードデータ
        expires_delta: トークンの有効期限（デフォルト: 設定値を使用）

    Returns:
        エンコードされたJWTトークン文字列
    """
    to_encode = data.copy()

    # 有効期限の設定
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # デフォルト: 設定ファイルの値を使用（8時間）
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({"exp": expire})

    # JWTトークンを生成
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def decode_token(token: str) -> dict:
    """
    JWTトークンをデコードしてペイロードを返す

    Args:
        token: デコードするJWTトークン

    Returns:
        デコードされたペイロード辞書

    Raises:
        HTTPException: トークンが無効または期限切れの場合
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="認証情報が無効です",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        raise credentials_exception
