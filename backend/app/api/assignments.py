import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import InspectionAssignment, Inspection, User
from app.schemas import AssignmentCreate, AssignmentOut
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/assignments", tags=["Assignments"])


@router.get("", response_model=List[AssignmentOut])
def list_assignments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(InspectionAssignment)
    if current_user.role_name == "INSPECTOR":
        query = query.filter(InspectionAssignment.inspector_id == current_user.id)

    assignments = query.all()
    results = []
    for a in assignments:
        out = AssignmentOut.model_validate(a)
        if a.inspector:
            out.inspector_name = a.inspector.full_name
        results.append(out)
    return results


@router.post("", response_model=AssignmentOut)
def create_assignment(
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inspectors:assign"))
):
    inspection = db.query(Inspection).filter(Inspection.id == payload.inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=44, detail="Inspection not found")

    inspector = db.query(User).filter(User.id == payload.inspector_id, User.role_name == "INSPECTOR").first()
    if not inspector:
        raise HTTPException(status_code=400, detail="Invalid Inspector ID specified")

    assignment = InspectionAssignment(
        inspection_id=payload.inspection_id,
        inspector_id=payload.inspector_id,
        assigned_by=current_user.id,
        status="ASSIGNED",
        priority=payload.priority,
        notes=payload.notes
    )
    inspection.status = "ASSIGNED"
    db.add(assignment)
    db.commit()
    db.refresh(assignment)

    out = AssignmentOut.model_validate(assignment)
    out.inspector_name = inspector.full_name
    return out


@router.post("/{assignment_id}/reassign", response_model=AssignmentOut)
def reassign_inspection(
    assignment_id: str,
    new_inspector_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inspectors:reassign"))
):
    assignment = db.query(InspectionAssignment).filter(InspectionAssignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    new_inspector = db.query(User).filter(User.id == new_inspector_id, User.role_name == "INSPECTOR").first()
    if not new_inspector:
        raise HTTPException(status_code=400, detail="New inspector not found")

    assignment.inspector_id = new_inspector_id
    assignment.assigned_by = current_user.id
    assignment.assigned_at = datetime.datetime.utcnow()
    assignment.status = "REASSIGNED"
    db.commit()
    db.refresh(assignment)

    out = AssignmentOut.model_validate(assignment)
    out.inspector_name = new_inspector.full_name
    return out
