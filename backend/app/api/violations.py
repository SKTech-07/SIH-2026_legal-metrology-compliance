import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Violation, Evidence, Product, Rule, ReviewTask, User
from app.schemas import ViolationOut, EvidenceOut, ReviewActionRequest
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/violations", tags=["Violations & Evidence"])


@router.get("", response_model=List[ViolationOut])
def list_violations(
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Violation)
    if status:
        query = query.filter(Violation.status == status.upper())

    violations = query.order_by(Violation.created_at.desc()).all()
    results = []
    for v in violations:
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


@router.get("/{id}", response_model=ViolationOut)
def get_violation(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    v = db.query(Violation).filter(Violation.id == id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")

    out = ViolationOut.model_validate(v)
    if v.product:
        out.product_name = v.product.name
    if v.rule_id:
        rule = db.query(Rule).filter(Rule.id == v.rule_id).first()
        if rule:
            out.rule_code = rule.code

    ev_list = db.query(Evidence).filter(Evidence.violation_id == v.id).all()
    out.evidence = [EvidenceOut.model_validate(e) for e in ev_list]
    return out


@router.post("/{id}/confirm")
def confirm_violation(
    id: str,
    payload: ReviewActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("violations:confirm"))
):
    v = db.query(Violation).filter(Violation.id == id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")

    v.status = "CONFIRMED"

    # Log review task action
    task = ReviewTask(
        violation_id=id,
        assigned_user_id=current_user.id,
        status="CONFIRMED",
        action_taken="CONFIRM_VIOLATION",
        reviewer_comment=payload.comment,
        decision_timestamp=datetime.datetime.utcnow()
    )
    db.add(task)

    # Mark product as FAIL
    if v.product:
        v.product.status = "FAIL"

    db.commit()
    return {"message": "Violation confirmed successfully", "status": "CONFIRMED"}


@router.post("/{id}/reject")
def reject_violation(
    id: str,
    payload: ReviewActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("violations:reject"))
):
    v = db.query(Violation).filter(Violation.id == id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")

    v.status = "REJECTED"

    task = ReviewTask(
        violation_id=id,
        assigned_user_id=current_user.id,
        status="REJECTED",
        action_taken="REJECT_VIOLATION",
        reviewer_comment=payload.comment,
        decision_timestamp=datetime.datetime.utcnow()
    )
    db.add(task)

    # Check if remaining violations exist for product
    other = db.query(Violation).filter(
        Violation.product_id == v.product_id,
        Violation.id != id,
        Violation.status == "CONFIRMED"
    ).first()
    if not other and v.product:
        v.product.status = "PASS"

    db.commit()
    return {"message": "Violation rejected", "status": "REJECTED"}


@router.post("/{id}/reinspect")
def request_reinspection(
    id: str,
    payload: ReviewActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reinspection:request"))
):
    v = db.query(Violation).filter(Violation.id == id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Violation not found")

    v.status = "REINSPECTION_REQUESTED"

    task = ReviewTask(
        violation_id=id,
        assigned_user_id=current_user.id,
        status="REINSPECTED",
        action_taken="REQUEST_REINSPECTION",
        reviewer_comment=payload.comment,
        decision_timestamp=datetime.datetime.utcnow()
    )
    db.add(task)

    if v.product:
        v.product.status = "REVIEW"

    db.commit()
    return {"message": "Reinspection requested", "status": "REINSPECTION_REQUESTED"}
