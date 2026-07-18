-- supabase/schema.sql — DearName 어드민 이전 계획 Phase 0 (admin_site_plan.md 3장)
-- Supabase SQL 편집기에 그대로 붙여넣어 실행한다.
--
-- 실행 순서: 이 파일 전체를 한 번에 실행하면 테이블 6개 + 인덱스 + RLS +
-- 회원 집계(order_count/total_spent/last_order_at) 자동 갱신 트리거까지 함께 생성된다.

create extension if not exists pgcrypto;

-- ── members — 회원 ──────────────────────────────────────────────────
create table if not exists members (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  external_uid    text unique,        -- 프론트 dn_user_key(게스트) 또는 소셜 로그인 sub
  name            text,               -- ⚠️ 개인정보
  contact         text,               -- ⚠️ 개인정보(이메일/전화)
  login_provider  text,               -- 'google' / 'apple' / 'guest'
  order_count     int not null default 0,
  total_spent     int not null default 0,
  last_order_at   timestamptz
);
create index if not exists idx_members_contact on members(contact);

-- ── orders — 주문·결제 ──────────────────────────────────────────────
create table if not exists orders (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  member_id         uuid references members(id),
  product           text not null,     -- 'premium' / 'self'
  amount            int not null,
  status            text not null default 'paid',  -- 'paid' / 'refunded' / 'failed'
  toss_order_id     text,
  toss_payment_key  text,
  refunded_at       timestamptz,
  payment_method    text  -- 토스 응답의 method('카드'/'가상계좌'/'계좌이체' 등) 또는 테스트 모드 'test'
);
-- 이미 orders 테이블을 만든 뒤 이 스크립트를 다시 실행하는 경우를 위한 컬럼 추가(신규 생성 시에는 위 정의로 이미 포함됨)
alter table orders add column if not exists payment_method text;
create index if not exists idx_orders_created_at on orders(created_at);
create index if not exists idx_orders_status     on orders(status);
create index if not exists idx_orders_member_id  on orders(member_id);

-- ── reports — 생성된 작명 보고서 ─────────────────────────────────────
create table if not exists reports (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid references orders(id),
  created_at       timestamptz not null default now(),
  baby_name_kr     text,
  baby_name_hanja  text,
  birth_dt         timestamptz,  -- ⚠️ 개인정보
  gender           text,
  score            int,
  report_json      jsonb         -- Claude가 생성한 보고서 전체 (재발급용)
);
create index if not exists idx_reports_order_id on reports(order_id);

-- ── ai_usage — AI 비용 모니터링 ──────────────────────────────────────
create table if not exists ai_usage (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  kind           text not null,   -- 'report' / 'chat'
  model          text not null,
  input_tokens   int not null default 0,
  output_tokens  int not null default 0,
  est_cost_usd   numeric(12,6) not null default 0
);
create index if not exists idx_ai_usage_created_at on ai_usage(created_at);

-- ── audit_logs — 감사 로그(환불 등 민감작업, 어드민 전용 사용) ───────
create table if not exists audit_logs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  actor        text not null,   -- 작업한 운영자 이메일
  action       text not null,   -- 'refund' / 'view_member' / 'resend_report' / 'export'
  target_type  text not null,   -- 'order' / 'member' / 'report'
  target_id    uuid,
  detail       jsonb
);
create index if not exists idx_audit_logs_created_at on audit_logs(created_at);

-- ── events — 전환율 퍼널 (Phase 2) ───────────────────────────────────
create table if not exists events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,  -- 'self_done' / 'premium_view' / 'checkout_start' / 'paid'
  session_id  text
);
create index if not exists idx_events_created_at on events(created_at);

-- ── members 집계 자동 갱신 트리거 ─────────────────────────────────────
-- orders에 INSERT/UPDATE 될 때마다 해당 회원의 order_count/total_spent/last_order_at을 재계산
create or replace function _dn_refresh_member_stats() returns trigger as $$
begin
  if new.member_id is not null then
    update members m set
      order_count   = (select count(*) from orders o where o.member_id = new.member_id and o.status = 'paid'),
      total_spent   = (select coalesce(sum(o.amount), 0) from orders o where o.member_id = new.member_id and o.status = 'paid'),
      last_order_at = (select max(o.created_at) from orders o where o.member_id = new.member_id)
    where m.id = new.member_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_dn_refresh_member_stats on orders;
create trigger trg_dn_refresh_member_stats
  after insert or update of status on orders
  for each row execute function _dn_refresh_member_stats();

-- ── RLS — 운영자(인증된 Supabase 사용자)만 조회 가능, 익명은 전부 차단 ─
-- 본 서비스(server.py)는 service_role 키로 쓰므로 RLS의 영향을 받지 않는다.
alter table members    enable row level security;
alter table orders     enable row level security;
alter table reports    enable row level security;
alter table ai_usage   enable row level security;
alter table audit_logs enable row level security;
alter table events     enable row level security;

drop policy if exists "운영자 조회" on members;
create policy "운영자 조회" on members for select using (auth.role() = 'authenticated');

drop policy if exists "운영자 조회" on orders;
create policy "운영자 조회" on orders for select using (auth.role() = 'authenticated');

drop policy if exists "운영자 조회" on reports;
create policy "운영자 조회" on reports for select using (auth.role() = 'authenticated');

drop policy if exists "운영자 조회" on ai_usage;
create policy "운영자 조회" on ai_usage for select using (auth.role() = 'authenticated');

drop policy if exists "운영자 조회" on audit_logs;
create policy "운영자 조회" on audit_logs for select using (auth.role() = 'authenticated');

drop policy if exists "운영자 조회" on events;
create policy "운영자 조회" on events for select using (auth.role() = 'authenticated');

-- 참고: 어드민 화면(dearname-admin)에서 로그인 허용 이메일을 더 좁히려면
-- auth.jwt()->>'email' = ANY(array[...]) 조건을 위 정책에 추가한다.

-- ── 매출 추이 뷰 (STEP 7 — 어드민 대시보드 일/월/연 그래프) ──────────
-- 별도 집계 테이블 없이 orders를 date_trunc로 그룹핑한 뷰. 뷰는 SECURITY DEFINER가
-- 아니므로 조회 시 orders에 걸린 RLS 정책("운영자 조회")을 그대로 따른다.
create or replace view revenue_daily as
  select
    date_trunc('day', created_at) as bucket,
    count(*) filter (where status = 'paid') as order_count,
    coalesce(sum(amount) filter (where status = 'paid'), 0) as revenue,
    count(*) filter (where status = 'refunded') as refund_count,
    coalesce(sum(amount) filter (where status = 'refunded'), 0) as refund_amount
  from orders
  group by 1;

create or replace view revenue_monthly as
  select
    date_trunc('month', created_at) as bucket,
    count(*) filter (where status = 'paid') as order_count,
    coalesce(sum(amount) filter (where status = 'paid'), 0) as revenue,
    count(*) filter (where status = 'refunded') as refund_count,
    coalesce(sum(amount) filter (where status = 'refunded'), 0) as refund_amount
  from orders
  group by 1;

create or replace view revenue_yearly as
  select
    date_trunc('year', created_at) as bucket,
    count(*) filter (where status = 'paid') as order_count,
    coalesce(sum(amount) filter (where status = 'paid'), 0) as revenue,
    count(*) filter (where status = 'refunded') as refund_count,
    coalesce(sum(amount) filter (where status = 'refunded'), 0) as refund_amount
  from orders
  group by 1;

create or replace view revenue_by_product as
  select
    product,
    count(*) as order_count,
    coalesce(sum(amount), 0) as revenue
  from orders
  where status = 'paid'
  group by 1;

create or replace view revenue_by_payment_method as
  select
    coalesce(payment_method, '미지정') as payment_method,
    count(*) as order_count,
    coalesce(sum(amount), 0) as revenue
  from orders
  where status = 'paid'
  group by 1;

-- ── AI 비용 뷰 (Phase 2 — 어드민 AI 비용 대시보드) ────────────────────
create or replace view ai_cost_daily as
  select
    date_trunc('day', created_at) as bucket,
    model,
    kind,
    count(*) as calls,
    sum(input_tokens) as input_tokens,
    sum(output_tokens) as output_tokens,
    sum(est_cost_usd) as cost_usd
  from ai_usage
  group by 1, 2, 3;

-- ── settings — 운영자 설정 (Phase 3 — 가격/점검모드) ──────────────────
-- key-value 저장소. 본 서비스(server.py)는 GET /api/settings로 조회만 하고,
-- 쓰기는 어드민의 Route Handler(service_role)에서만 수행한다.
create table if not exists settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table settings enable row level security;
drop policy if exists "운영자 조회" on settings;
create policy "운영자 조회" on settings for select using (auth.role() = 'authenticated');

-- 기본값 시드 — 이미 있으면 건드리지 않음(재실행 안전)
insert into settings (key, value) values
  ('pricing', '{"tiers":[{"count":1,"price":30000},{"count":2,"price":50000},{"count":3,"price":70000},{"count":5,"price":100000}]}'::jsonb),
  ('maintenance', '{"enabled":false,"message":""}'::jsonb)
on conflict (key) do nothing;

-- ── taboo_hanja — 금기 한자 관리 (Phase 3) ────────────────────────────
-- 지금까지 lib/name-search-worker.js에 하드코딩돼 있던 "뜻이 불길한 한자"
-- 목록을 여기로 옮긴다. 본 서비스는 GET /api/taboo-hanja로 조회만 하고
-- (DB 미설정/미조회 시 코드 내장 기본값 42자로 폴백), 쓰기는 어드민에서만 한다.
create table if not exists taboo_hanja (
  hanja       text primary key,
  reason      text,
  created_at  timestamptz not null default now(),
  created_by  text
);

alter table taboo_hanja enable row level security;
drop policy if exists "운영자 조회" on taboo_hanja;
create policy "운영자 조회" on taboo_hanja for select using (auth.role() = 'authenticated');

-- 기존 하드코딩 42자 시드 — 이미 있으면 건드리지 않음(재실행 안전)
insert into taboo_hanja (hanja) values
  ('死'),('鬼'),('亡'),('殺'),('邪'),('禍'),('毒'),('凶'),('惡'),
  ('賤'),('奴'),('罪'),('貧'),('苦'),('怨'),('恨'),('悲'),('哭'),('泣'),
  ('危'),('破'),('敗'),('廢'),('末'),('窮'),('孤'),('暗'),
  ('盲'),('啞'),('癡'),('狂'),('愚'),('劣'),('醜'),('陋'),('拙'),
  ('辱'),('侮'),('欺'),('奸'),('賊'),('盜')
on conflict (hanja) do nothing;

-- ── hanja_overrides — 한자 DB 수정 (Phase 3) ──────────────────────────
-- data/hanja-db.js의 7000여 자를 통째로 옮기지 않고, 정정값만 여기 저장한다.
-- (hanja, kr) 조합이 PK인 이유: 다음자(多音字, 같은 한자가 여러 음으로 읽힘,
-- 예: 更=경/갱)는 음마다 뜻(m)이 다를 수 있어 음 단위로 정정해야 한다.
create table if not exists hanja_overrides (
  hanja       text not null,
  kr          text not null,
  m           text,
  s           int,
  o           text,
  updated_at  timestamptz not null default now(),
  updated_by  text,
  primary key (hanja, kr)
);

alter table hanja_overrides enable row level security;
drop policy if exists "운영자 조회" on hanja_overrides;
create policy "운영자 조회" on hanja_overrides for select using (auth.role() = 'authenticated');
