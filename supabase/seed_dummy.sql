-- supabase/seed_dummy.sql — 어드민 화면 테스트용 더미 데이터
--
-- supabase/schema.sql을 먼저 실행한 뒤, 이 파일 전체를 SQL 편집기에 한 번에 붙여넣어
-- 실행합니다(중간에 나눠 실행하면 임시 테이블이 끊겨 에러가 납니다). 실행할 때마다
-- 기존 더미와 별개로 계속 "추가"만 됩니다(운영 데이터를 지우지 않음) — 완전히 새로
-- 다시 만들고 싶다면 맨 위 "기존 더미 삭제" 블록의 주석을 해제하세요.
--
-- 어드민 계정(admin_users)·설정(settings)·금기한자/한자DB 정정값은 이미
-- schema.sql이 시드하거나 실제 로그인 계정과 얽혀 있어 여기서는 건드리지 않습니다.
-- 회원(members)/주문(orders, premium+self 모두)/보고서(reports)/AI 비용(ai_usage)/
-- 감사로그(audit_logs)/퍼널 이벤트(events)/고객문의(inquiries)만 채웁니다.

-- ── (선택) 기존 더미 데이터 삭제 — 기본은 주석 처리되어 있음 ──────────
-- ⚠️ 운영 중인 실제 데이터가 섞여 있다면 절대 실행하지 마세요.
/*
delete from inquiries;
delete from audit_logs where actor = 'seed@dearname.kr';
delete from ai_usage;
delete from reports;
delete from orders;
delete from members where external_uid like 'seed-uid-%';
delete from events;
*/

begin;

-- ── members ──────────────────────────────────────────────────────────
create temporary table t_members on commit drop as
select
  gen_random_uuid() as id,
  -- 매 실행마다 고유해야 하는 unique 컬럼이라 uuid 조각을 섞는다(순번 i만 쓰면
  -- 재실행 시 이전 실행분과 겹쳐 "duplicate key" 에러로 전체 트랜잭션이 롤백된다).
  'seed-uid-' || substr(gen_random_uuid()::text, 1, 8) || '-' || i as external_uid,
  '테스트회원' || lpad(i::text, 2, '0') as name,
  'seed' || i || '@example.com' as contact,
  (array['google', 'apple', 'guest'])[1 + floor(random() * 3)::int] as login_provider,
  now() - (random() * interval '110 days') as created_at
from generate_series(1, 24) as s(i);

insert into members (id, external_uid, name, contact, login_provider, created_at)
select id, external_uid, name, contact, login_provider, created_at from t_members;

-- ── orders (premium + self 모두 생성) ───────────────────────────────
-- member_id를 "(select id from t_members order by random() limit 1)"처럼 스칼라
-- 서브쿼리로 뽑으면, 바깥 쿼리와 상관관계가 없어 플래너가 딱 한 번만 평가해 모든
-- 행에 같은 값을 재사용해버린다(uncorrelated subquery는 InitPlan으로 1회만 실행).
-- 그래서 배열로 한 번에 모아 CROSS JOIN한 뒤 행마다 랜덤 인덱스로 골라야 한다.
create temporary table t_member_pool on commit drop as
select array_agg(id) as ids from t_members;

create temporary table t_orders on commit drop as
with gen as (
  select
    i,
    mp.ids[1 + floor(random() * array_length(mp.ids, 1))::int] as member_id,
    case when random() < 0.6 then 'premium' else 'self' end as product,
    random() as r_status,
    now() - (random() * interval '100 days') - (random() * interval '23 hours') as created_at
  from generate_series(1, 90) as s(i)
  cross join t_member_pool mp
)
select
  gen_random_uuid() as id,
  member_id,
  product,
  case
    when product = 'premium' and random() < 0.08 then 0  -- 무료 생성권 소진분
    when product = 'premium' then (array[30000, 50000, 70000, 100000])[1 + floor(random() * 4)::int]
    else (array[9900, 14900, 19900])[1 + floor(random() * 3)::int]  -- 셀프작명 결제(더미 가정 가격)
  end as amount,
  case
    when r_status < 0.82 then 'paid'
    when r_status < 0.92 then 'refunded'
    else 'failed'
  end as status,
  created_at,
  case
    when product = 'premium' and random() < 0.08 then 'credit'
    else (array['카드', '가상계좌', '계좌이체', '간편결제', 'test'])[1 + floor(random() * 5)::int]
  end as payment_method
from gen;

insert into orders (id, member_id, product, amount, status, created_at, payment_method, toss_order_id, toss_payment_key, refunded_at)
select
  id,
  member_id,
  product,
  amount,
  status,
  created_at,
  payment_method,
  case when payment_method = 'credit' then null else 'seed_order_' || id end,
  case when payment_method in ('credit', 'test') then null else 'seed_pay_' || id end,
  case when status = 'refunded' then created_at + interval '1 day' else null end
from t_orders;

-- ── reports (결제완료 주문에 한해 생성) ──────────────────────────────
-- 이름도 마찬가지 이유로 "join lateral (... order by random() limit 1)"처럼
-- 바깥 행과 상관없는 서브쿼리를 쓰면 플래너가 한 번만 평가해 전 행이 같은 이름을
-- 갖게 된다. 배열 3개(이름/한자/성별, 같은 인덱스로 짝이 맞음)를 CROSS JOIN해서
-- 행마다 새로 뽑은 랜덤 인덱스 하나로 셋을 함께 골라야 한다.
create temporary table t_name_pool on commit drop as
select
  array['김서준','이하윤','박도윤','최서연','정지호','강수아','조민준','윤예은','장지안','임하은',
        '김도현','이서아','박준서','최유진','정하람','강시우','조아윤','윤서진','장하준','임소율'] as krs,
  array['金曙俊','李夏潤','朴道潤','崔瑞演','鄭智浩','姜秀雅','趙敏俊','尹禮恩','張智安','林夏恩',
        '金道賢','李瑞娥','朴俊書','崔有珍','鄭夏嵐','姜時佑','趙雅潤','尹瑞珍','張夏俊','林素律'] as hanjas,
  array['M','F','M','F','M','F','M','F','F','F','M','F','M','F','M','M','F','F','M','F'] as genders;

create temporary table t_reports on commit drop as
select
  gen_random_uuid() as id,
  o.id as order_id,
  o.created_at + interval '3 minutes' as created_at,
  np.krs[o.name_idx] as baby_name_kr,
  np.hanjas[o.name_idx] as baby_name_hanja,
  np.genders[o.name_idx] as gender,
  (o.created_at - (random() * interval '200 days')) as birth_dt,
  60 + floor(random() * 40)::int as score,
  o.product as product,
  case when o.product = 'premium' and random() < 0.3
    then (array[
      '터울이 있는 첫째와 어울리는 느낌이면 좋겠어요.',
      '할아버지 성함에 들어간 한자는 피해주세요.',
      '부르기 쉬우면서도 흔하지 않은 이름이었으면 합니다.',
      '차분하고 지혜로운 느낌의 이름을 원해요.'
    ])[1 + floor(random() * 4)::int]
    else null
  end as special_request
from (
  select *, 1 + floor(random() * 20)::int as name_idx
  from t_orders
  where status = 'paid'
) o
cross join t_name_pool np;

insert into reports (id, order_id, created_at, baby_name_kr, baby_name_hanja, birth_dt, gender, score, report_json, special_request)
select
  id, order_id, created_at, baby_name_kr, baby_name_hanja, birth_dt, gender, score,
  jsonb_build_object('tagline', baby_name_kr || '(' || baby_name_hanja || ') 이름 풀이 요약(더미)', 'score', score),
  special_request
from t_reports;

-- ── ai_usage (프리미엄 보고서 생성 비용 + 잡다한 챗 사용) ────────────
insert into ai_usage (created_at, kind, model, input_tokens, output_tokens, est_cost_usd)
select
  created_at,
  'report',
  (array['claude-sonnet-4-5', 'claude-opus-4-1'])[1 + floor(random() * 2)::int],
  1800 + floor(random() * 1200)::int as input_tokens,
  900 + floor(random() * 700)::int as output_tokens,
  round((0.01 + random() * 0.08)::numeric, 6)
from t_reports
where product = 'premium';

insert into ai_usage (created_at, kind, model, input_tokens, output_tokens, est_cost_usd)
select
  now() - (random() * interval '100 days'),
  'chat',
  'claude-sonnet-4-5',
  200 + floor(random() * 500)::int,
  100 + floor(random() * 300)::int,
  round((0.001 + random() * 0.01)::numeric, 6)
from generate_series(1, 15);

-- ── audit_logs (환불/재발급 등 더미 조작 이력) ───────────────────────
insert into audit_logs (created_at, actor, action, target_type, target_id, detail)
select
  o.created_at + interval '1 day',
  'seed@dearname.kr',
  'refund',
  'order',
  o.id,
  jsonb_build_object('amount', o.amount, 'reason', '고객 단순 변심(더미 데이터)')
from t_orders o
where o.status = 'refunded';

insert into audit_logs (created_at, actor, action, target_type, target_id, detail)
select
  r.created_at + interval '2 days',
  'seed@dearname.kr',
  'reissue_report',
  'report',
  r.id,
  jsonb_build_object('note', '무료 생성권 부여(더미 데이터)')
from t_reports r
order by random()
limit 5;

-- ── events (전환율 퍼널) ──────────────────────────────────────────────
insert into events (created_at, name, session_id)
select
  now() - (random() * interval '100 days'),
  (array['self_done', 'self_done', 'self_done', 'premium_view', 'premium_view', 'checkout_start'])[1 + floor(random() * 6)::int],
  'seed-session-' || floor(random() * 500)::int
from generate_series(1, 260);

insert into events (created_at, name, session_id)
select created_at, 'paid', 'seed-session-order-' || row_number() over ()
from t_orders
where status = 'paid';

-- ── inquiries (고객문의 + 컴플레인) ──────────────────────────────────
-- 결제·환불(category='payment') 컴플레인은 어떤 결제건에 대한 것인지 order_id로
-- 특정한다. "select ... where o2.member_id = m.id"는 바깥 행(m.id)과 상관관계가
-- 있는 서브쿼리라서(위 member_id/이름 뽑기와 달리) 플래너가 매번 새로 평가한다.
insert into inquiries (created_at, member_id, report_id, order_id, subject, message, status, reply, replied_at, replied_by, type, category, priority)
select
  m.created_at + interval '5 days',
  m.id,
  null,
  case when category = 'payment'
    then (select o2.id from orders o2 where o2.member_id = m.id order by random() limit 1)
    else null
  end,
  subj,
  msg,
  st,
  reply,
  case when st = 'answered' then m.created_at + interval '6 days' else null end,
  case when st = 'answered' then 'admin@dearname.kr' else null end,
  typ,
  category,
  priority
from (
  select id, created_at, row_number() over () as rn
  from (select id, created_at from t_members order by random() limit 12) picked
) m
join (values
  (1, '환불 문의', '결제가 잘못된 것 같은데 확인 부탁드려요.', 'answered', '확인 결과 정상 결제 건이며, 자세한 내역은 이메일로 안내드렸습니다.', 'general', null, 'normal'),
  (2, '보고서 재발급', '보고서를 다시 받고 싶어요.', 'answered', '무료 생성권을 지급해드렸습니다. 로그인 후 다시 진행해주세요.', 'general', null, 'normal'),
  (3, '이름 후보 추가 요청', '한자 후보를 더 볼 수 없나요?', 'pending', null, 'general', null, 'normal'),
  (4, '결제 오류', '결제 중 오류가 발생했습니다.', 'pending', null, 'general', null, 'normal'),
  (5, '기타 문의', '서비스 이용 방법이 궁금합니다.', 'answered', '홈페이지 이용 가이드를 안내드렸습니다.', 'general', null, 'normal'),
  (6, '한자 뜻 문의', '이 한자의 뜻이 정확한지 궁금해요.', 'pending', null, 'general', null, 'normal'),
  (7, '탈퇴 문의', '회원 탈퇴는 어떻게 하나요?', 'answered', '고객센터로 별도 요청 시 처리해드리고 있습니다.', 'general', null, 'normal'),
  (8, '프리미엄 문의', '프리미엄과 셀프작명의 차이가 궁금합니다.', 'answered', '프리미엄은 AI 심층 분석과 전문가 감수가 포함됩니다.', 'general', null, 'normal'),
  (9, '가격 문의', '할인 프로모션이 있나요?', 'pending', null, 'general', null, 'normal'),
  (10, '기타', '감사합니다!', 'answered', '이용해주셔서 감사합니다 :)', 'general', null, 'normal'),
  (11, '보고서 품질 불만', '기대했던 것보다 내용이 부실한 것 같아 불만입니다.', 'pending', null, 'complaint', 'quality', 'urgent'),
  (12, '환불 처리 지연 불만', '환불 요청한 지 며칠이 지났는데 아직도 처리가 안 됐어요.', 'pending', null, 'complaint', 'payment', 'urgent')
) as content(rn, subj, msg, st, reply, typ, category, priority) on content.rn = m.rn;

commit;

-- ── 결과 확인 ─────────────────────────────────────────────────────────
select 'members' as table_name, count(*) from members
union all select 'orders', count(*) from orders
union all select 'orders(self)', count(*) from orders where product = 'self'
union all select 'orders(premium)', count(*) from orders where product = 'premium'
union all select 'reports', count(*) from reports
union all select 'ai_usage', count(*) from ai_usage
union all select 'audit_logs', count(*) from audit_logs
union all select 'events', count(*) from events
union all select 'inquiries', count(*) from inquiries;
