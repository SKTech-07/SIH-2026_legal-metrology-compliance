from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.services.search_service import perform_global_search
from app.dependencies import get_current_user

router = APIRouter(prefix="/search", tags=["Global Search"])


@router.get("")
def search_global(q: str = Query(..., min_length=2), db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    return perform_global_search(db, q)
