export type RoleType = 'ADMIN' | 'INSPECTOR';

export type InspectionStatus = 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type PriorityType = 'NORMAL' | 'HIGH' | 'URGENT';

export type ComplianceStatus = 'PASS' | 'FAIL' | 'REVIEW' | 'PROCESSING' | 'NOT_APPLICABLE';

export type QualityStatus = 'GOOD' | 'POOR' | 'REVIEW';

export type PackageSide = 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT' | 'TOP' | 'BOTTOM';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role_name: RoleType;
  is_active: boolean;
  created_at: string;
}

export interface Store {
  id: string;
  name: string;
  license_number: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  owner_name?: string;
  contact_number?: string;
  created_at: string;
}

export interface Inspection {
  id: string;
  code: string;
  store_id: string;
  created_by: string;
  status: InspectionStatus;
  priority: PriorityType;
  due_date?: string;
  notes?: string;
  created_at: string;
  completed_at?: string;
  store_name?: string;
  assigned_inspector_id?: string;
  assigned_inspector_name?: string;
  product_count: number;
  violation_count: number;
}

export interface ProductCopy {
  id: string;
  product_id: string;
  copy_number: number;
  barcode_scanned?: string;
  notes?: string;
  status: string;
  created_at: string;
}

export interface Product {
  id: string;
  inspection_id: string;
  name: string;
  category: string;
  brand?: string;
  variant?: string;
  barcode?: string;
  status: ComplianceStatus;
  created_at: string;
  copy_count: number;
  copies: ProductCopy[];
}

export interface ImageRecord {
  id: string;
  copy_id: string;
  side: PackageSide;
  original_url: string;
  width?: number;
  height?: number;
  file_size?: number;
  status: string;
  uploaded_at: string;
}

export interface ImageQuality {
  id: string;
  image_id: string;
  blur: number;
  brightness: number;
  contrast: number;
  glare: number;
  noise: number;
  perspective: number;
  rotation: number;
  text_visibility: number;
  overall_quality: number;
  status: QualityStatus;
  analyzed_at: string;
}

export interface Declaration {
  id: string;
  product_id: string;
  declaration_type: string;
  raw_text?: string;
  normalized_value?: string;
  confidence: number;
  bbox_json?: number[];
  verification_status: string;
  source_image_id?: string;
  created_at: string;
}

export interface ComplianceResult {
  id: string;
  product_id: string;
  rule_id: string;
  rule_code?: string;
  rule_name?: string;
  status: ComplianceStatus;
  detected_value?: string;
  expected_value?: string;
  confidence: number;
  reason?: string;
  evaluated_at: string;
}

export interface Evidence {
  id: string;
  violation_id: string;
  annotated_image_url?: string;
  ocr_text?: string;
  english_text?: string;
  bbox_json?: number[];
  created_at: string;
}

export interface Violation {
  id: string;
  inspection_id: string;
  product_id: string;
  product_name?: string;
  rule_id: string;
  rule_code?: string;
  violation_type: string;
  severity: string;
  description: string;
  ai_confidence: number;
  status: 'PENDING' | 'CONFIRMED' | 'REJECTED' | 'REINSPECTION_REQUESTED';
  created_at: string;
  evidence: Evidence[];
}

export interface Report {
  id: string;
  inspection_id: string;
  generated_by: string;
  title: string;
  report_format: 'PDF' | 'JSON' | 'CSV';
  file_url: string;
  created_at: string;
}
