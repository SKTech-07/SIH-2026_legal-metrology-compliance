from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Rule, User
from app.schemas import RuleOut
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/rules", tags=["Legal Metrology Rules"])


@router.get("", response_model=List[RuleOut])
def list_rules(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rules = db.query(Rule).all()
    return [RuleOut.model_validate(r) for r in rules]


@router.get("/{id}", response_model=RuleOut)
def get_rule(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = db.query(Rule).filter(Rule.id == id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    return RuleOut.model_validate(rule)
