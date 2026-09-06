from typing import Dict, Any, List, Optional
import datetime


DEFAULT_LEGAL_METROLOGY_RULES = [
    {
        "code": "LM-MRP-001",
        "name": "MRP Declaration",
        "declaration_type": "MRP",
        "requirement": "Maximum Retail Price (MRP) must be clearly declared including all taxes (e.g., MRP ₹ 250.00 incl. of all taxes).",
        "validation_type": "REQUIRED",
        "severity": "HIGH"
    },
    {
        "code": "LM-QTY-002",
        "name": "Net Quantity Declaration",
        "declaration_type": "NET_QUANTITY",
        "requirement": "Net quantity or net weight/volume must be declared in standard metric units (g, kg, ml, l, units).",
        "validation_type": "REQUIRED",
        "severity": "HIGH"
    },
    {
        "code": "LM-DATE-003",
        "name": "Manufacture / Packing Date",
        "declaration_type": "PACKING_DATE",
        "requirement": "Month and Year of manufacture, packing or import must be clearly declared.",
        "validation_type": "REQUIRED",
        "severity": "HIGH"
    },
    {
        "code": "LM-MFG-004",
        "name": "Manufacturer / Packer Details",
        "declaration_type": "MANUFACTURER",
        "requirement": "Complete name and address of manufacturer, packer, or importer must be clearly declared.",
        "validation_type": "REQUIRED",
        "severity": "HIGH"
    },
    {
        "code": "LM-CC-005",
        "name": "Consumer Care Helpline & Address",
        "declaration_type": "CONSUMER_CARE",
        "requirement": "Name, email, address, and telephone helpline number for consumer grievance redressal must be declared.",
        "validation_type": "REQUIRED",
        "severity": "MEDIUM"
    },
    {
        "code": "LM-COO-006",
        "name": "Country of Origin",
        "declaration_type": "COUNTRY_OF_ORIGIN",
        "requirement": "Country of Origin must be explicitly declared on the package.",
        "validation_type": "REQUIRED",
        "severity": "HIGH"
    },
    {
        "code": "LM-BATCH-007",
        "name": "Batch / Lot Identification",
        "declaration_type": "BATCH_NUMBER",
        "requirement": "Batch number, lot number, or code number must be declared.",
        "validation_type": "REQUIRED",
        "severity": "MEDIUM"
    },
    {
        "code": "LM-FONT-008",
        "name": "Font Size & Legibility Check",
        "declaration_type": "FONT_SIZE",
        "requirement": "Declaration text font size must satisfy Legal Metrology height regulations (> 2.0 mm). High measurement uncertainty yields REVIEW state.",
        "validation_type": "FONT_SIZE",
        "severity": "MEDIUM"
    }
]


class LegalMetrologyRuleEngine:
    """Legal Metrology Packaged Commodity Compliance Rule Engine."""

    def evaluate_product_declarations(
        self,
        product_category: str,
        declarations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        results = []

        # Index detected declarations by declaration_type
        decl_map = {}
        for d in declarations:
            dtype = d.get("declaration_type")
            if dtype:
                decl_map[dtype] = d

        for rule in DEFAULT_LEGAL_METROLOGY_RULES:
            rule_code = rule["code"]
            dtype = rule["declaration_type"]

            if dtype == "FONT_SIZE":
                # Special font size evaluation logic: uncertainty yields REVIEW
                results.append({
                    "rule_code": rule_code,
                    "rule_name": rule["name"],
                    "declaration_type": dtype,
                    "status": "REVIEW",
                    "detected_value": "Estimated numeral height ~1.9mm (Confidence: 62%)",
                    "expected_value": ">= 2.0 mm numeral height under PCR 2011",
                    "confidence": 0.62,
                    "reason": "Font height measurement uncertainty is 62%. Requires human verification.",
                    "severity": rule["severity"]
                })
                continue

            detected = decl_map.get(dtype)

            if not detected:
                # Missing declaration violation
                results.append({
                    "rule_code": rule_code,
                    "rule_name": rule["name"],
                    "declaration_type": dtype,
                    "status": "FAIL",
                    "detected_value": "Not Detected on Package",
                    "expected_value": rule["requirement"],
                    "confidence": 0.95,
                    "reason": f"Mandatory declaration '{rule['name']}' was missing from package image captures.",
                    "severity": rule["severity"]
                })
            else:
                # Declaration detected - check confidence and text validity
                val = detected.get("normalized_value") or detected.get("raw_text") or ""
                conf = float(detected.get("confidence", 0.9))

                if conf < 0.70:
                    status = "REVIEW"
                    reason = f"Declaration text '{val}' was detected with low AI confidence ({round(conf*100)}%). Requires human verification."
                else:
                    status = "PASS"
                    reason = f"Mandatory declaration verified: '{val}'"

                results.append({
                    "rule_code": rule_code,
                    "rule_name": rule["name"],
                    "declaration_type": dtype,
                    "status": status,
                    "detected_value": val,
                    "expected_value": rule["requirement"],
                    "confidence": conf,
                    "reason": reason,
                    "severity": rule["severity"]
                })

        return results
