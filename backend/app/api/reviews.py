from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Violation, Product, Rule, Evidence, User
from app.schemas import ViolationOut, EvidenceOut
from app.dependencies import get_current_user

router = APIRouter(prefix="/reviews", tags=["Human Review Workflow"])


@router.get("/pending", response_model=List[ViolationOut])
def get_pending_reviews(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """List all violations & product compliance items requiring human review decision."""
    pending_violations = db.query(Violation).filter(
        Violation.status.in_(["PENDING", "REINSPECTION_REQUESTED"])
    ).order_by(Violation.created_at.desc()).all()

    results = []
    for v in pending_violations:
        out = ViolationOut.model_validate(v)
        if v.product:
            out.product_name = v.product.name
        if v.rule_id:
            rule = db.query(Rule).filter(Rule.id == v.rule_id).first()
            if rule:
                out.rule_code = rule.code

        ev_list = db.query(Evidence).filter(Evidence.violation_id == v.id).all()
        out.evidence = [EvidenceOut.model_validate(e) for e in ev_list]
        results.append(out)

    return results
