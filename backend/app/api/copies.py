from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Product, ProductCopy, User
from app.schemas import ProductCopyOut
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="", tags=["Product Copies"])


@router.post("/products/{product_id}/copies", response_model=ProductCopyOut)
def add_product_copy(
    product_id: str,
    barcode_scanned: str = None,
    notes: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("products:update"))
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    existing_copies = db.query(ProductCopy).filter(ProductCopy.product_id == product_id).all()
    if len(existing_copies) >= 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum physical product copies limit reached (Maximum 5 copies per product under Legal Metrology compliance regulations)."
        )

    next_number = len(existing_copies) + 1
    new_copy = ProductCopy(
        product_id=product_id,
        copy_number=next_number,
        barcode_scanned=barcode_scanned,
        notes=notes,
        status="ACTIVE"
    )
    db.add(new_copy)
    db.commit()
    db.refresh(new_copy)
    return ProductCopyOut.model_validate(new_copy)


@router.get("/products/{product_id}/copies", response_model=List[ProductCopyOut])
def get_product_copies(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    copies = db.query(ProductCopy).filter(ProductCopy.product_id == product_id).all()
    return [ProductCopyOut.model_validate(c) for c in copies]
