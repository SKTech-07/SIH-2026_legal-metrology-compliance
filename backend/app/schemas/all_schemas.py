import datetime
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field


# --- AUTH & USER SCHEMAS ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role_name: str
    is_active: bool
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role_name: str = "INSPECTOR"


# --- ASSIGNMENT SCHEMAS ---
class AssignmentCreate(BaseModel):
    inspection_id: str
    inspector_id: str
    priority: str = "NORMAL"
    notes: Optional[str] = None


class AssignmentOut(BaseModel):
    id: str
    inspection_id: str
    inspector_id: str
    assigned_by: str
    assigned_at: datetime.datetime
    started_at: Optional[datetime.datetime] = None
    completed_at: Optional[datetime.datetime] = None
    status: str
    priority: str
    notes: Optional[str] = None
    inspector_name: Optional[str] = None

    class Config:
        from_attributes = True


# --- STORE SCHEMAS ---
class StoreCreate(BaseModel):
    name: str
    license_number: str
    address: str
    city: str
    state: str
    pincode: str
    owner_name: Optional[str] = None
    contact_number: Optional[str] = None


class StoreOut(StoreCreate):
    id: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# --- INSPECTION SCHEMAS ---
class InspectionCreate(BaseModel):
    store_id: str
    priority: str = "NORMAL"
    due_date: Optional[datetime.datetime] = None
    notes: Optional[str] = None
    inspector_id: Optional[str] = None  # Optional initial assignment


class InspectionOut(BaseModel):
    id: str
    code: str
    store_id: str
    created_by: str
    status: str
    priority: str
    due_date: Optional[datetime.datetime] = None
    notes: Optional[str] = None
    created_at: datetime.datetime
    completed_at: Optional[datetime.datetime] = None
    store_name: Optional[str] = None
    assigned_inspector_id: Optional[str] = None
    assigned_inspector_name: Optional[str] = None
    product_count: int = 0
    violation_count: int = 0

    class Config:
        from_attributes = True


# --- PRODUCT & COPIES SCHEMAS ---
class ProductCreate(BaseModel):
    name: str
    category: str
    brand: Optional[str] = None
    variant: Optional[str] = None
    barcode: Optional[str] = None


class ProductCopyOut(BaseModel):
    id: str
    product_id: str
    copy_number: int
    barcode_scanned: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: str
    inspection_id: str
    name: str
    category: str
    brand: Optional[str] = None
    variant: Optional[str] = None
    barcode: Optional[str] = None
    status: str
    created_at: datetime.datetime
    copy_count: int = 0
    copies: List[ProductCopyOut] = []

    class Config:
        from_attributes = True


# --- IMAGE SCHEMAS ---
class ImageOut(BaseModel):
    id: str
    copy_id: str
    side: str
    original_url: str
    width: Optional[int] = None
    height: Optional[int] = None
    file_size: Optional[int] = None
    status: str
    uploaded_at: datetime.datetime

    class Config:
        from_attributes = True


class ImageQualityOut(BaseModel):
    id: str
    image_id: str
    blur: float
    brightness: float
    contrast: float
    glare: float
    noise: float
    perspective: float
    rotation: float
    text_visibility: float
    overall_quality: float
    status: str
    analyzed_at: datetime.datetime

    class Config:
        from_attributes = True


# --- OCR & DECLARATION SCHEMAS ---
class DeclarationOut(BaseModel):
    id: str
    product_id: str
    declaration_type: str
    raw_text: Optional[str] = None
    normalized_value: Optional[str] = None
    confidence: float
    bbox_json: Optional[List[int]] = None
    verification_status: str
    source_image_id: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class DeclarationUpdate(BaseModel):
    normalized_value: str
    verification_status: str = "EDITS_ACCEPTED"


# --- COMPLIANCE & VIOLATION SCHEMAS ---
class RuleOut(BaseModel):
    id: str
    code: str
    name: str
    declaration_type: str
    requirement: str
    validation_type: str
    severity: str
    status: str

    class Config:
        from_attributes = True


class ComplianceResultOut(BaseModel):
    id: str
    product_id: str
    rule_id: str
    rule_code: Optional[str] = None
    rule_name: Optional[str] = None
    status: str
    detected_value: Optional[str] = None
    expected_value: Optional[str] = None
    confidence: float
    reason: Optional[str] = None
    evaluated_at: datetime.datetime

    class Config:
        from_attributes = True


class EvidenceOut(BaseModel):
    id: str
    violation_id: str
    annotated_image_url: Optional[str] = None
    ocr_text: Optional[str] = None
    english_text: Optional[str] = None
    bbox_json: Optional[List[int]] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class ViolationOut(BaseModel):
    id: str
    inspection_id: str
    product_id: str
    product_name: Optional[str] = None
    rule_id: str
    rule_code: Optional[str] = None
    violation_type: str
    severity: str
    description: str
    ai_confidence: float
    status: str
    created_at: datetime.datetime
    evidence: List[EvidenceOut] = []

    class Config:
        from_attributes = True


class ReviewActionRequest(BaseModel):
    action: str  # CONFIRM, REJECT, REQUEST_REINSPECTION
    comment: Optional[str] = None


# --- REPORT SCHEMAS ---
class ReportCreate(BaseModel):
    inspection_id: str
    title: str
    selected_product_ids: List[str]
    report_format: str = "PDF"  # PDF, JSON, CSV


class ReportOut(BaseModel):
    id: str
    inspection_id: str
    generated_by: str
    title: str
    report_format: str
    file_url: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True
