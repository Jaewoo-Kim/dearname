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

export interface PricingSettings {
  tiers: PricingTier[];
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
}

// Phase 3 — taboo_hanja 테이블
export interface TabooHanjaRow {
  hanja: string;
  reason: string | null;
}
