import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.config import settings
from app.models import ImageRecord, ImageQualityRecord, ImageEnhancementRecord, User
from app.services.quality_service import analyze_image_quality
from app.services.enhancement_service import apply_adaptive_enhancement
from app.dependencies import get_current_user

router = APIRouter(prefix="/enhancement", tags=["Adaptive Enhancement"])


@router.post("/images/{image_id}/enhance")
def enhance_image_endpoint(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    img = db.query(ImageRecord).filter(ImageRecord.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image not found")

    filename = os.path.basename(img.original_url)
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail=f"Image file not found on disk: {filename}")

    # Analyze quality if not already analyzed
    quality_rec = db.query(ImageQualityRecord).filter(ImageQualityRecord.image_id == image_id).first()
    if quality_rec:
        metrics = {
            "blur": quality_rec.blur,
            "brightness": quality_rec.brightness,
            "contrast": quality_rec.contrast,
            "glare": quality_rec.glare,
            "noise": quality_rec.noise,
            "overall_quality": quality_rec.overall_quality,
            "status": quality_rec.status
        }
    else:
        metrics = analyze_image_quality(filepath)

    res = apply_adaptive_enhancement(filepath, metrics)

    enhancement_rec = ImageEnhancementRecord(
        image_id=image_id,
        enhanced_url=res["enhanced_url"],
        operations_json=res["applied_operations"],
        quality_before=res["quality_before"],
        quality_after=res["quality_after"],
        ocr_confidence_before=res["ocr_confidence_before"],
        ocr_confidence_after=res["ocr_confidence_after"]
    )
    db.add(enhancement_rec)
    img.status = "ENHANCED"
    db.commit()
    db.refresh(enhancement_rec)

    return {
        "image_id": image_id,
        "enhanced_url": res["enhanced_url"],
        "applied_operations": res["applied_operations"],
        "quality_before": res["quality_before"],
        "quality_after": res["quality_after"],
        "ocr_confidence_before": res["ocr_confidence_before"],
        "ocr_confidence_after": res["ocr_confidence_after"]
    }
