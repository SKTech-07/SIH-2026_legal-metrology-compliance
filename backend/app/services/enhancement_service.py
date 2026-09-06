import os
import uuid
import cv2
import numpy as np
from typing import Dict, Any, List
from app.config import settings
from app.services.quality_service import analyze_image_quality


def apply_adaptive_enhancement(original_path: str, quality_metrics: Dict[str, Any]) -> Dict[str, Any]:
    """
    Adaptive image enhancement pipeline based on OpenCV.
    Detects specific quality issues and applies required operations conditionally.
    Saves enhanced image separately without modifying original image.
    """
    img = cv2.imread(original_path)
    if img is None:
        raise ValueError(f"Could not load image at path: {original_path}")

    applied_operations: List[str] = []
    processed = img.copy()

    # 1. Glare Reduction if glare > 3.0%
    if quality_metrics.get("glare", 0.0) > 3.0:
        gray = cv2.cvtColor(processed, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
        processed = cv2.inpaint(processed, mask, 3, cv2.INPAINT_TELEA)
        applied_operations.append("Glare Reduction (Inpainting)")

    # 2. Denoising if noise > 8.0
    if quality_metrics.get("noise", 0.0) > 8.0:
        processed = cv2.fastNlMeansDenoisingColored(processed, None, 7, 7, 7, 21)
        applied_operations.append("Non-Local Means Denoising")

    # 3. Contrast & Exposure Enhancement (CLAHE) if contrast < 45.0
    if quality_metrics.get("contrast", 0.0) < 55.0:
        lab = cv2.cvtColor(processed, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        processed = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        applied_operations.append("CLAHE Adaptive Contrast Enhancement")

    # 4. Sharpening if blur < 150.0
    if quality_metrics.get("blur", 0.0) < 180.0:
        kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
        processed = cv2.filter2D(processed, -1, kernel)
        applied_operations.append("Unsharp Masking / Edge Sharpening")

    # If no specific condition triggered, apply standard CLAHE for legibility
    if not applied_operations:
        lab = cv2.cvtColor(processed, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        limg = cv2.merge((cl, a, b))
        processed = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
        applied_operations.append("Standard Legibility Enhancement")

    # Save enhanced image
    ext = os.path.splitext(original_path)[1] or ".jpg"
    filename = f"enhanced_{uuid.uuid4()}{ext}"
    output_path = os.path.join(settings.ENHANCED_DIR, filename)
    cv2.imwrite(output_path, processed)

    # Re-evaluate quality on enhanced image
    enhanced_quality = analyze_image_quality(output_path)

    return {
        "enhanced_path": output_path,
        "enhanced_url": f"/api/v1/images/file/{filename}",
        "applied_operations": applied_operations,
        "quality_before": quality_metrics.get("overall_quality", 0.0),
        "quality_after": enhanced_quality.get("overall_quality", 0.0),
        "ocr_confidence_before": min(0.99, max(0.60, quality_metrics.get("overall_quality", 50.0) / 100.0)),
        "ocr_confidence_after": min(0.99, max(0.75, enhanced_quality.get("overall_quality", 75.0) / 100.0))
    }
