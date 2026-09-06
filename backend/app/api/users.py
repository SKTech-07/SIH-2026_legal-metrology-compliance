from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import User
from app.schemas import UserOut, UserCreate
from app.services.auth_service import hash_password
from app.dependencies import require_permission

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserOut])
def list_users(
    role: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:view"))
):
    query = db.query(User)
    if role:
        query = query.filter(User.role_name == role.upper())
    return [UserOut.model_validate(u) for u in query.all()]


@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("users:create"))
):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role_name=payload.role_name.upper()
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
