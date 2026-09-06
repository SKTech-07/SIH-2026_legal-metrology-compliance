from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Declaration, Product, User
from app.schemas import DeclarationOut, DeclarationUpdate
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/declarations", tags=["Declarations"])


@router.get("/products/{product_id}", response_model=List[DeclarationOut])
def get_product_declarations(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    decls = db.query(Declaration).filter(Declaration.product_id == product_id).all()
    return [DeclarationOut.model_validate(d) for d in decls]


@router.put("/{id}", response_model=DeclarationOut)
def update_declaration(
    id: str,
    payload: DeclarationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("declarations:edit"))
):
    decl = db.query(Declaration).filter(Declaration.id == id).first()
    if not decl:
        raise HTTPException(status_code=404, detail="Declaration not found")

    decl.normalized_value = payload.normalized_value
    decl.verification_status = payload.verification_status
    db.commit()
    db.refresh(decl)
    return DeclarationOut.model_validate(decl)


@router.post("/{id}/verify", response_model=DeclarationOut)
def verify_declaration(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("declarations:verify"))
):
    decl = db.query(Declaration).filter(Declaration.id == id).first()
    if not decl:
        raise HTTPException(status_code=404, detail="Declaration not found")

    decl.verification_status = "VERIFIED"
    db.commit()
    db.refresh(decl)
    return DeclarationOut.model_validate(decl)
