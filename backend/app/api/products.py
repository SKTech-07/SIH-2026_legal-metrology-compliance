from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Product, ProductCopy, User
from app.schemas import ProductCreate, ProductOut, ProductCopyOut
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("/inspections/{inspection_id}/products", response_model=ProductOut)
def create_product(
    inspection_id: str,
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:create"))
):
    product = Product(
        inspection_id=inspection_id,
        name=payload.name,
        category=payload.category,
        brand=payload.brand,
        variant=payload.variant,
        barcode=payload.barcode,
        status="NOT_STARTED"
    )
    db.add(product)
    db.flush()

    # Automatically create Copy #1 for the product
    copy1 = ProductCopy(
        product_id=product.id,
        copy_number=1,
        barcode_scanned=payload.barcode,
        status="ACTIVE"
    )
    db.add(copy1)
    db.commit()
    db.refresh(product)

    copies = db.query(ProductCopy).filter(ProductCopy.product_id == product.id).all()
    out = ProductOut.model_validate(product)
    out.copy_count = len(copies)
    out.copies = [ProductCopyOut.model_validate(c) for c in copies]
    return out


@router.get("/inspections/{inspection_id}/products", response_model=List[ProductOut])
def list_products(
    inspection_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    products = db.query(Product).filter(Product.inspection_id == inspection_id).all()
    results = []
    for p in products:
        copies = db.query(ProductCopy).filter(ProductCopy.product_id == p.id).all()
        out = ProductOut.model_validate(p)
        out.copy_count = len(copies)
        out.copies = [ProductCopyOut.model_validate(c) for c in copies]
        results.append(out)
    return results


@router.get("/{id}", response_model=ProductOut)
def get_product(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    copies = db.query(ProductCopy).filter(ProductCopy.product_id == product.id).all()
    out = ProductOut.model_validate(product)
    out.copy_count = len(copies)
    out.copies = [ProductCopyOut.model_validate(c) for c in copies]
    return out
