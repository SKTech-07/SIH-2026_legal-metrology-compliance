"""
PipelineModelClient
-------------------
Adapter that integrates the existing ML compliance pipeline
(ml/inference/run_compliance_pipeline.py) with the backend AIModelClient
interface.

All ML logic is imported directly from run_compliance_pipeline — no
subprocess, no duplication.  The PaddleOCR instance is cached at module
level so it is never re-initialised per request.

paddleocr>=3.0 is required (uses the .predict() API and
use_textline_orientation parameter).
"""

import os
import sys
import uuid
import time
import logging
from typing import List, Optional

from app.ai.model_client import AIModelClient, AIModelResponse, DetectionItem
from app.config import settings

logger = logging.getLogger("legal_metrology.ai.pipeline_client")

# ---------------------------------------------------------------------------
# Resolve and register the ml/inference directory on sys.path so we can
# import run_compliance_pipeline without a subprocess.
# ---------------------------------------------------------------------------
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_PROJECT_ROOT = os.path.dirname(_BACKEND_DIR)
_ML_INFERENCE_DIR = os.path.join(_PROJECT_ROOT, "ml", "inference")

if _ML_INFERENCE_DIR not in sys.path:
    sys.path.insert(0, _ML_INFERENCE_DIR)

# ---------------------------------------------------------------------------
# Lazy import of ML pipeline functions.  Wrapped in try/except so the
# backend starts cleanly even if paddleocr is not yet installed, failing
# at request-time with a clear message.
# ---------------------------------------------------------------------------
try:
    from run_compliance_pipeline import (  # noqa: E402  (path added above)
        build_ocr_pipeline,
        enhance_image as _pipeline_enhance_image,
        run_ocr,
        extract_fields,
        check_compliance,
    )
    _PIPELINE_AVAILABLE = True
    _PIPELINE_IMPORT_ERROR = ""
except ImportError as _import_err:
    _PIPELINE_AVAILABLE = False
    _PIPELINE_IMPORT_ERROR = str(_import_err)
    logger.warning(
        "ML pipeline could not be imported (%s). "
        "PipelineModelClient will raise at predict() time.",
        _import_err,
    )

# ---------------------------------------------------------------------------
# Module-level OCR instance cache — initialised once, reused for every
# request, exactly as the working ML pipeline does.
# ---------------------------------------------------------------------------
_ocr_instance = None


def _get_ocr_instance():
    """Return the cached PaddleOCR instance, creating it on first call."""
    global _ocr_instance
    if _ocr_instance is None:
        logger.info(
            "Initialising PaddleOCR "
            "(use_textline_orientation=True, lang=en, enable_mkldnn=False)"
        )
        _ocr_instance = build_ocr_pipeline()
    return _ocr_instance


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _quad_to_xywh(bbox) -> List[int]:
    """
    Convert a PaddleOCR quadrilateral bounding box
    [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] to [x, y, w, h].

    Falls back gracefully if bbox is already [x, y, w, h] (flat list of 4 ints).
    """
    if bbox is None:
        return [0, 0, 1, 1]

    # Already [x, y, w, h] style (flat list of four numbers, none are sequences)
    if len(bbox) == 4 and not hasattr(bbox[0], "__len__"):
        return [int(v) for v in bbox]

    # Quadrilateral: list of 4 [x, y] points
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    x = int(min(xs))
    y = int(min(ys))
    w = int(max(xs) - x)
    h = int(max(ys) - y)
    return [x, y, w, h]


def _infer_declaration_type(text: str) -> str:
    """
    Heuristic classification of raw OCR text into a declaration_type.

    Rules are ordered from most-specific to least-specific.
    Each rule requires contextual evidence (e.g. a digit near CONTENTS,
    a value token after BATCH NO:) before committing to a type.
    """
    import re as _re
    upper = text.upper()

    # ── MRP ──────────────────────────────────────────────────────────────────
    if any(k in upper for k in ("MRP", "M.R.P", "MAX RETAIL")):
        return "MRP"
    # Currency symbol indicates a price line
    if _re.search(r"[₹₨]", text) and _re.search(r"\d", text):
        return "MRP"
    if _re.search(r"\bRs\.?\s*\d", text):
        return "MRP"

    # ── NET_QUANTITY — require a numeric value near the anchor ────────────────
    if any(k in upper for k in ("NET QUANTITY", "NET QTY", "NET WEIGHT", "NET WT")):
        if _re.search(r"\d", text):
            return "NET_QUANTITY"
    if "QTY" in upper and _re.search(r"\d", text):
        return "NET_QUANTITY"
    # CONTENTS alone in a sentence is NOT enough — must have a digit/unit
    if "CONTENTS" in upper and _re.search(r"\d", text):
        return "NET_QUANTITY"
    if "WEIGHT" in upper and _re.search(r"\d", text):
        return "NET_QUANTITY"
    if "VOLUME" in upper and _re.search(r"\d", text):
        return "NET_QUANTITY"

    # ── BATCH_NUMBER — require keyword + actual value token ───────────────────
    _BATCH_STOP_INFER = {
        "SEE", "USE", "BY", "PKD", "MFG", "EXP", "FOR", "SIDE",
        "MENTIONED", "DATE", "NO", "NUMBER",
    }
    if any(k in upper for k in ("BATCH NO", "LOT NO", "LOT:", "BATCH:")):
        m = _re.search(
            r"(?:BATCH\s*(?:NO\.?|NUMBER)?|LOT\s*(?:NO\.?|NUMBER)?)"
            r"\s*[:\-]?\s*([A-Z0-9]{2,})",
            text,
            _re.IGNORECASE,
        )
        if m and m.group(1).upper() not in _BATCH_STOP_INFER:
            return "BATCH_NUMBER"

    # ── MANUFACTURER ──────────────────────────────────────────────────────────
    if any(k in upper for k in (
        "MARKETED BY", "MANUFACTURED BY", "MFG BY", "MFD BY",
        "MKT BY", "PACKED BY", "PACKAGED BY", "IMPORTED BY",
    )):
        return "MANUFACTURER"

    # ── PACKING_DATE — PKD/MFG in date context ───────────────────────────────
    if any(k in upper for k in ("PACKING DATE", "PACKED ON", "MFG DATE", "MFD DATE")):
        return "PACKING_DATE"
    if any(k in upper for k in ("MFG", "MFD")) and _re.search(r"\d", text):
        return "PACKING_DATE"
    # PKD alone (no "BY") → packing date context
    if "PKD" in upper and "BY" not in upper:
        return "PACKING_DATE"

    # ── EXPIRY_DATE ───────────────────────────────────────────────────────────
    # Require an actual date value to be present — "PKD - USE BY - Batch No."
    # contains "USE BY" but has no date → must return OTHER.
    _MONTH_PAT = r"(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)"
    _HAS_DATE = bool(
        _re.search(rf"\b{_MONTH_PAT}[\s\-]?\d{{2,4}}\b", text, _re.IGNORECASE) or
        _re.search(r"\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b", text) or
        _re.search(r"\b\d{1,2}[\/\-]\d{2,4}\b", text)
    )
    if any(k in upper for k in ("EXPIRY", "USE BY", "BEST BEFORE", "USE BEFORE", "EXP DATE")):
        if _HAS_DATE:
            return "EXPIRY_DATE"
        # No actual date found — don't classify this detection as EXPIRY_DATE
    if upper.startswith("EXP") and _HAS_DATE:
        return "EXPIRY_DATE"

    # ── CONSUMER_CARE — require actual contact info ───────────────────────────
    if _re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", text):
        return "CONSUMER_CARE"
    if _re.search(r"(?:1800[\s\-]?[\d\s\-]{6,10}|\b\d{10}\b)", text):
        if any(k in upper for k in ("TOLL", "FREE", "HELPLINE", "CONSUMER", "CUSTOMER")):
            return "CONSUMER_CARE"

    # ── COUNTRY_OF_ORIGIN ─────────────────────────────────────────────────────
    if any(k in upper for k in ("MADE IN", "PRODUCT OF", "COUNTRY OF ORIGIN")):
        return "COUNTRY_OF_ORIGIN"

    return "OTHER"



# ---------------------------------------------------------------------------
# PipelineModelClient
# ---------------------------------------------------------------------------

class PipelineModelClient(AIModelClient):
    """
    AIModelClient adapter that executes the existing ML compliance pipeline.

    Flow:
        1.  Enhance uploaded image (ML pipeline's enhance_image) →
            saved to settings.ENHANCED_DIR.
        2.  Run PaddleOCR via ML pipeline's run_ocr() (.predict() API).
        3.  Extract structured fields (ML pipeline's extract_fields).
        4.  Run compliance check (ML pipeline's check_compliance).
        5.  Build evidence list.
        6.  Return AIModelResponse with standard detections AND extra data
            stored in raw_response for the OCR endpoint to persist/return.
    """

    async def predict(self, image_path: str) -> AIModelResponse:
        if not _PIPELINE_AVAILABLE:
            raise RuntimeError(
                f"ML pipeline functions could not be imported: {_PIPELINE_IMPORT_ERROR}. "
                "Ensure paddleocr>=3.0, paddlepaddle, and opencv-python are installed."
            )

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        start_time = time.time()
        request_id = str(uuid.uuid4())

        # ------------------------------------------------------------------
        # 1. Enhance image — save to the configured enhanced directory so
        #    files are never written to /tmp or the source image folder.
        # ------------------------------------------------------------------
        ext = os.path.splitext(image_path)[1] or ".jpg"
        enhanced_filename = f"enhanced_{uuid.uuid4()}{ext}"
        enhanced_output_path = os.path.join(
            os.path.abspath(settings.ENHANCED_DIR), enhanced_filename
        )

        try:
            enhanced_path = _pipeline_enhance_image(image_path, output_path=enhanced_output_path)
        except Exception as exc:
            logger.warning("Image enhancement failed (%s); using original image.", exc)
            enhanced_path = image_path
            enhanced_filename = None  # signal to caller: no enhanced file was saved

        # ------------------------------------------------------------------
        # 2. Run PaddleOCR on the enhanced image using the ML pipeline's
        #    run_ocr() which wraps the .predict() 3.x API.
        # ------------------------------------------------------------------
        ocr = _get_ocr_instance()
        try:
            raw_detections = run_ocr(ocr, enhanced_path)
        except Exception as exc:
            logger.error("PaddleOCR failed on %s: %s", enhanced_path, exc)
            raise RuntimeError(f"OCR processing failed: {exc}") from exc

        logger.info("PaddleOCR detected %d text regions.", len(raw_detections))

        # ------------------------------------------------------------------
        # 3. Extract structured fields using the ML pipeline's function.
        # ------------------------------------------------------------------
        try:
            extracted_fields, field_confidence = extract_fields(raw_detections)
        except Exception as exc:
            logger.warning("Field extraction failed (%s); using empty fields.", exc)
            extracted_fields, field_confidence = {}, {}

        # ------------------------------------------------------------------
        # 4. Run compliance check using the ML pipeline's function.
        # ------------------------------------------------------------------
        try:
            compliance = check_compliance(extracted_fields)
        except Exception as exc:
            logger.warning("Compliance check failed (%s).", exc)
            compliance = {"status": "ERROR", "error": str(exc)}

        # ------------------------------------------------------------------
        # 5. Build evidence list.
        # ------------------------------------------------------------------
        evidence = [
            {"text": d["text"], "confidence": d["confidence"], "bbox": d["bbox"]}
            for d in raw_detections
        ]

        # ------------------------------------------------------------------
        # 6. Convert raw_detections → DetectionItem list (backend format).
        #    Quadrilateral bboxes → [x, y, w, h].
        # ------------------------------------------------------------------
        detection_items: List[DetectionItem] = []
        for d in raw_detections:
            text = d.get("text", "").strip()
            if not text:
                continue
            raw_bbox = d.get("bbox")
            bbox_xywh = _quad_to_xywh(raw_bbox)
            declaration_type = _infer_declaration_type(text)
            detection_items.append(
                DetectionItem(
                    text=text,
                    confidence=float(d.get("confidence", 0.0)),
                    language="en",
                    bbox=bbox_xywh,
                    declaration_type=declaration_type,
                )
            )

        processing_time = round(time.time() - start_time, 3)

        # ------------------------------------------------------------------
        # 7. Return AIModelResponse.
        #    Extra ML outputs are stored in raw_response so ocr.py can
        #    persist and expose them without changing the AIModelResponse schema.
        # ------------------------------------------------------------------
        return AIModelResponse(
            model_name="PaddleOCR-CompliancePipeline",
            model_version="3.x",
            request_id=request_id,
            processing_time=processing_time,
            detections=detection_items,
            raw_response={
                "provider": "PipelineModelClient",
                "status": "success",
                "total_detected": len(detection_items),
                "extracted_fields": extracted_fields,
                "field_confidence": field_confidence,
                "compliance": compliance,
                "evidence": evidence,
                "enhanced_image": enhanced_path if enhanced_filename else None,
                "enhanced_filename": enhanced_filename,
            },
        )
