import uuid
import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, Enum
)
from sqlalchemy.orm import relationship
from app.database.connection import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role_name = Column(String(50), nullable=False, default="INSPECTOR")  # ADMIN or INSPECTOR
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    assignments_created = relationship("InspectionAssignment", foreign_keys="InspectionAssignment.assigned_by", back_populates="assigner")
    assignments_received = relationship("InspectionAssignment", foreign_keys="InspectionAssignment.inspector_id", back_populates="inspector")


class Role(Base):
    __tablename__ = "roles"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(50), unique=True, nullable=False)  # ADMIN, INSPECTOR
    description = Column(String(255))


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(100), unique=True, nullable=False)  # e.g. "inspections:assign"
    description = Column(String(255))


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    role_name = Column(String(50), nullable=False)
    permission_code = Column(String(100), nullable=False)


class Store(Base):
    __tablename__ = "stores"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    license_number = Column(String(100), unique=True, nullable=False)
    address = Column(Text, nullable=False)
    city = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    pincode = Column(String(20), nullable=False)
    owner_name = Column(String(255))
    contact_number = Column(String(50))
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    inspections = relationship("Inspection", back_populates="store")


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(50), unique=True, nullable=False)  # e.g. INS-2026-001
    store_id = Column(String(36), ForeignKey("stores.id"), nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    status = Column(String(50), default="UNASSIGNED")  # UNASSIGNED, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED
    priority = Column(String(20), default="NORMAL")  # NORMAL, HIGH, URGENT
    due_date = Column(DateTime, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    store = relationship("Store", back_populates="inspections")
    assignments = relationship("InspectionAssignment", back_populates="inspection")
    products = relationship("Product", back_populates="inspection")
    violations = relationship("Violation", back_populates="inspection")


class InspectionAssignment(Base):
    __tablename__ = "inspection_assignments"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    inspection_id = Column(String(36), ForeignKey("inspections.id"), nullable=False)
    inspector_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(50), default="ASSIGNED")  # UNASSIGNED, ASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, REASSIGNED, CANCELLED
    priority = Column(String(20), default="NORMAL")
    notes = Column(Text, nullable=True)

    inspection = relationship("Inspection", back_populates="assignments")
    assigner = relationship("User", foreign_keys=[assigned_by], back_populates="assignments_created")
    inspector = relationship("User", foreign_keys=[inspector_id], back_populates="assignments_received")


class Product(Base):
    __tablename__ = "products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    inspection_id = Column(String(36), ForeignKey("inspections.id"), nullable=False)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=False)  # Food, Cosmetic, Household, Electronics, Medical, General
    brand = Column(String(100))
    variant = Column(String(100))
    barcode = Column(String(100))
    status = Column(String(50), default="NOT_STARTED")  # NOT_STARTED, IN_PROGRESS, PASS, FAIL, REVIEW, COMPLETED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    inspection = relationship("Inspection", back_populates="products")
    copies = relationship("ProductCopy", back_populates="product")
    declarations = relationship("Declaration", back_populates="product")
    compliance_results = relationship("ComplianceResult", back_populates="product")
    violations = relationship("Violation", back_populates="product")


class ProductCopy(Base):
    __tablename__ = "product_copies"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    copy_number = Column(Integer, nullable=False)  # 1 to 5 maximum
    barcode_scanned = Column(String(100))
    notes = Column(Text)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="copies")
    images = relationship("ImageRecord", back_populates="copy")


class ImageRecord(Base):
    __tablename__ = "images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    copy_id = Column(String(36), ForeignKey("product_copies.id"), nullable=False)
    side = Column(String(20), nullable=False)  # FRONT, BACK, LEFT, RIGHT, TOP, BOTTOM
    original_url = Column(String(500), nullable=False)
    original_hash = Column(String(64))
    width = Column(Integer)
    height = Column(Integer)
    file_size = Column(Integer)
    mime_type = Column(String(50))
    status = Column(String(50), default="UPLOADED")  # UPLOADED, ANALYZED, ENHANCED, PROCESSED
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    copy = relationship("ProductCopy", back_populates="images")
    quality = relationship("ImageQualityRecord", back_populates="image", uselist=False)
    enhancements = relationship("ImageEnhancementRecord", back_populates="image")
    ai_results = relationship("AIResult", back_populates="image")
    ocr_results = relationship("OCRResult", back_populates="image")


class ImageQualityRecord(Base):
    __tablename__ = "image_quality"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False, unique=True)
    blur = Column(Float)
    brightness = Column(Float)
    contrast = Column(Float)
    glare = Column(Float)
    noise = Column(Float)
    perspective = Column(Float)
    rotation = Column(Float)
    text_visibility = Column(Float)
    overall_quality = Column(Float)
    status = Column(String(20), default="GOOD")  # GOOD, POOR, REVIEW
    analyzed_at = Column(DateTime, default=datetime.datetime.utcnow)

    image = relationship("ImageRecord", back_populates="quality")


class ImageEnhancementRecord(Base):
    __tablename__ = "image_enhancements"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False)
    enhanced_url = Column(String(500), nullable=False)
    operations_json = Column(JSON)  # List of applied steps
    quality_before = Column(Float)
    quality_after = Column(Float)
    ocr_confidence_before = Column(Float)
    ocr_confidence_after = Column(Float)
    enhanced_at = Column(DateTime, default=datetime.datetime.utcnow)

    image = relationship("ImageRecord", back_populates="enhancements")


class AIResult(Base):
    __tablename__ = "ai_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False)
    model_name = Column(String(100), nullable=False)
    model_version = Column(String(50), nullable=False)
    raw_response_json = Column(JSON)
    normalized_response_json = Column(JSON)
    processing_time = Column(Float)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    image = relationship("ImageRecord", back_populates="ai_results")


class OCRResult(Base):
    __tablename__ = "ocr_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=False)
    ocr_type = Column(String(20), default="ORIGINAL")  # ORIGINAL, ENHANCED
    selected = Column(Boolean, default=False)
    selection_score = Column(Float)
    selection_reason = Column(Text)
    full_text = Column(Text)
    engine = Column(String(50), default="PaddleOCR/AI-Model")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    image = relationship("ImageRecord", back_populates="ocr_results")
    regions = relationship("OCRRegion", back_populates="ocr_result")
    translations = relationship("TranslationRecord", back_populates="ocr_result")


class OCRRegion(Base):
    __tablename__ = "ocr_regions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ocr_result_id = Column(String(36), ForeignKey("ocr_results.id"), nullable=False)
    text = Column(Text, nullable=False)
    confidence = Column(Float, nullable=False)
    bbox_json = Column(JSON)  # [x, y, w, h]
    language = Column(String(10), default="en")

    ocr_result = relationship("OCRResult", back_populates="regions")


class TranslationRecord(Base):
    __tablename__ = "translations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    ocr_result_id = Column(String(36), ForeignKey("ocr_results.id"), nullable=False)
    source_language = Column(String(10), nullable=False)
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text, nullable=False)
    normalized_text = Column(Text)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    ocr_result = relationship("OCRResult", back_populates="translations")


class Declaration(Base):
    __tablename__ = "declarations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    declaration_type = Column(String(50), nullable=False)  # MRP, NET_QUANTITY, PACKING_DATE, EXPIRY_DATE, MANUFACTURER, PACKER, IMPORTER, CONSUMER_CARE, COUNTRY_OF_ORIGIN, BATCH_NUMBER, OTHER
    raw_text = Column(Text)
    normalized_value = Column(String(255))
    confidence = Column(Float, default=0.9)
    bbox_json = Column(JSON)
    verification_status = Column(String(50), default="DETECTED")  # DETECTED, VERIFIED, EDITS_ACCEPTED, MANUAL_ADDED
    source_image_id = Column(String(36), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="declarations")


class Rule(Base):
    __tablename__ = "rules"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    code = Column(String(50), unique=True, nullable=False)  # e.g. LM-MRP-001
    name = Column(String(255), nullable=False)
    declaration_type = Column(String(50), nullable=False)
    requirement = Column(Text, nullable=False)
    validation_type = Column(String(50), default="REQUIRED")  # REQUIRED, FORMAT, METRIC, PLACEMENT, FONT_SIZE
    severity = Column(String(20), default="HIGH")  # HIGH, MEDIUM, LOW
    status = Column(String(20), default="ACTIVE")

    versions = relationship("RuleVersion", back_populates="rule")


class RuleVersion(Base):
    __tablename__ = "rule_versions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    rule_id = Column(String(36), ForeignKey("rules.id"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    effective_date = Column(DateTime, default=datetime.datetime.utcnow)
    parameters_json = Column(JSON)

    rule = relationship("Rule", back_populates="versions")


class ComplianceResult(Base):
    __tablename__ = "compliance_results"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    declaration_id = Column(String(36), ForeignKey("declarations.id"), nullable=True)
    rule_id = Column(String(36), ForeignKey("rules.id"), nullable=False)
    status = Column(String(20), nullable=False)  # PASS, FAIL, REVIEW, NOT_APPLICABLE
    detected_value = Column(Text)
    expected_value = Column(Text)
    confidence = Column(Float, default=1.0)
    reason = Column(Text)
    evaluated_at = Column(DateTime, default=datetime.datetime.utcnow)

    product = relationship("Product", back_populates="compliance_results")


class Violation(Base):
    __tablename__ = "violations"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    inspection_id = Column(String(36), ForeignKey("inspections.id"), nullable=False)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)
    declaration_id = Column(String(36), ForeignKey("declarations.id"), nullable=True)
    rule_id = Column(String(36), ForeignKey("rules.id"), nullable=False)
    violation_type = Column(String(50), nullable=False)  # MISSING_DECLARATION, INCORRECT_VALUE, WRONG_PLACEMENT, FONT_SIZE, READABILITY, MISLEADING_DECLARATION, OTHER
    severity = Column(String(20), default="HIGH")
    description = Column(Text, nullable=False)
    ai_confidence = Column(Float, default=0.9)
    status = Column(String(50), default="PENDING")  # PENDING, CONFIRMED, REJECTED, REINSPECTION_REQUESTED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    inspection = relationship("Inspection", back_populates="violations")
    product = relationship("Product", back_populates="violations")
    evidence = relationship("Evidence", back_populates="violation")
    review_tasks = relationship("ReviewTask", back_populates="violation")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    violation_id = Column(String(36), ForeignKey("violations.id"), nullable=False)
    image_id = Column(String(36), ForeignKey("images.id"), nullable=True)
    annotated_image_url = Column(String(500))
    ocr_text = Column(Text)
    english_text = Column(Text)
    bbox_json = Column(JSON)
    rule_id = Column(String(36), ForeignKey("rules.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    violation = relationship("Violation", back_populates="evidence")


class ReviewTask(Base):
    __tablename__ = "review_tasks"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    violation_id = Column(String(36), ForeignKey("violations.id"), nullable=False)
    assigned_user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="PENDING")  # PENDING, CONFIRMED, REJECTED, REINSPECTED
    action_taken = Column(String(50))
    reviewer_comment = Column(Text)
    decision_timestamp = Column(DateTime, nullable=True)

    violation = relationship("Violation", back_populates="review_tasks")


class Report(Base):
    __tablename__ = "reports"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    inspection_id = Column(String(36), ForeignKey("inspections.id"), nullable=False)
    generated_by = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    report_format = Column(String(20), default="PDF")  # PDF, JSON, CSV
    file_url = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    report_products = relationship("ReportProduct", back_populates="report")


class ReportProduct(Base):
    __tablename__ = "report_products"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    report_id = Column(String(36), ForeignKey("reports.id"), nullable=False)
    product_id = Column(String(36), ForeignKey("products.id"), nullable=False)

    report = relationship("Report", back_populates="report_products")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=False)
    job_type = Column(String(50), nullable=False)
    status = Column(String(50), default="QUEUED")  # QUEUED, PROCESSING, COMPLETED, FAILED
    progress = Column(Float, default=0.0)
    current_step = Column(String(100))
    error_message = Column(Text)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="INFO")
    read_status = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), nullable=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(50), nullable=False)
    resource_id = Column(String(36), nullable=True)
    details_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
