# 商品ルーター
# 商品のCRUDと在庫管理

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_manager_or_above
from app.models.staff import Staff
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter()


@router.get("/", response_model=List[ProductResponse], summary="商品一覧取得")
def list_products(
    category: Optional[str] = Query(None, description="カテゴリでフィルター"),
    active_only: bool = Query(True, description="販売中商品のみ"),
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    商品一覧を返す
    カテゴリでのフィルター、在庫アラートフラグ付き
    """
    query = db.query(Product)

    # 販売中商品のみフィルター
    if active_only:
        query = query.filter(Product.is_active == True)  # noqa: E712

    # カテゴリフィルター
    if category:
        query = query.filter(Product.category == category)

    products = query.order_by(Product.category, Product.name).all()

    # 在庫アラートフラグを追加
    result = []
    for product in products:
        product_dict = ProductResponse.model_validate(product)
        product_dict.is_low_stock = product.stock_qty <= product.alert_qty
        result.append(product_dict)

    return result


@router.get("/categories", response_model=List[str], summary="商品カテゴリ一覧取得")
def list_categories(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    rows = db.query(Product.category).filter(Product.is_active == True, Product.category != None).distinct().all()  # noqa: E711,E712
    return sorted([r[0] for r in rows if r[0]])


@router.get("/low-stock", response_model=List[ProductResponse], summary="在庫アラート商品一覧")
def get_low_stock_products(
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    在庫がアラート数量以下の商品を返す
    ダッシュボードの在庫アラート表示に使用
    """
    products = db.query(Product).filter(
        Product.is_active == True,  # noqa: E712
        Product.stock_qty <= Product.alert_qty
    ).order_by(Product.stock_qty).all()

    result = []
    for product in products:
        product_dict = ProductResponse.model_validate(product)
        product_dict.is_low_stock = True
        result.append(product_dict)

    return result


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED, summary="商品登録")
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above)  # マネージャー以上
):
    """
    新商品を登録する
    マネージャー権限が必要
    """
    # 同名商品のチェック
    existing = db.query(Product).filter(
        Product.name == product_data.name,
        Product.is_active == True  # noqa: E712
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"商品名 '{product_data.name}' は既に登録されています"
        )

    new_product = Product(**product_data.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)

    result = ProductResponse.model_validate(new_product)
    result.is_low_stock = new_product.stock_qty <= new_product.alert_qty
    return result


@router.get("/{product_id}", response_model=ProductResponse, summary="商品詳細取得")
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_user)
):
    """
    指定した商品の詳細情報を返す
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"商品ID {product_id} が見つかりません"
        )

    result = ProductResponse.model_validate(product)
    result.is_low_stock = product.stock_qty <= product.alert_qty
    return result


@router.put("/{product_id}", response_model=ProductResponse, summary="商品情報更新")
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above)  # マネージャー以上
):
    """
    商品情報を更新する
    マネージャー権限が必要
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"商品ID {product_id} が見つかりません"
        )

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    result = ProductResponse.model_validate(product)
    result.is_low_stock = product.stock_qty <= product.alert_qty
    return result


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT, summary="商品削除（論理削除）")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: Staff = Depends(get_current_manager_or_above)  # マネージャー以上
):
    """
    商品を論理削除する（is_active=False に設定）
    注文履歴の整合性を保つため物理削除は行わない
    マネージャー権限が必要
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"商品ID {product_id} が見つかりません"
        )

    product.is_active = False
    db.commit()
