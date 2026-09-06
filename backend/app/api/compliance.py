import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.models import Product, Declaration, Rule, ComplianceResult, Violation, Evidence, User
from app.schemas import ComplianceResultOut
from app.rules.engine import LegalMetrologyRuleEngine
from app.services.evidence_service import generate_annotated_evidence
from app.dependencies import get_current_user

router = APIRouter(prefix="/compliance", tags=["Compliance Engine"])


@router.post("/products/{product_id}/evaluate", response_model=List[ComplianceResultOut])
def evaluate_product_compliance(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    declarations = db.query(Declaration).filter(Declaration.product_id == product_id).all()
    decl_dicts = [
        {
            "id": d.id,
            "declaration_type": d.declaration_type,
            "raw_text": d.raw_text,
            "normalized_value": d.normalized_value,
            "confidence": d.confidence,
            "bbox": d.bbox_json,
            "source_image_id": d.source_image_id
        }
        for d in declarations
    ]

    engine = LegalMetrologyRuleEngine()
    eval_results = engine.evaluate_product_declarations(product.category, decl_dicts)

    # Delete existing compliance results for fresh evaluation
    db.query(ComplianceResult).filter(ComplianceResult.product_id == product_id).delete()
    db.commit()

    saved_results = []
    has_fail = False
    has_review = False

    for item in eval_results:
        rule_code = item["rule_code"]
        rule_obj = db.query(Rule).filter(Rule.code == rule_code).first()
        if not rule_obj:
            rule_obj = Rule(
                code=rule_code,
                name=item["rule_name"],
                declaration_type=item["declaration_type"],
                requirement=item["expected_value"],
                severity=item["severity"]
            )
            db.add(rule_obj)
            db.flush()

        # Find matching declaration if any
        matching_decl = next((d for d in declarations if d.declaration_type == item["declaration_type"]), None)

        comp_res = ComplianceResult(
            product_id=product_id,
            declaration_id=matching_decl.id if matching_decl else None,
            rule_id=rule_obj.id,
            status=item["status"],
            detected_value=item["detected_value"],
            expected_value=item["expected_value"],
            confidence=item["confidence"],
            reason=item["reason"]
        )
        db.add(comp_res)
        db.flush()

        if item["status"] == "FAIL":
            has_fail = True
            # Create Violation and Evidence
            viol = db.query(Violation).filter(
                Violation.product_id == product_id,
                Violation.rule_id == rule_obj.id
            ).first()
            if not viol:
                viol = Violation(
                    inspection_id=product.inspection_id,
                    product_id=product_id,
                    declaration_id=matching_decl.id if matching_decl else None,
                    rule_id=rule_obj.id,
                    violation_type="MISSING_DECLARATION" if "missing" in item["reason"].lower() else "INCORRECT_VALUE",
                    severity=item["severity"],
                    description=item["reason"],
                    ai_confidence=item["confidence"],
                    status="PENDING"
                )
                db.add(viol)
                db.flush()

                # Generate Annotated Evidence
                bbox = matching_decl.bbox_json if matching_decl and matching_decl.bbox_json else [100, 100, 300, 100]
                img_path = "storage_data/uploads/sample.jpg"  # Default reference
                annotated_url = generate_annotated_evidence(img_path, bbox, label=rule_code)

                db.add(Evidence(
                    violation_id=viol.id,
                    image_id=matching_decl.source_image_id if matching_decl else None,
                    annotated_image_url=annotated_url or "/api/v1/images/file/sample_evidence.jpg",
                    ocr_text=item["detected_value"],
                    english_text=item["detected_value"],
                    bbox_json=bbox,
                    rule_id=rule_obj.id
                ))

        elif item["status"] == "REVIEW":
            has_review = True

        out = ComplianceResultOut.model_validate(comp_res)
        out.rule_code = rule_obj.code
        out.rule_name = rule_obj.name
        saved_results.append(out)

    # Update overall product status
    if has_fail:
        product.status = "FAIL"
    elif has_review:
        product.status = "REVIEW"
    else:
        product.status = "PASS"

    db.commit()
    return saved_results


@router.get("/products/{product_id}", response_model=List[ComplianceResultOut])
def get_product_compliance(
    product_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    results = db.query(ComplianceResult).filter(ComplianceResult.product_id == product_id).all()
    output = []
    for r in results:
        out = ComplianceResultOut.model_validate(r)
        if r.rule_id:
            rule = db.query(Rule).filter(Rule.id == r.rule_id).first()
            if rule:
                out.rule_code = rule.code
                out.rule_name = rule.name
        output.append(out)
    return output
