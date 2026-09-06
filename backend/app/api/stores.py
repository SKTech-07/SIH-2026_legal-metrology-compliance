from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Store, User
from app.schemas import StoreCreate, StoreOut
from app.dependencies import get_current_user

router = APIRouter(prefix="/stores", tags=["Stores"])


@router.get("", response_model=List[StoreOut])
def list_stores(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    stores = db.query(Store).all()
    return [StoreOut.model_validate(s) for s in stores]


@router.post("", response_model=StoreOut)
def create_store(payload: StoreCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Store).filter(Store.license_number == payload.license_number).first()
    if existing:
        raise HTTPException(status_code=400, detail="Store with this license number already exists")

    store = Store(**payload.model_dump())
    db.add(store)
    db.commit()
    db.refresh(store)
    return StoreOut.model_validate(store)
