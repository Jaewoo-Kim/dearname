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

-- ── 확인용 (실행 후 아래 쿼리로 컬럼이 생겼는지 볼 수 있습니다) ────
-- select column_name, data_type, column_default
--   from information_schema.columns
--  where table_name in ('inquiries', 'members')
--    and column_name in ('type','category','priority','order_id','withdrawn_at')
--  order by table_name, column_name;
