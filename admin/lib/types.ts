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
  // 회원탈퇴 시각. 탈퇴하면 name/contact/external_uid는 비워지고 이 값만 남는다
  // (주문·보고서 등 전자상거래법상 보존 대상 기록과의 연결은 유지).
  withdrawn_at: string | null;
  // 이용제한(정지) — 탈퇴와 달리 개인정보는 지우지 않고 상태만 바꿔, 해제하면 그대로 다시 쓸 수 있다.
  suspended_at: string | null;
  suspended_reason: string | null;
  suspended_by: string | null;
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
  last_viewed_at: string | null;
  // 결제일로부터 6개월 지나 개인정보성 필드(성명·생년월일·리포트 본문 등)를 지운 시각.
  // gender·score는 비식별 통계(report_stats_monthly)에 계속 쓰이므로 파기 후에도 남아있다.
  purged_at: string | null;
}

// 비식별화 통계(개인정보처리방침 제3조5·8호) — report_stats_monthly 뷰
export interface ReportStatsMonthlyRow {
  month: string;
  gender: string | null;
  report_count: number;
  avg_score: number | null;
}

// 보고서 링크 메일 발송 이력 — report_email_logs 테이블
export interface ReportEmailLogRow {
  id: string;
  created_at: string;
  report_id: string | null;
  member_id: string | null;
  to_email: string;
  status: 'sent' | 'failed';
  error: string | null;
  sent_by: string | null;  // null이면 고객 본인이 마이페이지에서 발송한 건
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
  order_id: string | null;
  subject: string | null;
  message: string;
  status: 'pending' | 'answered';
  reply: string | null;
  replied_at: string | null;
  replied_by: string | null;
  type: 'general' | 'complaint';
  category: string | null;
  priority: 'low' | 'normal' | 'urgent';
  members?: { name: string | null; contact: string | null; withdrawn_at: string | null } | null;
}

export const INQUIRY_CATEGORY_LABELS: Record<string, string> = {
  quality: '소견서 품질',
  payment: '결제·환불',
  service: '응대 불만',
  etc: '기타',
};

// legal_documents — 이용약관·개인정보처리방침 본문(저장할 때마다 새 행 = 개정 이력)
export type LegalDocType = 'terms' | 'privacy';

export interface LegalDocumentRow {
  id: string;
  created_at: string;
  doc_type: LegalDocType;
  content: string;
  effective_date: string | null;
  updated_by: string | null;
}

export const LEGAL_DOC_LABELS: Record<LegalDocType, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
};

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
  auth_user_id: string | null;
  must_change_password: boolean;
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
