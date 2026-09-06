from typing import Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Inspection, Product, Violation, User, Store
from app.dependencies import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
def get_dashboard_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> Dict[str, Any]:
    total_inspections = db.query(Inspection).count()
    completed_inspections = db.query(Inspection).filter(Inspection.status == "COMPLETED").count()
    in_progress_inspections = db.query(Inspection).filter(Inspection.status == "IN_PROGRESS").count()
    unassigned_inspections = db.query(Inspection).filter(Inspection.status == "UNASSIGNED").count()

    total_inspectors = db.query(User).filter(User.role_name == "INSPECTOR", User.is_active == True).count()
    total_stores = db.query(Store).count()

    total_products = db.query(Product).count()
    passed_products = db.query(Product).filter(Product.status == "PASS").count()
    failed_products = db.query(Product).filter(Product.status == "FAIL").count()
    review_products = db.query(Product).filter(Product.status == "REVIEW").count()

    total_violations = db.query(Violation).count()
    pending_violations = db.query(Violation).filter(Violation.status == "PENDING").count()
    confirmed_violations = db.query(Violation).filter(Violation.status == "CONFIRMED").count()

    compliance_rate = round((passed_products / total_products * 100.0), 1) if total_products > 0 else 100.0

    # Calculate real compliance trends grouped by month
    from collections import defaultdict
    import calendar
    from sqlalchemy import func
    
    products_for_trends = db.query(Product.created_at, Product.status).all()
    trend_dict = defaultdict(lambda: {"passed": 0, "failed": 0, "review": 0})
    
    for p_created, p_status in products_for_trends:
        if p_created:
            month_abbr = calendar.month_abbr[p_created.month]
            year = p_created.year
            month_key = f"{month_abbr} {year}"
            if p_status == "PASS":
                trend_dict[month_key]["passed"] += 1
            elif p_status == "FAIL":
                trend_dict[month_key]["failed"] += 1
            elif p_status == "REVIEW":
                trend_dict[month_key]["review"] += 1

    compliance_trends = []
    for m_key, counts in trend_dict.items():
        compliance_trends.append({
            "month": m_key,
            "passed": counts["passed"],
            "failed": counts["failed"],
            "review": counts["review"]
        })

    # If no records exist, return an empty array for trends instead of fake data.
    
    # Calculate real violation breakdown
    violation_counts = db.query(Violation.violation_type, func.count(Violation.id)).group_by(Violation.violation_type).all()
    violation_breakdown = [
        {"name": v_type if v_type else "Unknown", "count": count} for v_type, count in violation_counts
    ]

    return {
        "kpis": {
            "total_inspections": total_inspections,
            "completed_inspections": completed_inspections,
            "in_progress_inspections": in_progress_inspections,
            "unassigned_inspections": unassigned_inspections,
            "total_inspectors": total_inspectors,
            "total_stores": total_stores,
            "total_products": total_products,
            "passed_products": passed_products,
            "failed_products": failed_products,
            "review_products": review_products,
            "total_violations": total_violations,
            "pending_violations": pending_violations,
            "confirmed_violations": confirmed_violations,
            "compliance_rate": compliance_rate
        },
        "compliance_trends": compliance_trends,
        "violation_breakdown": violation_breakdown
    }
