import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.config import settings
from app.models import Report, ReportProduct, Inspection, Store, Product, Violation, Rule, User
from app.schemas import ReportCreate, ReportOut
from app.services.report_service import generate_pdf_report, generate_json_report, generate_csv_report
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.post("", response_model=ReportOut)
def generate_report_endpoint(
    payload: ReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reports:create"))
):
    inspection = db.query(Inspection).filter(Inspection.id == payload.inspection_id).first()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    store = db.query(Store).filter(Store.id == inspection.store_id).first()
    store_info = {
        "name": store.name if store else "N/A",
        "license_number": store.license_number if store else "N/A",
        "city": store.city if store else "",
        "state": store.state if store else ""
    }

    # Fetch selected products subset
    selected_products = db.query(Product).filter(
        Product.id.in_(payload.selected_product_ids),
        Product.inspection_id == payload.inspection_id
    ).all()

    if not selected_products:
        raise HTTPException(status_code=400, detail="No valid products selected for report")

    products_data = [
        {
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "barcode": p.barcode,
            "status": p.status
        }
        for p in selected_products
    ]

    # Fetch violations for selected products
    violations = db.query(Violation).filter(
        Violation.product_id.in_(payload.selected_product_ids)
    ).all()

    violations_data = []
    for v in violations:
        rule_code = "LM-RULE"
        if v.rule_id:
            rule = db.query(Rule).filter(Rule.id == v.rule_id).first()
            if rule:
                rule_code = rule.code

        evidence_url = None
        if v.evidence and len(v.evidence) > 0:
            evidence_url = v.evidence[0].annotated_image_url

        violations_data.append({
            "id": v.id,
            "product_name": v.product.name if v.product else "N/A",
            "rule_code": rule_code,
            "violation_type": v.violation_type,
            "severity": v.severity,
            "status": v.status,
            "description": v.description,
            "evidence_url": evidence_url
        })

    fmt = payload.report_format.upper()
    if fmt == "JSON":
        file_url = generate_json_report(inspection.code, store_info, current_user.full_name, products_data, violations_data)
    elif fmt == "CSV":
        file_url = generate_csv_report(inspection.code, store_info, current_user.full_name, products_data, violations_data)
    else:
        file_url = generate_pdf_report(inspection.code, store_info, current_user.full_name, products_data, violations_data)

    report = Report(
        inspection_id=payload.inspection_id,
        generated_by=current_user.id,
        title=payload.title,
        report_format=fmt,
        file_url=file_url
    )
    db.add(report)
    db.flush()

    for p in selected_products:
        db.add(ReportProduct(report_id=report.id, product_id=p.id))

    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report)


@router.get("", response_model=List[ReportOut])
def list_reports(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reports = db.query(Report).order_by(Report.created_at.desc()).all()
    return [ReportOut.model_validate(r) for r in reports]


@router.get("/file/{filename}")
def download_report_file(filename: str):
    path = os.path.join(settings.REPORT_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Report file not found")
    return FileResponse(path, filename=filename)
