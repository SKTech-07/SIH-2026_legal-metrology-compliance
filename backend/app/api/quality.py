import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.config import settings
from app.models import ImageRecord, ImageQualityRecord, User
from app.schemas import ImageQualityOut
from app.services.quality_service import analyze_image_quality
from app.dependencies import get_current_user

router = APIRouter(prefix="/quality", tags=["Image Quality"])


@router.post("/images/{image_id}/analyze", response_model=ImageQualityOut)
def analyze_quality_endpoint(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    img = db.query(ImageRecord).filter(ImageRecord.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image record not found")

    filename = os.path.basename(img.original_url)
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    if not os.path.exists(filepath):
        # Fallback if mock filename
        raise HTTPException(status_code=404, detail=f"Image file not found on disk: {filename}")

    metrics = analyze_image_quality(filepath)

    existing = db.query(ImageQualityRecord).filter(ImageQualityRecord.image_id == image_id).first()
    if existing:
        for k, v in metrics.items():
            setattr(existing, k, v)
        quality_rec = existing
    else:
        quality_rec = ImageQualityRecord(image_id=image_id, **metrics)
        db.add(quality_rec)

    img.status = "ANALYZED"
    db.commit()
    db.refresh(quality_rec)
    return ImageQualityOut.model_validate(quality_rec)
