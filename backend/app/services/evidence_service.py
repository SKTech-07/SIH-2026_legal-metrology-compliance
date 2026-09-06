import os
import uuid
import cv2
from typing import List, Optional
from app.config import settings


def generate_annotated_evidence(
    original_image_path: str,
    bbox: List[int],
    label: str = "VIOLATION EVIDENCE",
    color: tuple = (0, 0, 255)  # BGR format (Red for violation)
) -> Optional[str]:
    """
    Renders an annotated copy of the source image highlighting the violation bounding box region.
    Preserves original image unchanged.
    """
    if not original_image_path or not os.path.exists(original_image_path):
        return None

    img = cv2.imread(original_image_path)
    if img is None:
        return None

    x, y, w, h = bbox[0], bbox[1], bbox[2], bbox[3]

    # Draw rectangle border
    cv2.rectangle(img, (x, y), (x + w, y + h), color, 3)

    # Draw label backdrop header
    label_text = f"EVIDENCE: {label}"
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.6
    thickness = 2
    (text_w, text_h), baseline = cv2.getTextSize(label_text, font, font_scale, thickness)

    rect_top_y = max(0, y - text_h - 10)
    cv2.rectangle(img, (x, rect_top_y), (x + text_w + 10, rect_top_y + text_h + baseline + 6), color, -1)
    cv2.putText(img, label_text, (x + 5, rect_top_y + text_h + 2), font, font_scale, (255, 255, 255), thickness)

    filename = f"evidence_{uuid.uuid4()}.jpg"
    output_path = os.path.join(settings.EVIDENCE_DIR, filename)
    cv2.imwrite(output_path, img)

    return f"/api/v1/images/file/{filename}"
