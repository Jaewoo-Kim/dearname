-- supabase/migration_2026-08-07.sql
-- 컴플레인 접수 기능 + 회원탈퇴 기능을 위한 증분 마이그레이션
--
-- 사용법: Supabase 대시보드 → SQL Editor에 이 파일 전체를 붙여넣고 실행(Run).
--
-- 이미 schema.sql 전체를 다시 실행하셨다면 이 파일은 실행할 필요가 없습니다
-- (schema.sql에 아래 내용이 모두 포함되어 있습니다).
-- 운영 중인 DB라 전체 재실행이 부담스러울 때 이 파일만 실행하시면 됩니다.
--
-- 모든 구문이 `if not exists`라서 여러 번 실행해도 안전합니다(멱등).
-- 기존 데이터는 삭제되지 않으며, 새 컬럼은 아래 기본값으로 채워집니다.

-- ── 1. 고객문의 → 컴플레인 확장 ────────────────────────────────────
-- 기존 문의는 모두 type='general'(일반 문의), priority='normal'로 채워집니다.
alter table inquiries add column if not exists type text not null default 'general';  -- 'general' / 'complaint'
alter table inquiries add column if not exists category text;  -- 컴플레인 사유: 'quality'/'payment'/'service'/'etc' (일반 문의는 null)
alter table inquiries add column if not exists priority text not null default 'normal';  -- 'low' / 'normal' / 'urgent'
create index if not exists idx_inquiries_type on inquiries(type);

-- 결제·환불 컴플레인일 때 어떤 결제건에 대한 것인지 연결 (report_id와 별개)
alter table inquiries add column if not exists order_id uuid references orders(id);
create index if not exists idx_inquiries_order_id on inquiries(order_id);

-- ── 2. 회원탈퇴(계정삭제) ──────────────────────────────────────────
-- 탈퇴 시 name/contact/external_uid는 비우고 이 컬럼에 탈퇴 시각만 남긴다.
-- 주문·보고서 등 전자상거래법상 보존이 필요한 거래기록은 member_id 연결로 유지된다.
alter table members add column if not exists withdrawn_at timestamptz;

-- ── 3. 보고서 링크 열람·발송 이력 ──────────────────────────────────
-- "메일을 못 받았다"는 문의가 왔을 때 발송 여부와 열람 여부를 확인하기 위한 기록.
alter table reports add column if not exists last_viewed_at timestamptz;

create table if not exists report_email_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  report_id   uuid references reports(id),
  member_id   uuid references members(id),
  to_email    text not null,
  status      text not null,          -- 'sent' / 'failed'
  error       text,
  sent_by     text                    -- null = 고객 본인 발송, 값이 있으면 재발송한 운영자 이메일
);
create index if not exists idx_report_email_logs_report_id on report_email_logs(report_id);
create index if not exists idx_report_email_logs_created_at on report_email_logs(created_at);

alter table report_email_logs enable row level security;
drop policy if exists "운영자 조회" on report_email_logs;
create policy "운영자 조회" on report_email_logs for select using (auth.role() = 'authenticated');

-- ── 4. 약관·개인정보처리방침 어드민 편집 ───────────────────────────
-- 저장할 때마다 새 행을 쌓아 개정 이력을 남긴다(UPDATE하지 않는다).
-- 행이 없으면 본 서비스는 저장소의 정적 파일을 그대로 보여주므로 비어 있어도 안전하다.
create table if not exists legal_documents (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  doc_type       text not null,        -- 'terms' / 'privacy'
  content        text not null,
  effective_date date,
  updated_by     text
);
create index if not exists idx_legal_documents_type_created
  on legal_documents(doc_type, created_at desc);

alter table legal_documents enable row level security;
drop policy if exists "운영자 조회" on legal_documents;
create policy "운영자 조회" on legal_documents for select using (auth.role() = 'authenticated');

-- ── 5. 보고서 소유자 직접 연결 ─────────────────────────────────────
-- 지금까지는 reports → orders → members 경로로만 소유자를 찾을 수 있어서, 결제 직후
-- 주문 기록이 실패한 보고서(order_id가 null)는 고객이 마이페이지에서도, 이메일
-- 재발송으로도 되찾을 수 없었다. 소유자를 보고서에 직접 남겨 이 사각지대를 없앤다.
alter table reports add column if not exists member_id uuid references members(id);
create index if not exists idx_reports_member_id on reports(member_id);

-- 기존 보고서 보정: 연결된 주문의 소유자를 그대로 채워 넣는다(여러 번 실행해도 안전).
update reports r set member_id = o.member_id
  from orders o where r.order_id = o.id and r.member_id is null;

-- ── 6. 필수 동의(이용약관·개인정보처리방침) 및 마케팅 선택 동의 ──────
-- terms_agreed_at이 없으면 아직 필수 동의를 하지 않은 회원이라 서비스 이용을 막는다.
alter table members add column if not exists terms_agreed_at timestamptz;
alter table members add column if not exists privacy_agreed_at timestamptz;
alter table members add column if not exists marketing_agreed boolean not null default false;
alter table members add column if not exists marketing_agreed_at timestamptz;

-- ── 확인용 (실행 후 아래 쿼리로 컬럼이 생겼는지 볼 수 있습니다) ────
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_name in ('inquiries', 'members')
--    and column_name in ('type','category','priority','order_id','withdrawn_at')
--  order by table_name, column_name;
