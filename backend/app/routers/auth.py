# 認証ルーター
# ログイン・ログアウト・現在ユーザー取得

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.deps import get_current_user
from app.models.staff import Staff
from app.schemas.auth import LoginRequest, Token
from app.schemas.staff import StaffResponse

router = APIRouter()


@router.post("/login", response_model=Token, summary="スタッフログイン")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    スタッフ名とパスワードでログインしてJWTトークンを取得する

    - スタッフ名で検索（大文字小文字区別なし）
    - パスワードをbcryptで照合
    - 成功時はJWTアクセストークンを返す
    """
    # スタッフ名でユーザーを検索（退職済みは除外）
    staff = db.query(Staff).filter(
        Staff.name == request.username,
        Staff.is_active == True  # noqa: E712
    ).first()

    # スタッフが見つからない、またはパスワードが間違っている場合
    if not staff or not staff.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="スタッフ名またはパスワードが間違っています",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # パスワード照合
    if not verify_password(request.password, staff.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="スタッフ名またはパスワードが間違っています",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # JWTトークンを生成（スタッフIDをsubクレームに格納）
    access_token = create_access_token(
        data={
            "sub": str(staff.id),
            "name": staff.name,
            "role": staff.role,
        }
    )

    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=StaffResponse, summary="現在のユーザー情報取得")
def get_me(current_user: Staff = Depends(get_current_user)):
    """
    現在ログイン中のスタッフ情報を返す
    フロントエンドのプロフィール表示に使用
    """
    return current_user
