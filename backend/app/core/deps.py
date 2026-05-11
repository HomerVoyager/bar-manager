# 依存性注入モジュール
# FastAPIの依存性注入システムを使った認証・認可の実装

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_token
from app.models.staff import Staff

# Bearer認証スキーム
security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Staff:
    """
    現在の認証ユーザーを取得する依存性関数
    JWTトークンを検証し、対応するスタッフモデルを返す

    Args:
        credentials: HTTPベアラートークン
        db: データベースセッション

    Returns:
        認証済みのStaffモデルインスタンス

    Raises:
        HTTPException 401: トークンが無効またはユーザーが見つからない場合
    """
    # トークンのデコード（無効な場合はdecode_token内で例外を発生）
    payload = decode_token(credentials.credentials)

    # ペイロードからスタッフIDを取得
    staff_id: int = payload.get("sub")
    if staff_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="認証情報が無効です",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # データベースからスタッフ情報を取得
    staff = db.query(Staff).filter(
        Staff.id == int(staff_id),
        Staff.is_active == True  # noqa: E712 退職済みスタッフはアクセス不可
    ).first()

    if staff is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="スタッフが見つかりません",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return staff


def get_current_master(
    current_user: Staff = Depends(get_current_user)
) -> Staff:
    """マスター権限のみ許可"""
    if current_user.role != "master":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この操作にはマスター権限が必要です",
        )
    return current_user


def get_current_manager_or_above(
    current_user: Staff = Depends(get_current_user)
) -> Staff:
    """マネージャー以上（master / manager）を許可"""
    if current_user.role not in ("master", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この操作にはマネージャー権限が必要です",
        )
    return current_user


def get_current_manager(
    current_user: Staff = Depends(get_current_user)
) -> Staff:
    """後方互換: manager のみ許可（既存コードが参照するため残す）"""
    if current_user.role not in ("master", "manager"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="この操作にはマネージャー権限が必要です",
        )
    return current_user
