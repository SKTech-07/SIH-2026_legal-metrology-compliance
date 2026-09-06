from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models import Inspection, Store, Product, Violation, Report


def perform_global_search(db: Session, query: str) -> Dict[str, List[Dict[str, Any]]]:
    """Global search across Inspections, Stores, Products, Violations, and Reports."""
    q = f"%{query}%"

    stores = db.query(Store).filter(
        (Store.name.ilike(q)) |
        (Store.license_number.ilike(q)) |
        (Store.city.ilike(q))
    ).limit(10).all()

    inspections = db.query(Inspection).filter(
        (Inspection.code.ilike(q)) |
        (Inspection.notes.ilike(q))
    ).limit(10).all()

    products = db.query(Product).filter(
        (Product.name.ilike(q)) |
        (Product.brand.ilike(q)) |
        (Product.barcode.ilike(q))
    ).limit(10).all()

    violations = db.query(Violation).filter(
        (Violation.description.ilike(q)) |
        (Violation.violation_type.ilike(q))
    ).limit(10).all()

    reports = db.query(Report).filter(
        Report.title.ilike(q)
    ).limit(10).all()

    return {
        "stores": [{"id": s.id, "name": s.name, "license": s.license_number, "city": s.city} for s in stores],
        "inspections": [{"id": i.id, "code": i.code, "status": i.status, "priority": i.priority} for i in inspections],
        "products": [{"id": p.id, "name": p.name, "category": p.category, "brand": p.brand} for p in products],
        "violations": [{"id": v.id, "type": v.violation_type, "severity": v.severity, "description": v.description} for v in violations],
        "reports": [{"id": r.id, "title": r.title, "format": r.report_format} for r in reports]
    }
