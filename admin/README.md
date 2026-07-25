# dearname-admin

DearName 운영 어드민. `admin_site_plan.md` STEP 3~7(Phase 1) + Phase 2(전환율 퍼널, AI 비용,
결제수단별 매출) + Phase 3(가격/프로모션/점검모드/금기 한자/한자DB 수정/재발급 생성권/고객문의) 구현.

## 구성

- Next.js 14 (App Router) + Tailwind + Recharts
- Supabase Auth(이메일+비밀번호, 자가 가입 없이 어드민이 계정을 직접 생성) + Postgres(RLS + 매출/AI비용 집계 뷰)
- 화면: 대시보드(월/연 전환 + 월·연 선택 + 매출 추이 12개월 고정·상품 비중·결제수단 그래프) /
  주문·결제(기간 필터+목록+통합 상세, 환불) / 보고서(기간 필터+목록+상세, 재발급(생성권 부여)·열기,
  특별 요청사항 표시) / 고객문의(기간·상태 필터+목록+상세 응대) / 회원(기간 필터+목록+상세, 환불) /
  전환율 퍼널 / AI 비용 / 한자 DB(검색+수정+금기 한자 관리) / 운영 관리(가격·프로모션·상품 구성·점검모드)
- 환불: `/api/refund` Route Handler가 토스페이먼츠 결제취소 API를 서버에서만 호출(브라우저는 직접 호출 안 함) —
  주문·회원 상세에서만 실행 가능(보고서 상세에서는 제거됨)
- 설정: `/api/settings`, `/api/taboo-hanja`, `/api/hanja-overrides`, `/api/reports/[id]/reissue`,
  `/api/inquiries/[id]/reply` Route Handler가 service_role로 저장 — 본 서비스는 각각
  `GET /api/settings`·`/api/taboo-hanja`·`/api/hanja/overrides`·`/proxy/credit/*`·`/proxy/inquiry/*`로
  조회/소진만 함(브라우저가 직접 DB에 쓰지 않음)

## 로컬 실행

```bash
cd admin
npm install
cp .env.example .env.local   # Supabase URL/키, 환불용 시크릿 입력
npm run dev
```

사전 준비: 저장소 루트의 `supabase/schema.sql`을 Supabase SQL 편집기에서 실행해 테이블·RLS를 만들어야 합니다.

## 로그인 · 계정 관리 (Phase 4)

이메일+비밀번호 방식이며 자가 가입은 불가능합니다 — 어드민만 `/team` 화면에서 새 계정(이메일·
초기 비밀번호·등급)을 만들 수 있고, 그 자격 증명 자체가 로그인 가능 여부를 결정합니다(과거의
`ADMIN_ALLOWED_EMAILS` 환경변수 허용목록은 더 이상 쓰지 않습니다 — 계정 생성 자체가
service_role API로 통제되므로 별도 허용목록이 불필요해졌습니다).

- 최초 배포 시 `admin_users` 테이블이 비어있으면, 그 상태에서 처음 로그인하는 계정이 자동으로
  어드민이 됩니다(부트스트랩). 그 계정은 Supabase 대시보드(Authentication → Users → Add user)에서
  이메일+비밀번호로 직접 만들어야 합니다 — 이후 신규 팀원은 `/team`에서 어드민이 만들면 됩니다.
- 등급: 어드민(등급 관리+운영 관리 즉시 반영+승인), 편집자(대부분의 쓰기 작업 가능, 운영
  관리 변경은 어드민 승인 필요), 뷰어(조회만).
- `/team`에서 계정 추가·등급 변경·비밀번호 강제 재설정·계정 삭제(Supabase Auth 사용자까지 함께
  삭제)가 가능합니다. 각 계정은 `/account`에서 본인 비밀번호를 스스로 바꿀 수 있습니다.
- 어드민이 계정을 생성하거나 비밀번호를 재설정하면 그 비밀번호를 어드민 본인도 알게 되므로
  `admin_users.must_change_password`가 `true`로 설정되고, 해당 계정은 로그인 즉시(다른 화면
  접근 시도 시) `/account`로 강제 이동되어 본인만 아는 비밀번호로 바꾸기 전까지는 다른 화면에
  접근할 수 없습니다(`middleware.ts`). 변경을 완료하면 `/api/account/password-changed`가
  플래그를 해제합니다.
- 모든 쓰기 API가 서버에서 로그인 여부(401)와 등급(403)을 재검증합니다.

## 환불

주문·회원 상세에서 "환불하기" 버튼(결제완료 상태인 주문만 노출)으로 실행합니다(보고서 상세에는
더 이상 환불 버튼이 없습니다 — 환불은 항상 주문 단위로 처리하는 게 맞아서 주문·회원 상세로만 남겼습니다).

- `SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`는 서버 전용 환경변수(`NEXT_PUBLIC_` 접두사 절대 금지)로만 설정합니다.
- Phase 0에서 테스트 모드로 쌓인 주문(`toss_payment_key`가 없거나 `test_` 접두)은 실제 토스 API를 호출하지 않고 상태만 `refunded`로 정리합니다.
- 실결제 주문은 토스 결제취소 API 호출 성공 후에만 DB 상태를 갱신하며, 실패 시 상태를 바꾸지 않고 사유를 화면에 노출합니다.
- 이미 `refunded`/`failed` 상태인 주문은 CAS(조건부 업데이트)로 재환불을 차단합니다(멱등성).
- 모든 환불 시도는 `audit_logs`에 운영자 이메일·금액·사유와 함께 기록됩니다.

## 보고서 재발급(생성권 부여) · "디어네임에서 열기" · 특별 요청사항

- "디어네임에서 열기"는 본 서비스(저장소 루트)의 `report-view.html?id=<reportId>`로 이동합니다.
  `NEXT_PUBLIC_DEARNAME_SITE_URL`을 설정해야 링크가 활성화됩니다.
- "재발급"은 링크를 복사해 운영자가 직접 전달하던 기존 방식 대신, **고객에게 무료 생성권을
  부여**하는 방식입니다. `/api/reports/[id]/reissue`가 보고서→주문→회원을 역추적해
  `members.bonus_credits`를 1 증가시키고 `audit_logs`에 기록합니다. 고객이 로그인 후 프리미엄
  신청을 누르면 본 서비스가 `GET /proxy/credit/check?uid=`로 보유 생성권을 확인하고, 있으면
  결제 모달을 건너뛰고 `POST /proxy/credit/consume`으로 1개를 소진하며 amount=0/
  payment_method='credit'인 `orders` 행을 만들어 곧바로 보고서 생성을 시작합니다(기존
  주문·대시보드 집계에 그대로 잡힘).
- 프리미엄 신청 폼의 "기타 특별 요청사항"(`#prem-request`)이 `reports.special_request`로
  저장되어, 보고서 목록에 요약이, 상세 화면에 전체 텍스트가 표시됩니다.

## 대시보드

`supabase/schema.sql`에 추가된 `revenue_daily`/`revenue_monthly`/`revenue_yearly`/`revenue_by_product`/
`revenue_by_payment_method` 뷰를 조회합니다(별도 집계 테이블 없이 `orders`를 `date_trunc`로 그룹핑 —
뷰이므로 `orders`의 기존 RLS 정책을 그대로 따름).

- 상단 세그먼트로 월/연 전환(기본값 월별·이번달), 가장 최근 구간의 매출·주문·평균 객단가·환불
  금액을 카드로 표시
- 월별을 선택하면 `<input type="month">`(`components/MonthPicker.tsx`)로, 연도별을 선택하면
  드롭다운(`components/YearPicker.tsx`)으로 원하는 특정 월/연도를 직접 골라 그 구간의 통계와
  전월/전년 대비 증감률을 볼 수 있습니다 — `revenue_monthly`/`revenue_yearly` 뷰를 해당 구간과
  직전 구간의 `bucket` 값으로 정확히 조회(`.in('bucket', [...])`)해 계산합니다.
- 매출 추이 차트는 선택한 구간과 무관하게 항상 `revenue_monthly` 최근 12개월 고정 표시(막대: 매출, 라인: 주문건수)
- 상품 비중은 도넛 차트(AI 프리미엄 작명 / 셀프 작명 2종), 결제수단별 매출은 가로 막대 차트(Recharts)
- 결제수단은 `orders.payment_method`에 저장 — 토스 실결제는 응답의 `method` 값 그대로, 테스트 모드는 `'test'`

## 목록 화면 기간 필터 (주문·결제 / 보고서 / 회원)

데이터가 쌓일수록 목록이 끝없이 길어지는 걸 막기 위해 세 목록 화면(`/orders`, `/reports`,
`/members`) 모두 상단에 전체 기간/오늘/이번주/이번달/올해 필터가 있습니다.

- `lib/format.ts`의 `getPeriodStartUTC()`가 KST(UTC+9) 기준으로 구간 시작 시각을 계산해
  각 화면의 `created_at`에 `gte` 조건으로 적용합니다(주문·결제는 상태 필터와 함께 조합 가능).
- `PERIOD_OPTIONS`(옵션 목록)·`buildQueryHref()`(쿼리스트링 링크 생성)와
  `components/PeriodFilterBar.tsx`(필터 pill UI)로 세 화면이 로직·UI를 공유합니다.

## 배포 (Vercel)

이 저장소를 Vercel에 연결할 때 **Root Directory를 `admin`으로 지정**합니다.
필요한 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`(실결제 전환 시), `NEXT_PUBLIC_DEARNAME_SITE_URL`.

## 전환율 퍼널 · AI 비용 (Phase 2)

- 본 서비스가 `self_done`(셀프분석 완료) / `premium_view`(프리미엄 요청) / `checkout_start`(결제 모달 오픈) 시점에
  `/proxy/event`로 이벤트를 기록하고, `paid`는 `/proxy/toss/verify` 성공 시 서버가 직접 기록한다.
- `/analytics`(전환율 퍼널)는 네 단계의 건수와 이전 단계 대비 전환율을 보여준다.
- `/analytics/ai-usage`는 `ai_cost_daily` 뷰(일자·모델·kind별 집계)를 조회해 최근 14일 비용 추이와 모델별 비용을 보여준다.

## 한자 DB 수정

`data/hanja-db.js`(7000여 자)는 정적 파일이라 통째로 옮기지 않고, "정정값만 저장하는 오버레이"
방식을 사용합니다.

- `hanja_overrides` 테이블: (hanja, kr) 복합키 — 다음자(多音字, 한 한자가 여러 음으로 읽힘)는
  음마다 뜻이 다를 수 있어 음 단위로 정정합니다.
- `/hanja-db` 화면에서 본 서비스의 `GET /api/hanja/search?q=`(음 또는 한자로 검색, 오버라이드가
  있으면 겹쳐서 "현재 실제 적용 값"을 함께 표시)로 검색 → 뜻/획수/자원오행 수정 → `/api/hanja-overrides`
  Route Handler로 저장/원복.
- 검색은 어드민(Vercel)에서 본 서비스(Render) 도메인으로 크로스오리진 요청이라
  `NEXT_PUBLIC_DEARNAME_SITE_URL`이 설정돼 있어야 하고, 본 서비스의 CORS 허용 목록에
  `*.vercel.app`이 포함돼 있어야 합니다(이미 `server.py`에 반영됨).
- 본 서비스는 페이지 로드 시 `GET /api/hanja/overrides`로 정정값을 받아 메모리 상의
  `HANJA_DB_FULL`을 직접 패치 — 저장 즉시 이름 탐색 결과에 반영됩니다.
- 같은 화면 하단에 금기 한자(뜻이 불길해 이름 후보에서 제외하는 한자) 관리 UI가 있습니다
  (기존 설정 화면에서 이동). `taboo_hanja` 테이블을 `/api/taboo-hanja`로 저장하며, 본 서비스는
  `GET /api/taboo-hanja`로 조회해 이름 탐색 엔진(Worker) 초기화 시 최신 목록을 받아옵니다.

## 운영 관리 (가격 · 프로모션 · 상품 구성 · 점검모드)

기존 "설정" 화면을 "운영 관리"로 개명했습니다. `settings` key-value 테이블의 `pricing` 키로 관리하며,
화면 순서는 점검 모드(긴급 스위치라 가장 먼저 보이도록) → 가격 설정 순입니다.

- **셀프 작명 가격**: 참고용 필드입니다. 본 서비스는 현재 셀프 작명을 무료로 제공하며 실제 결제
  플로우가 연결돼 있지 않아, 이 값을 바꿔도 사이트 동작에는 아직 영향이 없습니다.
- **AI 프리미엄 작명 상품 구성**: 소견서 개수·가격 조합을 화면에서 추가/삭제할 수 있습니다
  (최소 1개 유지, count/price 모두 중복 불가). 저장하면 `/api/settings`가 `pricing.tiers` 배열
  전체를 갱신합니다.
- **프로모션 할인**: on/off + 할인율(1~90%) + 라벨(선택)을 `pricing.promotion`에 저장합니다.
  켜져 있으면 `index.html`의 `_dnApplyPricing()`이 모든 상품 구성 가격에 할인을 적용해 결제
  모달에 정가(취소선)+할인가를 함께 표시하고, 실제 청구 금액도 할인가로 계산합니다.
- `index.html`의 `_dnApplyPricing()`은 고정된 4개 DOM을 patch하지 않고, 저장된 `tiers` 배열
  길이에 맞춰 결제 모달의 옵션 목록(`.payment-options-group`)을 매번 새로 그립니다 — 그래서
  운영자가 구성을 3개나 5개로 바꿔도 실제 결제 화면에 정확히 그만큼 표시됩니다.

## 고객문의 / 컴플레인

본 서비스에 로그인한 고객이 상단 네비게이션 "고객센터" 버튼(모달)으로 문의를 남기고, 어드민에서
응대하는 채널입니다. 마이페이지에는 과거 문의 내역만 남아 있습니다(2026-07-25: 마이페이지 인라인
폼 → 상단 탭+모달로 이동). 고객에게 보내는 답변은 여전히 이메일 발송 인프라가 없어 마이페이지에
다시 방문했을 때 확인하는 방식이지만, 컴플레인(불만) 접수만은 접수 즉시 운영자에게 이메일로
알립니다.

- `inquiries` 테이블: `member_id`, 선택적 `report_id`(특정 보고서에 대한 문의일 때), 선택적
  `order_id`(결제·환불 컴플레인일 때 어떤 결제건인지), `message`, `status`(`pending`/`answered`),
  `reply`, `replied_at`, `replied_by`, `type`(`general`/`complaint`), `category`(컴플레인 사유 —
  `quality`/`payment`/`service`/`etc`, 일반 문의는 비움), `priority`(`low`/`normal`/`urgent`).
- 본 서비스: `POST /proxy/inquiry`(로그인한 고객이 문의/컴플레인 등록 — `member`를 통해
  upsert_member로 회원을 먼저 확보, `type`이 `complaint`면 `lib/notify.py`로 운영자 이메일
  알림 발송, `orderId`가 오면 `get_orders_by_member`로 본인 소유인지 검증 후 저장),
  `GET /proxy/inquiry/mine?uid=`(본인 문의+답변 조회, 마이페이지 "고객문의" 섹션에서 사용),
  `GET /proxy/orders/mine?uid=`(본인 결제 내역 조회 — 컴플레인 모달에서 사유를 "결제·환불"로
  고르면 이 API로 가져온 목록을 드롭다운에 표시). 알림용 SMTP 환경변수(`SMTP_HOST`/`SMTP_USER`/
  `SMTP_PASS`/`ADMIN_ALERT_EMAIL`) 미설정 시 알림만 조용히 no-op — 접수 자체는 정상 동작.
- 어드민: `/inquiries`(기간·상태·유형 필터 목록, "컴플레인" 탭으로 바로 필터링) →
  `/inquiries/[id]`(문의 내용 + 유형/카테고리 확인 + 답변 작성, `order_id`가 있으면 "연결 결제건
  보기" 링크로 `/orders/[id]` 이동). 답변 저장은
  `/api/inquiries/[id]/reply`(service_role)가 처리하며 `status`를 `answered`로 바꾸고
  `audit_logs`에 기록합니다.

## 다음 단계

- 없음(계획서 Phase 0~3 전체 구현 완료). 실 서비스 트래픽이 쌓이면 STEP 1(Supabase 프로젝트
  생성·스키마 실행)과 각 배포 환경변수 설정만 남았습니다.
