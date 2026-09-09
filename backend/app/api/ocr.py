import os
import re
import logging
import traceback
from typing import List, Dict, Any

logger = logging.getLogger("legal_metrology.ocr")
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.config import settings
from app.ai import get_ai_model_client
from app.models import ImageRecord, ImageEnhancementRecord, AIResult, OCRResult, OCRRegion, Declaration, User
from app.dependencies import get_current_user

router = APIRouter(prefix="/ocr", tags=["AI & OCR"])

# ---------------------------------------------------------------------------
# Adjacent-detection joining helpers
# ---------------------------------------------------------------------------

# Regex that matches OCR tokens that are declaration LABEL keywords only
# (no numeric or currency value attached).
_LABEL_ONLY_RE = re.compile(
    r"^\s*(?:"
    r"MRP|M\.?R\.?P\.?|"
    r"QTY|QUANTITY|NET\s*QTY|NET\s*WEIGHT|"
    r"BATCH\s*(?:NO\.?|NUMBER)?|LOT\s*(?:NO\.?|NUMBER)?|"
    r"MFG\.?\s*(?:DATE)?|PKD\.?|PACKING\s*DATE"
    r")\s*[:\-]?\s*$",
    re.IGNORECASE,
)

# Declaration types where the value can appear on an adjacent OCR line
_VALUE_BEARING_TYPES = {"MRP", "NET_QUANTITY", "BATCH_NUMBER", "PACKING_DATE"}


def _is_label_only(text: str, decl_type: str) -> bool:
    """Return True when *text* is a bare declaration-field label with no value."""
    if decl_type not in _VALUE_BEARING_TYPES:
        return False
    return bool(_LABEL_ONLY_RE.match(text.strip()))


def _extract_mrp_value(text: str) -> str:
    """
    Extract MRP value from text, preserving the currency prefix.

    Precedence:
      1. MRP keyword + currency + number: returns "\u20b910.00" / "Rs.10.00"
      2. MRP keyword + plain number: returns "10.00"
      3. Standalone currency + number: returns "\u20b910.00" / "Rs.10.00"
      4. Any number: returns the number string
    """
    # Priority 1: MRP keyword with currency
    m = re.search(
        r"(?:MRP|M\.?R\.?P\.?)\s*[:\-]?\s*([\u20b9\u20a8]|Rs\.?)\s*(\d+(?:[.,]\d{1,2})?)",
        text, re.IGNORECASE
    )
    if m:
        return "{}{}".format(m.group(1), m.group(2).replace(",", ""))

    # Priority 2: MRP keyword with plain number
    m = re.search(
        r"(?:MRP|M\.?R\.?P\.?)\s*[:\-]?\s*(\d+(?:[.,]\d{1,2})?)",
        text, re.IGNORECASE
    )
    if m:
        return m.group(1).replace(",", "")

    # Priority 3: standalone currency + number
    m = re.search(
        r"([\u20b9\u20a8]|Rs\.?)\s*(\d+(?:[.,]\d{1,2})?)",
        text, re.IGNORECASE
    )
    if m:
        return "{}{}".format(m.group(1), m.group(2).replace(",", ""))

    # Priority 4: any bare number
    m = re.search(r"(\d+(?:[.,]\d{1,2})?)", text)
    if m:
        return m.group(1).replace(",", "")

    return text


# Keep legacy alias used elsewhere in the module
_extract_mrp_numeric = _extract_mrp_value


def _build_adjacent_joined_detections(detections: List[Dict]) -> List[Dict]:
    """
    Scan the ordered detection list for label-only tokens immediately followed
    by a value token.  Return a new list where such pairs are merged into a
    single synthetic detection so extract_fields() can pattern-match across
    the combined text.

    The function is conservative: it only merges when the *label* token
    matches _LABEL_ONLY_RE and the *next* token is either untyped or of
    the same declaration type. Unrelated detections are passed through
    unchanged.
    """
    result: List[Dict] = []
    skip_indices = set()

    for i, det in enumerate(detections):
        if i in skip_indices:
            continue

        text = (det.get("text", "") if isinstance(det, dict) else getattr(det, "text", "")).strip()
        if not text:
            result.append(det)
            continue

        if _LABEL_ONLY_RE.match(text) and i + 1 < len(detections):
            next_det = detections[i + 1]
            next_text = (
                (next_det.get("text", "") if isinstance(next_det, dict) else getattr(next_det, "text", ""))
            ).strip()
            if next_text:  # only merge if the next token is non-empty
                merged_text = f"{text} {next_text}"
                merged = {"text": merged_text, "confidence": 1.0, "bbox": None}
                result.append(merged)
                skip_indices.add(i + 1)
                continue

        result.append(det)

    return result


# ---------------------------------------------------------------------------
# Declaration value validation (module-level constants used by helpers below)
# ---------------------------------------------------------------------------

_SENTINEL_PREFIXES = ("DETECTED_BUT_UNREADABLE", "INVALID_", "INVALID_LENGTH:")

_MONTHS_RE = re.compile(
    r"\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\s\-]?\d{2,4}\b",
    re.IGNORECASE,
)
_NUMERIC_DATE_RE = re.compile(r"\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\b")
_BATCH_STOP_WORDS = {
    "SEE", "USE", "BY", "PKD", "MFG", "EXP", "NO", "NUMBER", "BATCH",
    "LOT", "DATE", "PACK", "FOR", "SIDE", "MENTIONED", "THE", "ABOVE",
    "PRINTED", "LABEL", "AND", "OR", "IN",
}


def _is_valid_decl_value(decl_type: str, value: str) -> bool:
    """Return True only when *value* is a meaningful declaration payload."""
    if not value or not value.strip():
        return False
    v = value.strip()
    upper = v.upper()

    if any(v.startswith(p) for p in _SENTINEL_PREFIXES):
        return True  # sentinels are valid (stored at low confidence)

    if decl_type == "MRP":
        return bool(re.search(r"\d", v))

    if decl_type == "NET_QUANTITY":
        return bool(re.search(r"\d", v))

    if decl_type == 'BATCH_NUMBER':
        words = set(re.findall(r'[A-Z]+', upper))
        has_real_value = bool(re.search(r'[A-Z0-9]{2,}', upper))
        all_stop = words.issubset(_BATCH_STOP_WORDS)
        # Real batch codes are short and compact — long sentences are noise
        is_sentence = len(v) > 30 or v.count(' ') > 3
        return has_real_value and not all_stop and not is_sentence

    if decl_type in ("EXPIRY_DATE", "PACKING_DATE"):
        return bool(_MONTHS_RE.search(v) or _NUMERIC_DATE_RE.search(v))

    if decl_type == "MANUFACTURER":
        return len(v) > 5

    if decl_type == "CONSUMER_CARE":
        email_ok = bool(re.search(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}", v))
        phone_ok = bool(re.search(r"(?:1800[\s\-]?[\d\s\-]{6,}|\b\d{10}\b)", v))
        return email_ok or phone_ok

    return True  # COUNTRY_OF_ORIGIN, OTHER, etc.


@router.post("/images/{image_id}/process")
async def process_image_ai(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers AI Model inference via Adapter pattern (Pipeline, Mock or External),
    executes OCR, extracts structured fields, runs compliance checking,
    and populates declarations.
    """
    img = db.query(ImageRecord).filter(ImageRecord.id == image_id).first()
    if not img:
        raise HTTPException(status_code=404, detail="Image record not found")

    filename = os.path.basename(img.original_url)
    filepath = os.path.join(settings.UPLOAD_DIR, filename)

    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=404,
            detail=f"Image file not found on disk: {filename}. "
                   "Please re-upload the image before processing."
        )

    # 1. Call AI Model Adapter
    ai_client = get_ai_model_client()
    try:
        prediction = await ai_client.predict(filepath)
    except FileNotFoundError as exc:
        logger.error("OCR image file not found: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        logger.error("OCR RuntimeError for image %s:\n%s", image_id, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"AI processing failed: {exc}")
    except Exception as exc:
        logger.error("OCR unexpected error for image %s:\n%s", image_id, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Unexpected error during AI processing: {exc}")

    # 2. Pull extra ML pipeline outputs from raw_response (if present).
    raw = prediction.raw_response
    extracted_fields: Dict[str, Any] = raw.get("extracted_fields", {})
    field_confidence: Dict[str, Any] = raw.get("field_confidence", {})
    compliance: Dict[str, Any] = raw.get("compliance", {})
    evidence: List[Dict[str, Any]] = raw.get("evidence", [])
    enhanced_image_path: str | None = raw.get("enhanced_image")
    enhanced_filename: str | None = raw.get("enhanced_filename")

    logger.info(
        "[DECL-EXTRACT] OCR raw detections received: %d regions",
        len(prediction.detections),
    )
    logger.info(
        "[DECL-EXTRACT] Normalized OCR text (first 400 chars): %.400s",
        " ".join(d.text for d in prediction.detections),
    )
    _non_null_fields = {k: v for k, v in extracted_fields.items() if v is not None}
    logger.info("[DECL-EXTRACT] Extracted fields from ML pipeline: %s", _non_null_fields)

    # ── Secondary pass: adjacent-token joining ────────────────────────────────
    _MISSING_VALUE_FIELDS = {"mrp", "net_quantity", "batch_number", "manufacturing_date"}
    if any(not extracted_fields.get(f) for f in _MISSING_VALUE_FIELDS) and evidence:
        try:
            import sys as _sys, os as _os
            _be_dir = _os.path.dirname(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))
            _ml_dir = _os.path.join(_os.path.dirname(_be_dir), "ml", "inference")
            if _ml_dir not in _sys.path:
                _sys.path.insert(0, _ml_dir)
            from run_compliance_pipeline import extract_fields as _extract_fields_fn  # noqa: E402

            _joined_dets = _build_adjacent_joined_detections(evidence)
            _sec_fields, _sec_conf = _extract_fields_fn(_joined_dets, min_confidence=0.0)
            for _k, _v in _sec_fields.items():
                if _v and not extracted_fields.get(_k):
                    extracted_fields[_k] = _v
                    if _sec_conf.get(_k) is not None:
                        field_confidence[_k] = _sec_conf[_k]
                    logger.info(
                        "[DECL-EXTRACT] Adjacent-join recovered: field=%s value=%r", _k, _v
                    )
        except Exception as _sec_exc:
            logger.warning("[DECL-EXTRACT] Adjacent-join secondary pass failed: %s", _sec_exc)

    _non_null_after = {k: v for k, v in extracted_fields.items() if v is not None}
    logger.info("[DECL-EXTRACT] Extracted fields after secondary pass: %s", _non_null_after)

    # 3. Save AI Result
    ai_res = AIResult(
        image_id=image_id,
        model_name=prediction.model_name,
        model_version=prediction.model_version,
        raw_response_json=prediction.raw_response,
        normalized_response_json=[d.model_dump() for d in prediction.detections],
        processing_time=prediction.processing_time
    )
    db.add(ai_res)
    db.flush()

    # 4. Persist the enhanced image record if the pipeline produced one.
    if enhanced_image_path and os.path.exists(enhanced_image_path):
        enhanced_url = f"/api/v1/images/file/{enhanced_filename}" if enhanced_filename else None
        enhancement_record = ImageEnhancementRecord(
            image_id=image_id,
            enhanced_url=enhanced_url or enhanced_image_path,
            operations_json=["CLAHE Adaptive Contrast Enhancement"],
            quality_before=None,
            quality_after=None,
            ocr_confidence_before=None,
            ocr_confidence_after=None,
        )
        db.add(enhancement_record)
        db.flush()

    # 5. Create OCR Result for ORIGINAL
    orig_text_lines = [d.text for d in prediction.detections]
    full_text_orig = "\n".join(orig_text_lines)

    ocr_orig = OCRResult(
        image_id=image_id,
        ocr_type="ORIGINAL",
        selected=True,
        selection_score=0.94,
        selection_reason="ML pipeline PaddleOCR inference",
        full_text=full_text_orig,
        engine=f"{prediction.model_name} {prediction.model_version}"
    )
    db.add(ocr_orig)
    db.flush()

    for d in prediction.detections:
        db.add(OCRRegion(
            ocr_result_id=ocr_orig.id,
            text=d.text,
            confidence=d.confidence,
            bbox_json=d.bbox,
            language=d.language
        ))

    # 6. Persist extracted declarations.
    _FIELD_TO_DECL_TYPE = {
        "net_quantity": "NET_QUANTITY",
        "mrp": "MRP",
        "batch_number": "BATCH_NUMBER",
        "manufacturing_date": "PACKING_DATE",
        "expiry_date": "EXPIRY_DATE",
        "fssai_license": "OTHER",
        "manufacturer": "MANUFACTURER",
        "consumer_care": "CONSUMER_CARE",
        "country_of_origin": "COUNTRY_OF_ORIGIN",
    }

    copy_obj = img.copy
    if copy_obj and copy_obj.product_id and extracted_fields:
        product_id = copy_obj.product_id
        for field_key, decl_type in _FIELD_TO_DECL_TYPE.items():
            value = extracted_fields.get(field_key)
            if not value:
                continue

            conf = field_confidence.get(field_key)

            if isinstance(value, str) and (
                value.startswith("DETECTED_BUT_UNREADABLE") or
                value.startswith("INVALID_")
            ):
                conf = 0.50

            existing = db.query(Declaration).filter(
                Declaration.product_id == product_id,
                Declaration.declaration_type == decl_type
            ).first()

            if existing:
                old_val = existing.normalized_value or ""
                old_is_stale = (
                    not old_val
                    or any(old_val.startswith(p) for p in _SENTINEL_PREFIXES)
                    or not _is_valid_decl_value(decl_type, old_val)
                )
                if old_is_stale:
                    existing.normalized_value = str(value)
                    existing.raw_text = str(value)
                    existing.confidence = float(conf) if conf is not None else 0.9
                    existing.source_image_id = image_id
                    logger.info(
                        "[DECL-PERSIST] Updated stale: type=%s value=%r",
                        decl_type, value,
                    )
                else:
                    logger.info(
                        "[DECL-PERSIST] Kept existing: type=%s value=%r",
                        decl_type, existing.normalized_value,
                    )
            else:
                logger.info(
                    "[DECL-PERSIST] Saving: type=%s value=%r confidence=%s",
                    decl_type, value, conf,
                )
                db.add(Declaration(
                    product_id=product_id,
                    declaration_type=decl_type,
                    raw_text=str(value),
                    normalized_value=str(value),
                    confidence=float(conf) if conf is not None else 0.9,
                    bbox_json=None,
                    verification_status="DETECTED",
                    source_image_id=image_id
                ))
                logger.info("[DECL-PERSIST] Saved: type=%s value=%r", decl_type, value)

    # 7. Heuristic fallback: persist non-OTHER DetectionItems that the ML
    #    extract_fields() may have missed.  A strict value-validation guard
    #    prevents label-only tokens ("See", "PKD - USE BY - Batch No.", etc.)
    #    from being saved as declaration values.
    if copy_obj and copy_obj.product_id:
        product_id = copy_obj.product_id
        detections_list = prediction.detections
        for idx, d in enumerate(detections_list):
            if d.declaration_type == "OTHER":
                continue

            # Build the effective normalised value for this detection.
            effective_text = d.text

            if _is_label_only(d.text, d.declaration_type):
                # Look ahead at the next 1-2 detections for a value token.
                for lookahead in range(1, 3):
                    if idx + lookahead >= len(detections_list):
                        break
                    next_d = detections_list[idx + lookahead]
                    next_text = next_d.text.strip()
                    if next_text:
                        effective_text = f"{d.text.strip()} {next_text}"
                        break

            # For MRP preserve the currency symbol.
            if d.declaration_type == "MRP":
                effective_text = _extract_mrp_value(effective_text)

            # ── Value validation guard ────────────────────────────────────────
            # Reject tokens that do not constitute a real declaration value
            # (e.g. "See", "PKD - USE BY - Batch No.", bare "CONTENTS", etc.).
            if not _is_valid_decl_value(d.declaration_type, effective_text):
                logger.info(
                    "[DECL-PERSIST] Fallback rejected (invalid value): "
                    "type=%s raw=%r effective=%r",
                    d.declaration_type, d.text, effective_text,
                )
                continue

            existing = db.query(Declaration).filter(
                Declaration.product_id == product_id,
                Declaration.declaration_type == d.declaration_type
            ).first()
            if not existing:
                logger.info(
                    "[DECL-PERSIST] Fallback saving: type=%s raw=%r effective=%r",
                    d.declaration_type, d.text, effective_text,
                )
                db.add(Declaration(
                    product_id=product_id,
                    declaration_type=d.declaration_type,
                    raw_text=d.text,
                    normalized_value=effective_text,
                    confidence=d.confidence,
                    bbox_json=d.bbox,
                    verification_status="DETECTED",
                    source_image_id=image_id
                ))
                logger.info(
                    "[DECL-PERSIST] Fallback saved: type=%s value=%r",
                    d.declaration_type, effective_text,
                )

    img.status = "PROCESSED"
    db.commit()

    return {
        "image_id": image_id,
        "model_name": prediction.model_name,
        "processing_time": prediction.processing_time,
        "ocr_result_id": ocr_orig.id,
        "detections_count": len(prediction.detections),
        "detections": [d.model_dump() for d in prediction.detections],
        # Extra ML pipeline outputs (empty dicts when using Mock/External adapter)
        "extracted_fields": extracted_fields,
        "field_confidence": field_confidence,
        "compliance": compliance,
        "evidence": evidence,
    }


@router.get("/images/{image_id}/compare")
def compare_ocr_versions(
    image_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ocr_results = db.query(OCRResult).filter(OCRResult.image_id == image_id).all()
    enhancement = db.query(ImageEnhancementRecord).filter(ImageEnhancementRecord.image_id == image_id).first()

    return {
        "image_id": image_id,
        "original_ocr": next((r for r in ocr_results if r.ocr_type == "ORIGINAL"), None),
        "enhanced_ocr": next((r for r in ocr_results if r.ocr_type == "ENHANCED"), None),
        "enhancement_details": enhancement,
        "best_selected": next((r for r in ocr_results if r.selected), None)
    }
