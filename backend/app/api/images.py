import os
import uuid
import hashlib
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.config import settings
from app.models import ImageRecord, ProductCopy, User
from app.schemas import ImageOut
from app.dependencies import get_current_user, require_permission

router = APIRouter(prefix="/images", tags=["Images"])

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}


@router.post("/copies/{copy_id}/upload", response_model=ImageOut)
async def upload_image(
    copy_id: str,
    side: str = Form(...),  # FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("images:upload"))
):
    copy = db.query(ProductCopy).filter(ProductCopy.id == copy_id).first()
    if not copy:
        raise HTTPException(status_code=404, detail="Product copy not found")

    side_clean = side.upper()
    if side_clean not in {"FRONT", "BACK", "LEFT", "RIGHT", "TOP", "BOTTOM"}:
        raise HTTPException(status_code=400, detail="Invalid side. Must be FRONT, BACK, LEFT, RIGHT, TOP, or BOTTOM")

    content = await file.read()
    if len(content) > 15 * 1024 * 1024:  # 15 MB limit
        raise HTTPException(status_code=400, detail="File size exceeds 15 MB limit")

    file_hash = hashlib.sha256(content).hexdigest()
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    safe_filename = f"{uuid.uuid4()}_{side_clean}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as f:
        f.write(content)

    img_record = ImageRecord(
        copy_id=copy_id,
        side=side_clean,
        original_url=f"/api/v1/images/file/{safe_filename}",
        original_hash=file_hash,
        file_size=len(content),
        mime_type=file.content_type or "image/jpeg",
        status="UPLOADED"
    )
    db.add(img_record)
    db.commit()
    db.refresh(img_record)
    return ImageOut.model_validate(img_record)


@router.get("/file/{filename}")
def serve_image(filename: str):
    # Check upload dir, enhanced dir, evidence dir, or report dir
    for dir_path in [settings.UPLOAD_DIR, settings.ENHANCED_DIR, settings.EVIDENCE_DIR, settings.REPORT_DIR]:
        path = os.path.join(dir_path, filename)
        if os.path.exists(path):
            return FileResponse(path)
    raise HTTPException(status_code=404, detail="Requested file not found")


@router.get("/{id}", response_model=ImageOut)
def get_image(id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    img = db.query(ImageRecord).filter(ImageRecord.id == id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image record not found")
    return ImageOut.model_validate(img)
