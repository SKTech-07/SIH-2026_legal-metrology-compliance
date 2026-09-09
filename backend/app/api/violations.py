import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Violation, Evidence, Product, Rule, ReviewTask, User, ComplianceResult
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


def _sync_compliance_status(db: Session, product: Product, rule_id: str, new_comp_status: str):
    comp_res = db.query(ComplianceResult).filter(
        ComplianceResult.product_id == product.id,
        ComplianceResult.rule_id == rule_id
    ).first()
    
    old_comp_status = comp_res.status if comp_res else "UNKNOWN"
    if comp_res:
        comp_res.status = new_comp_status

    all_results = db.query(ComplianceResult).filter(ComplianceResult.product_id == product.id).all()
    has_fail = any(r.status == "FAIL" for r in all_results)
    has_review = any(r.status == "REVIEW" for r in all_results)
    
    old_prod_status = product.status
    if has_fail:
        product.status = "FAIL"
    elif has_review:
        product.status = "REVIEW"
    else:
        product.status = "PASS"
        
    print(f"[HUMAN-REVIEW] Action resolved rule {rule_id} for product {product.id}")
    print(f"[HUMAN-REVIEW] ComplianceResult: {old_comp_status} -> {new_comp_status}")
    print(f"[HUMAN-REVIEW] Remaining unpassed rules: {[r.rule_id for r in all_results if r.status != 'PASS']}")
    print(f"[HUMAN-REVIEW] Overall product status: {old_prod_status} -> {product.status}")


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

    if v.product and v.rule_id:
        _sync_compliance_status(db, v.product, v.rule_id, "FAIL")

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

    if v.product and v.rule_id:
        _sync_compliance_status(db, v.product, v.rule_id, "PASS")

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

    if v.product and v.rule_id:
        _sync_compliance_status(db, v.product, v.rule_id, "REVIEW")

    db.commit()
    return {"message": "Reinspection requested", "status": "REINSPECTION_REQUESTED"}
