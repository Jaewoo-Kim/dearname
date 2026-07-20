export type OrderStatus = 'paid' | 'refunded' | 'failed';
export type Product = 'premium' | 'self';

export interface Member {
  id: string;
  created_at: string;
  external_uid: string | null;
  name: string | null;
  contact: string | null;
  login_provider: string | null;
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
}

export interface Order {
  id: string;
  created_at: string;
  member_id: string | null;
  product: Product;
  amount: number;
  status: OrderStatus;
  toss_order_id: string | null;
  toss_payment_key: string | null;
  refunded_at: string | null;
  payment_method: string | null;
  members?: Member | null;
}

export interface Report {
  id: string;
  order_id: string | null;
  created_at: string;
  baby_name_kr: string | null;
  baby_name_hanja: string | null;
  birth_dt: string | null;
  gender: string | null;
  score: number | null;
  report_json: unknown;
  special_request: string | null;
}

// STEP 7 대시보드 — supabase/schema.sql의 revenue_daily/monthly/yearly 뷰
export interface RevenueRow {
  bucket: string;
  order_count: number;
  revenue: number;
  refund_count: number;
  refund_amount: number;
}

// supabase/schema.sql의 revenue_by_product 뷰
export interface ProductMixRow {
  product: Product;
  order_count: number;
  revenue: number;
}

// supabase/schema.sql의 revenue_by_payment_method 뷰
export interface PaymentMethodRow {
  payment_method: string;
  order_count: number;
  revenue: number;
}

// Phase 3 — settings 테이블 (key-value)
export interface PricingTier {
  count: number;
  price: number;
}

export interface PricingPromotion {
  enabled: boolean;
  percent: number;
  label: string;
}

export interface PricingSettings {
  self: number;
  tiers: PricingTier[];
  promotion: PricingPromotion;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

// audit_logs 테이블
export interface AuditLogRow {
  id: string;
  created_at: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: unknown;
}

// 고객문의 — inquiries 테이블
export interface InquiryRow {
  id: string;
  created_at: string;
  member_id: string | null;
  report_id: string | null;
  subject: string | null;
  message: string;
  status: 'pending' | 'answered';
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
  members?: { name: string | null; contact: string | null } | null;
}

// Phase 3 — taboo_hanja 테이블
export interface TabooHanjaRow {
  hanja: string;
  reason: string | null;
}

// admin_users — 어드민 계정 등급
export interface AdminUserRow {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

// pending_settings_changes — 운영 관리(가격/점검모드) 변경 승인 대기열
export interface PendingSettingsChange {
  id: string;
  created_at: string;
  key: 'pricing' | 'maintenance';
  requested_value: unknown;
  previous_value: unknown;
  requested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
}

// Phase 3 — 본 서비스 GET /api/hanja/search 응답 (data/hanja-db.js + hanja_overrides 병합 결과)
export interface HanjaSearchResult {
  kr: string;
  h: string;
  m: string | null;
  s: number | null;
  o: string | null;
  baseM: string | null;
  baseS: number | null;
  baseO: string | null;
  overridden: boolean;
}
