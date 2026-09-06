import uuid
import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Inspection, InspectionAssignment, Store, User, Product, Violation
from app.schemas import InspectionCreate, InspectionOut
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/inspections", tags=["Inspections"])


@router.get("", response_model=List[InspectionOut])
def list_inspections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role_name == "INSPECTOR":
        # Inspector only sees assigned inspections
        assignments = db.query(InspectionAssignment).filter(
            InspectionAssignment.inspector_id == current_user.id
        ).all()
        assigned_ids = [a.inspection_id for a in assignments]
        query = db.query(Inspection).filter(Inspection.id.in_(assigned_ids))
    else:
        # Admin sees all inspections
        query = db.query(Inspection)

    inspections = query.order_by(Inspection.created_at.desc()).all()
    results = []
    for ins in inspections:
        out = InspectionOut.model_validate(ins)
        if ins.store:
            out.store_name = ins.store.name

        # Attach assignment info
        active_assignment = db.query(InspectionAssignment).filter(
            InspectionAssignment.inspection_id == ins.id
        ).order_by(InspectionAssignment.assigned_at.desc()).first()
        if active_assignment and active_assignment.inspector:
            out.assigned_inspector_id = active_assignment.inspector_id
            out.assigned_inspector_name = active_assignment.inspector.full_name

        out.product_count = db.query(Product).filter(Product.inspection_id == ins.id).count()
        out.violation_count = db.query(Violation).filter(Violation.inspection_id == ins.id).count()
        results.append(out)

    return results


@router.post("", response_model=InspectionOut)
def create_inspection(
    payload: InspectionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inspections:create"))
):
    store = db.query(Store).filter(Store.id == payload.store_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    code = f"INS-2026-{str(uuid.uuid4().int)[:5]}"
    inspection = Inspection(
        code=code,
        store_id=payload.store_id,
        created_by=current_user.id,
        status="UNASSIGNED" if not payload.inspector_id else "ASSIGNED",
        priority=payload.priority,
        due_date=payload.due_date,
        notes=payload.notes
    )
    db.add(inspection)
    db.flush()

    if payload.inspector_id:
        assignment = InspectionAssignment(
            inspection_id=inspection.id,
            inspector_id=payload.inspector_id,
            assigned_by=current_user.id,
            status="ASSIGNED",
            priority=payload.priority
        )
        db.add(assignment)

    db.commit()
    db.refresh(inspection)

    out = InspectionOut.model_validate(inspection)
    out.store_name = store.name
    return out


@router.get("/{id}", response_model=InspectionOut)
def get_inspection(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    inspection = db.query(Inspection).filter(Inspection.id == id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Access check for Inspector
    if current_user.role_name == "INSPECTOR":
        assigned = db.query(InspectionAssignment).filter(
            InspectionAssignment.inspection_id == id,
            InspectionAssignment.inspector_id == current_user.id
        ).first()
        if not assigned:
            raise HTTPException(status_code=403, detail="Forbidden: You are not assigned to this inspection")

    out = InspectionOut.model_validate(inspection)
    if inspection.store:
        out.store_name = inspection.store.name

    active_assignment = db.query(InspectionAssignment).filter(
        InspectionAssignment.inspection_id == inspection.id
    ).order_by(InspectionAssignment.assigned_at.desc()).first()
    if active_assignment and active_assignment.inspector:
        out.assigned_inspector_id = active_assignment.inspector_id
        out.assigned_inspector_name = active_assignment.inspector.full_name

    out.product_count = db.query(Product).filter(Product.inspection_id == inspection.id).count()
    out.violation_count = db.query(Violation).filter(Violation.inspection_id == inspection.id).count()
    return out


@router.post("/{id}/start")
def start_inspection(id: str, db: Session = Depends(get_db), current_user: User = Depends(require_permission("inspections:start"))):
    inspection = db.query(Inspection).filter(Inspection.id == id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    inspection.status = "IN_PROGRESS"
    assignment = db.query(InspectionAssignment).filter(
        InspectionAssignment.inspection_id == id,
        InspectionAssignment.inspector_id == current_user.id
    ).first()
    if assignment:
        assignment.status = "IN_PROGRESS"
        assignment.started_at = datetime.datetime.utcnow()

    db.commit()
    return {"message": f"Inspection {inspection.code} started successfully.", "status": "IN_PROGRESS"}


@router.post("/{id}/complete")
def complete_inspection(id: str, db: Session = Depends(get_db), current_user: User = Depends(require_permission("inspections:complete_assigned"))):
    inspection = db.query(Inspection).filter(Inspection.id == id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Check if all products in inspection are finished
    products = db.query(Product).filter(Product.inspection_id == id).all()
    incomplete = [p for p in products if p.status in ["NOT_STARTED", "IN_PROGRESS"]]
    if incomplete:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot complete inspection. {len(incomplete)} product(s) are incomplete."
        )

    inspection.status = "COMPLETED"
    inspection.completed_at = datetime.datetime.utcnow()

    assignment = db.query(InspectionAssignment).filter(
        InspectionAssignment.inspection_id == id,
        InspectionAssignment.inspector_id == current_user.id
    ).first()
    if assignment:
        assignment.status = "COMPLETED"
        assignment.completed_at = datetime.datetime.utcnow()

    db.commit()
    return {"message": f"Inspection {inspection.code} completed successfully.", "status": "COMPLETED"}
