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
