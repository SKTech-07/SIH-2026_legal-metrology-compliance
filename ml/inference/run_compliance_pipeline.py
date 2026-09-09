import os
import re
import json
import time
import logging
import argparse
from datetime import datetime
from difflib import SequenceMatcher

_logger = logging.getLogger("legal_metrology.pipeline")

import cv2
from paddleocr import PaddleOCR

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------


MIN_CONFIDENCE = 0.60           # detections below this are excluded from field parsing
FUZZY_MATCH_THRESHOLD = 0.72    # similarity ratio used to catch OCR-garbled keywords
FSSAI_LICENSE_LENGTH = 14       # FSSAI license numbers are always 14 digits

REQUIRED_FIELDS = [
    "product_name",
    "net_quantity",
    "mrp",
    "manufacturing_date",
    "expiry_date",
    "fssai_license",
]

LABEL_KEYWORDS = {
    "MRP", "NET", "QTY", "QUANTITY", "BATCH", "LOT", "MFG", "EXP",
    "EXPIRY", "FSSAI", "LIC", "LICENSE", "LICENCE", "DATE", "PACK", "PACKAGING",
}


def enhance_image(image_path, output_path=None):
    """Enhance image contrast/legibility before OCR. Returns the enhanced image path."""
    image = cv2.imread(image_path)
    if image is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)
    enhanced = cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)

    if output_path is None:
        base, ext = os.path.splitext(os.path.basename(image_path))
        input_dir = os.path.dirname(os.path.abspath(image_path))
        output_path = os.path.join(
            input_dir,
            f"{base}_enhanced{ext or '.jpg'}"
        )

    cv2.imwrite(output_path, enhanced)
    return output_path

def run_ocr(ocr, image_path):
    """
    Run PaddleOCR's predict() API and return detections sorted into
    approximate reading order (top-to-bottom, then left-to-right).
    Reading order matters a lot for regex-based field extraction, since
    a raw model output order can otherwise scramble adjacent label text.
    """
    result = ocr.predict(image_path)
    if not result:
        return []

    res = result[0]
    texts = res.get("rec_texts", [])
    scores = res.get("rec_scores", [])
    boxes = res.get("rec_polys", res.get("rec_boxes", []))

    detections = []
    for i, text in enumerate(texts):
        text = str(text).strip()
        if not text:
            continue

        score = float(scores[i]) if i < len(scores) else 0.0

        bbox = None
        if i < len(boxes):
            box = boxes[i]
            bbox = box.tolist() if hasattr(box, "tolist") else box

        if bbox:
            xs = [p[0] for p in bbox]
            ys = [p[1] for p in bbox]
            sort_key = (min(ys), min(xs))
        else:
            sort_key = (i, i)

        detections.append({
            "text": text,
            "confidence": round(score, 4),
            "bbox": bbox,
            "_sort_key": sort_key,
        })

    # Group into rows (tolerant of a few px of vertical jitter between
    # words on the same physical line), then sort left-to-right within each row.
    detections.sort(key=lambda d: (round(d["_sort_key"][0] / 15), d["_sort_key"][1]))
    for d in detections:
        d.pop("_sort_key", None)

    return detections


def _fuzzy_contains(haystack, keyword, threshold=FUZZY_MATCH_THRESHOLD):
    """
    Approximate substring match, used to catch OCR misreads of label
    keywords (e.g. 'BATC' for 'BATCH', 'NET QUETY' for 'NET QTY').
    """
    haystack = haystack.upper()
    keyword = keyword.upper()
    if keyword in haystack:
        return True
    window = len(keyword) + 4
    for i in range(0, max(len(haystack) - len(keyword) + 5, 1)):
        chunk = haystack[i:i + window]
        if SequenceMatcher(None, chunk, keyword).ratio() >= threshold:
            return True
    return False


def _confidence_for(usable_detections, source_text):
    """Lowest confidence among detections that share a word with source_text."""
    words = set(re.findall(r"[A-Za-z0-9]+", source_text.upper()))
    if not words:
        return None
    matches = [
        d["confidence"] for d in usable_detections
        if set(re.findall(r"[A-Za-z0-9]+", d["text"].upper())) & words
    ]
    return round(min(matches), 4) if matches else None


def extract_fields(detections, min_confidence=MIN_CONFIDENCE):
    """
    Contextual OCR declaration extraction.

    Works on the ordered detection list using sliding context windows
    rather than a single flattened full_text string.  This prevents
    unrelated OCR regions from being associated with the wrong anchor.
    """

    CONTEXT_WINDOW = 5  # adjacent detections to inspect around each anchor

    _logger.info("[DECL-EXTRACT] OCR detections: %d", len(detections))

    usable = [d for d in detections if d["confidence"] >= min_confidence]
    texts = [d["text"] for d in usable]

    # full_text is still used for a few multi-line regex scans
    full_text = " ".join(texts)
    all_text = " ".join(d["text"] for d in detections)

    _logger.info("[DECL-EXTRACT] Normalized OCR text (usable, first 500 chars): %.500s", full_text)

    fields = {
        "product_name": None,
        "net_quantity": None,
        "mrp": None,
        "batch_number": None,
        "manufacturing_date": None,
        "expiry_date": None,
        "fssai_license": None,
        "manufacturer": None,
        "consumer_care": None,
        "country_of_origin": None,
    }
    field_confidence = {key: None for key in fields}

    def record(field, value, matched_text):
        fields[field] = value
        field_confidence[field] = _confidence_for(usable, matched_text)

    def window_text(idx, before=0, after=CONTEXT_WINDOW):
        """Return joined text from a context window around detection idx."""
        start = max(0, idx - before)
        end = min(len(usable), idx + after + 1)
        return " ".join(texts[start:end])

    # ── Stop-words that must NOT become batch values ─────────────────────────
    _BATCH_STOP = {
        "SEE", "USE", "BY", "PKD", "MFG", "EXP", "NO", "NUMBER", "BATCH",
        "LOT", "DATE", "PACK", "MENTIONED", "ON", "THE", "SIDE", "FOR",
        "ABOVE", "PRINTED", "LABEL", "AND", "OR", "IN",
    }

    # ── Month-year patterns for date ranges ──────────────────────────────────
    _MONTHS_PAT = r"(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)"
    _MON_YR = (
        r"(?:" + _MONTHS_PAT + r"[\s\-]?\d{2,4}"
        r"|\d{1,2}[\/\-]\d{2,4})"
    )
    _DATE_RANGE_RE = re.compile(
        r"(" + _MON_YR + r")\s*[-\u2013]\s*(" + _MON_YR + r")",
        re.IGNORECASE,
    )
    _EXPIRY_ANCHOR_RE = re.compile(
        r"(?:USE\s*BY|EXPIRY|BEST\s*BEFORE|EXP\.?|USE\s*BEFORE)\s*[:\-]?\s*"
        r"(" + _MON_YR + r"|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})",
        re.IGNORECASE,
    )
    _MFG_DATE_ANCHOR_RE = re.compile(
        r"(?:MFG\.?\s*DATE|MFD\.?\s*DATE|PKD\.?\s*DATE|MANUFACTURING\s*DATE|PACKING\s*DATE)"
        r"\s*[:\-]?\s*"
        r"(" + _MON_YR + r"|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})",
        re.IGNORECASE,
    )

    # ── Manufacturer anchors ──────────────────────────────────────────────────
    _MFG_ANCHOR_RE = re.compile(
        r"(?:MANUFACTURED\s*BY|MANUFACTURER\s*:|MFG\s*BY|MFD\s*BY|"
        r"MARKETED\s*BY|MKT\s*BY|PACKED\s*BY|PACKAGED\s*BY|IMPORTED\s*BY)",
        re.IGNORECASE,
    )
    _MFG_STOP_RE = re.compile(
        r"(?:MRP|LIC\.?\s*NO|LICEN[CS]E|CONSUMER|HELPLINE|TOLL\s*FREE|EMAIL|INGREDIENT|DIRECTION|"
        r"ALLERGEN|STORAGE|INSTRUCTION|BEST\s*BEFORE|EXPIRY|USE\s*BY|FSSAI|"
        r"NET\s*(?:QUANTITY|QTY|WEIGHT)|BATCH\s*(?:NO|NUMBER)|COUNTRY\s*OF\s*ORIGIN)",
        re.IGNORECASE,
    )

    # ── Contact patterns for CONSUMER_CARE ───────────────────────────────────
    _EMAIL_RE = re.compile(
        r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
        re.IGNORECASE,
    )
    _PHONE_RE = re.compile(
        r"(?:1800[\s\-]?[\d\s\-]{6,10}|\b\d{10}\b|\b\d{4}[\s\-]\d{3}[\s\-]\d{4}\b)",
    )

    # ── Batch anchor ─────────────────────────────────────────────────────────
    _BATCH_ANCHOR_RE = re.compile(
        r"(?:BATCH\s*(?:NO\.?|NUMBER)?|LOT\s*(?:NO\.?|NUMBER)?)\s*[:\-]?\s*"
        r"([A-Z0-9][A-Z0-9\/\-]{1,})",
        re.IGNORECASE,
    )

    # =========================================================================
    # MRP
    # Priority 1: keyword + currency + number  "MRP ₹10.00 incl. of all taxes"
    # Priority 2: keyword + number only        "MRP 10.00"
    # Priority 3: standalone currency + number "₹10.00" / "Rs.10.00"
    # =========================================================================
    _MRP_KW_CUR_RE = re.compile(
        r"(?:MRP|M\.?R\.?P\.?)\s*[:\-]?\s*([₹₨]|Rs\.?)\s*(\d+(?:[.,]\d{1,2})?)",
        re.IGNORECASE,
    )
    _MRP_KW_NUM_RE = re.compile(
        # Cap at 8 digits so FSSAI/licence numbers (14 digits) are never matched as MRP
        r"(?:MRP|M\.?R\.?P\.?)\s*[:\-]?\s*(\d{1,8}(?:[.,]\d{1,2})?)",
        re.IGNORECASE,
    )
    _MRP_CUR_RE = re.compile(
        r"([₹₨]|Rs\.?)\s*(\d+(?:[.,]\d{1,2})?)",
        re.IGNORECASE,
    )

    for idx in range(len(usable)):
        win = window_text(idx, before=0, after=CONTEXT_WINDOW)
        m = _MRP_KW_CUR_RE.search(win)
        if m:
            value = "{}{}".format(m.group(1), m.group(2).replace(",", ""))
            _logger.info("[DECL-EXTRACT] MRP candidate (kw+currency): %r", value)
            record("mrp", value, usable[idx]["text"])
            break
        m = _MRP_KW_NUM_RE.search(win)
        if m:
            value = m.group(1).replace(",", "")
            _logger.info("[DECL-EXTRACT] MRP candidate (kw+number): %r", value)
            record("mrp", value, usable[idx]["text"])
            break

    if not fields["mrp"]:
        for d in usable:
            m = _MRP_CUR_RE.search(d["text"])
            if m:
                value = "{}{}".format(m.group(1), m.group(2).replace(",", ""))
                _logger.info("[DECL-EXTRACT] MRP candidate (currency only): %r", value)
                record("mrp", value, d["text"])
                break

    # =========================================================================
    # DATE RANGE  e.g. "JUN 26 - MAY 27" → PKD=JUN 26, EXPIRY=MAY 27
    # The END date of a range is always treated as EXPIRY.
    # =========================================================================
    m = _DATE_RANGE_RE.search(full_text)
    if m:
        start_date = m.group(1).strip()
        end_date = m.group(2).strip()
        _logger.info("[DECL-EXTRACT] Detected date range: %r - %r", start_date, end_date)
        _logger.info("[DECL-EXTRACT] PACKING_DATE = %r   EXPIRY = %r", start_date, end_date)
        record("manufacturing_date", start_date, start_date)
        record("expiry_date", end_date, end_date)
    else:
        # Fall back to DD/MM/YY style numeric dates (existing logic)
        raw_dates = re.findall(r"\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}\b", full_text)
        parsed_dates = []
        for raw in raw_dates:
            normalized = raw.replace(".", "/").replace("-", "/")
            for fmt in ("%d/%m/%Y", "%d/%m/%y"):
                try:
                    parsed_dates.append((datetime.strptime(normalized, fmt), raw))
                    break
                except ValueError:
                    continue
        parsed_dates.sort(key=lambda x: x[0])
        if len(parsed_dates) >= 1:
            fields["manufacturing_date"] = parsed_dates[0][1]
            field_confidence["manufacturing_date"] = _confidence_for(usable, parsed_dates[0][1])
        if len(parsed_dates) >= 2:
            fields["expiry_date"] = parsed_dates[-1][1]
            field_confidence["expiry_date"] = _confidence_for(usable, parsed_dates[-1][1])

    # Explicit anchor overrides (USE BY / EXPIRY / MFG DATE keywords)
    # When the anchor is followed by a date range, always use the END date.
    _EXPIRY_WITH_RANGE_RE = re.compile(
        r"(?:USE\s*BY|EXPIRY|BEST\s*BEFORE|EXP\.?|USE\s*BEFORE)\s*[:\-]?\s*"
        r"(?:" + _MON_YR + r")\s*[-\u2013]\s*(" + _MON_YR + r")",
        re.IGNORECASE,
    )
    m = _EXPIRY_WITH_RANGE_RE.search(full_text)
    if m:
        expiry_val = m.group(1).strip()
        _logger.info("[DECL-EXTRACT] EXPIRY anchor (range, end date): %r", expiry_val)
        record("expiry_date", expiry_val, expiry_val)
    else:
        m = _EXPIRY_ANCHOR_RE.search(full_text)
        if m:
            expiry_val = m.group(1).strip()
            _logger.info("[DECL-EXTRACT] EXPIRY anchor override: %r", expiry_val)
            record("expiry_date", expiry_val, expiry_val)


    m = _MFG_DATE_ANCHOR_RE.search(full_text)
    if m:
        mfg_val = m.group(1).strip()
        _logger.info("[DECL-EXTRACT] MFG_DATE anchor override: %r", mfg_val)
        record("manufacturing_date", mfg_val, mfg_val)

    # =========================================================================
    # MANUFACTURER — extract actual text block following the anchor keyword
    # =========================================================================
    for idx, d in enumerate(usable):
        m = _MFG_ANCHOR_RE.search(d["text"])
        if m:
            first_val = d["text"][m.end():].strip().lstrip(":").strip()
            parts = [first_val] if first_val else []
            for j in range(idx + 1, min(len(usable), idx + 6)):
                next_text = usable[j]["text"].strip()
                if _MFG_ANCHOR_RE.search(next_text) or _MFG_STOP_RE.search(next_text):
                    break
                parts.append(next_text)
            mfg_value = ", ".join(p for p in parts if p)
            if mfg_value:
                _logger.info("[DECL-EXTRACT] MANUFACTURER candidate: %.100r", mfg_value)
                record("manufacturer", mfg_value, d["text"])
                break

    # Fuzzy fallback only when no value was extracted
    if not fields["manufacturer"]:
        if (_fuzzy_contains(all_text, "MANUFACTURED") or
                _fuzzy_contains(all_text, "PACKED BY") or
                _fuzzy_contains(all_text, "MKTD")):
            fields["manufacturer"] = "DETECTED_BUT_UNREADABLE"

    # =========================================================================
    # CONSUMER CARE — require an actual email or phone number
    # =========================================================================
    cc_found = []

    for idx, d in enumerate(usable):
        text = d["text"]
        m = _EMAIL_RE.search(text)
        if m and m.group(0) not in cc_found:
            _logger.info("[DECL-EXTRACT] CONSUMER_CARE candidate (email): %r", m.group(0))
            cc_found.append(m.group(0))

        m = _PHONE_RE.search(text)
        if m and m.group(0).strip() not in cc_found:
            _logger.info("[DECL-EXTRACT] CONSUMER_CARE candidate (phone): %r", m.group(0))
            cc_found.append(m.group(0).strip())

        if re.search(
            r"(?:TOLL\s*FREE|HELPLINE|CONSUMER\s*CARE|CUSTOMER\s*CARE|EMAIL\s*:|CONTACT\s*US)",
            text,
            re.IGNORECASE,
        ):
            win = window_text(idx, before=0, after=3)
            em = _EMAIL_RE.search(win)
            ph = _PHONE_RE.search(win)
            if em and em.group(0) not in cc_found:
                cc_found.append(em.group(0))
            if ph and ph.group(0).strip() not in cc_found:
                cc_found.append(ph.group(0).strip())

    if cc_found:
        record("consumer_care", " | ".join(cc_found), cc_found[0])
    elif (_fuzzy_contains(all_text, "CONSUMER CARE") or
            _fuzzy_contains(all_text, "HELPLINE") or
            _fuzzy_contains(all_text, "CUSTOMER SUPPORT") or
            _fuzzy_contains(all_text, "FEEDBACK")):
        fields["consumer_care"] = "DETECTED_BUT_UNREADABLE"

    # =========================================================================
    # BATCH NUMBER — require a real alphanumeric value, not stop-words
    # =========================================================================
    for idx, d in enumerate(usable):
        m = _BATCH_ANCHOR_RE.search(d["text"])
        if m:
            candidate = m.group(1).strip()
            if candidate.upper() not in _BATCH_STOP:
                _logger.info("[DECL-EXTRACT] BATCH candidate: %r", candidate)
                record("batch_number", candidate, d["text"])
                break

        # Anchor label-only on this line → look at next detection for value
        # NOTE: the label must be at the START of the detection (not embedded in a compound
        # text like "PKD - USE BY - Batch No.").  Require the line to begin with BATCH/LOT.
        if re.search(
            r"^(?:BATCH|LOT)\s*(?:NO\.?|NUMBER)?\s*[:\-]?\s*$",
            d["text"].strip(),
            re.IGNORECASE,
        ):
            if idx + 1 < len(usable):
                nxt = usable[idx + 1]["text"].strip()
                # Reject if the value looks like a date (e.g. "JUN 26 - MAY 27")
                is_date = bool(re.search(
                    r"\b(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\s\-]?\d{2,4}\b",
                    nxt, re.IGNORECASE
                ))
                # Reject long strings (sentences), stop-words, and date values
                if (nxt.upper() not in _BATCH_STOP and
                        re.search(r"[A-Z0-9]{2,}", nxt, re.IGNORECASE) and
                        not is_date and len(nxt) <= 30 and nxt.count(" ") <= 3):
                    _logger.info("[DECL-EXTRACT] BATCH candidate (adjacent): %r", nxt)
                    record("batch_number", nxt, d["text"])
                    break

    # Intentionally NOT setting DETECTED_BUT_UNREADABLE for batch alone —
    # label-only "Batch No." tokens cause more false positives than they are worth.

    # =========================================================================
    # NET QUANTITY
    # =========================================================================
    # SI unit: 200g, 500ml, 1kg — EXISTING
    m = re.search(r"\b(\d+(?:\.\d+)?)\s*(g|kg|ml|l)\b", full_text, re.IGNORECASE)
    if m:
        record("net_quantity", m.group(0).upper().replace(" ", ""), m.group(0))

    # NET WEIGHT / NET QUANTITY anchor
    if not fields["net_quantity"]:
        m = re.search(
            r"(?:NET\s*(?:QUANTITY|QTY|WEIGHT|WT))\s*[:\-]?\s*"
            r"(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|pcs?|pieces?|units?))",
            full_text,
            re.IGNORECASE,
        )
        if m:
            record("net_quantity", m.group(1).strip(), m.group(0))

    # QTY with numeric value
    if not fields["net_quantity"]:
        m = re.search(r"\bQTY\s*[:\-]?\s*(\d+(?:\.\d+)?)\b", full_text, re.IGNORECASE)
        if m:
            record("net_quantity", m.group(1), m.group(0))

    # CONTENTS: N pcs/units — ONLY when a numeric value is explicitly present
    if not fields["net_quantity"]:
        m = re.search(
            r"\bCONTENTS?\s*[:\-]?\s*(\d+\s*(?:pcs?|pieces?|units?|nos?\.?|pack(?:s|ets?)?))",
            full_text,
            re.IGNORECASE,
        )
        if m:
            record("net_quantity", m.group(1).strip(), m.group(0))
        elif re.search(r"\bCONTENTS\b", full_text, re.IGNORECASE):
            _logger.info(
                "[DECL-EXTRACT] Ignored non-value NET_QUANTITY candidate: "
                "'CONTENTS' keyword with no numeric quantity"
            )

    # Standalone count units: "3 pcs", "1 unit"
    if not fields["net_quantity"]:
        m = re.search(
            r"\b(\d+)\s+(pcs?|pieces?|units?|nos?\.?|pack(?:s|ets?)?)",
            full_text,
            re.IGNORECASE,
        )
        if m:
            record("net_quantity", m.group(0).strip(), m.group(0))

    # =========================================================================
    # FSSAI LICENSE — EXISTING, UNCHANGED
    # =========================================================================
    m = re.search(
        r"(?:LIC\.?\s*NO\.?|LICEN[CS]E\s*NO\.?|FSSAI)\D{0,10}?(\d{10,20})",
        full_text,
        re.IGNORECASE,
    )
    if m:
        digits = m.group(1)
        if len(digits) == FSSAI_LICENSE_LENGTH:
            record("fssai_license", digits, m.group(0))
        else:
            fields["fssai_license"] = f"INVALID_LENGTH:{digits}"
    elif _fuzzy_contains(all_text, "FSSAI"):
        fields["fssai_license"] = "DETECTED_BUT_UNREADABLE"

    # =========================================================================
    # COUNTRY OF ORIGIN — EXISTING, UNCHANGED
    # =========================================================================
    if (_fuzzy_contains(all_text, "MADE IN") or
            _fuzzy_contains(all_text, "PRODUCT OF") or
            _fuzzy_contains(all_text, "COUNTRY OF ORIGIN")):
        fields["country_of_origin"] = "DETECTED_BUT_UNREADABLE"

    # =========================================================================
    # PRODUCT NAME — longest clean alphabetic detection — EXISTING, UNCHANGED
    # =========================================================================
    candidates = []
    for d in usable:
        cleaned = re.sub(r"[^A-Za-z\s]", "", d["text"]).strip()
        words = cleaned.upper().split()
        if not words or any(w in LABEL_KEYWORDS for w in words):
            continue
        if len(cleaned) >= 4:
            candidates.append((len(cleaned), cleaned, d["confidence"]))

    if candidates:
        candidates.sort(key=lambda c: (-c[0], -c[2]))
        fields["product_name"] = candidates[0][1]
        field_confidence["product_name"] = candidates[0][2]

    _non_null = {k: v for k, v in fields.items() if v is not None}
    _logger.info("[DECL-EXTRACT] extracted_fields: %s", _non_null)

    return fields, field_confidence


def check_compliance(fields, required_fields=None):
    """
    Prototype compliance check against core Legal Metrology mandatory fields.
    Distinguishes fields that are missing entirely from fields that were
    detected on the label but couldn't be read reliably or failed validation
    (e.g. a malformed FSSAI number) — both count as violations, but they
    point to different fixes (better photo vs. actually missing info).
    """
    required_fields = required_fields or REQUIRED_FIELDS

    missing = []
    unreadable = []

    for field in required_fields:
        value = fields.get(field)
        if not value:
            missing.append(field)
        elif isinstance(value, str) and (
            value.startswith("DETECTED_BUT_UNREADABLE") or value.startswith("INVALID_")
        ):
            unreadable.append(field)

    status = "VIOLATION" if (missing or unreadable) else "NO_VIOLATION"

    return {
        "status": status,
        "missing_required_fields": missing,
        "unreadable_required_fields": unreadable,
    }


def build_ocr_pipeline():
    return PaddleOCR(use_textline_orientation=True, lang="en", enable_mkldnn=False)


def run_pipeline(image_path, output_json=None, min_confidence=MIN_CONFIDENCE):
    """Run the full pipeline end to end and return the final result dict."""

    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    start_time = time.time()

    print("\n[1] Image Enhancement")
    enhanced_path = enhance_image(image_path)
    print(f"Enhanced image: {enhanced_path}")

    print("\n[2] Initializing PaddleOCR")
    ocr = build_ocr_pipeline()

    print("\n[3] Running OCR")
    detections = run_ocr(ocr, enhanced_path)
    print(f"Detected text regions: {len(detections)}")

    print("\n[4] Extracting Structured Information")
    fields, field_confidence = extract_fields(detections, min_confidence=min_confidence)
    for key, value in fields.items():
        conf = field_confidence.get(key)
        conf_str = f" (confidence: {conf:.2f})" if conf is not None else ""
        print(f"{key}: {value}{conf_str}")

    print("\n[5] Compliance Check")
    compliance = check_compliance(fields)
    print(f"Status: {compliance['status']}")
    if compliance["missing_required_fields"]:
        print("Missing fields:", ", ".join(compliance["missing_required_fields"]))
    if compliance["unreadable_required_fields"]:
        print("Unreadable/invalid fields:", ", ".join(compliance["unreadable_required_fields"]))
    if compliance["status"] == "NO_VIOLATION":
        print("Required prototype fields detected.")

    print("\n[6] Evidence")
    evidence = [
        {"text": d["text"], "confidence": d["confidence"], "bbox": d["bbox"]}
        for d in detections
    ]

    final_result = {
        "success": True,
        "input_image": image_path,
        "enhanced_image": enhanced_path,
        "processing_time_seconds": round(time.time() - start_time, 2),
        "ocr": detections,
        "extracted_fields": fields,
        "field_confidence": field_confidence,
        "compliance": compliance,
        "evidence": evidence,
    }

    result_path = output_json or os.path.join(
        os.path.dirname(os.path.abspath(image_path)),
        f"{os.path.splitext(os.path.basename(image_path))[0]}_compliance_result.json"
    )
    with open(result_path, "w", encoding="utf-8") as f:
        json.dump(final_result, f, indent=2, ensure_ascii=False)

    print("\n[7] Final Result")
    print(json.dumps(final_result, indent=2, ensure_ascii=False))
    print("\nResult saved to:")
    print(result_path)

    return final_result


def main():
    parser = argparse.ArgumentParser(description="Legal Metrology Compliance Pipeline")
    parser.add_argument("--image_path", required=True, help="Path to product image")
    parser.add_argument(
        "--output_json", default=None,
        help="Where to save the result JSON (default: /tmp/<image_name>_compliance_result.json)"
    )
    parser.add_argument(
        "--min_confidence", type=float, default=MIN_CONFIDENCE,
        help="Minimum OCR confidence used when extracting fields (default: %(default)s)"
    )
    args = parser.parse_args()

    print("=" * 60)
    print("LEGAL METROLOGY ML PIPELINE")
    print("=" * 60)

    try:
        run_pipeline(args.image_path, output_json=args.output_json, min_confidence=args.min_confidence)
    except FileNotFoundError as exc:
        print(f"ERROR: {exc}")
        return
    except Exception as exc:
        print(f"\nPIPELINE ERROR: {exc}")
        error_result = {"success": False, "error": str(exc), "input_image": args.image_path}
        error_path = args.output_json or os.path.join(
            os.path.dirname(os.path.abspath(args.image_path)),
            "compliance_result_error.json"
        )
        with open(error_path, "w", encoding="utf-8") as f:
            json.dump(error_result, f, indent=2, ensure_ascii=False)
        return

    print("\n" + "=" * 60)
    print("PIPELINE COMPLETED")
    print("=" * 60)


if __name__ == "__main__":
    main()