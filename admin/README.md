# dearname-admin

DearName 운영 어드민. `admin_site_plan.md` STEP 3~7(Phase 1) + Phase 2(전환율 퍼널, AI 비용,
결제수단별 매출) + Phase 3(가격/프로모션/점검모드/금기 한자/한자DB 수정/재발급 생성권/고객문의) 구현.

## 구성

- Next.js 14 (App Router) + Tailwind + Recharts
- Supabase Auth(매직 링크) + Postgres(RLS + 매출/AI비용 집계 뷰)
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
cp .env.example .env.local   # Supabase URL/키, 허용 이메일, 환불용 시크릿 입력
npm run dev
```

사전 준비: 저장소 루트의 `supabase/schema.sql`을 Supabase SQL 편집기에서 실행해 테이블·RLS를 만들어야 합니다.

## 로그인

이메일 매직 링크 방식입니다. `ADMIN_ALLOWED_EMAILS`(쉼표 구분)에 등록된 이메일만 로그인 후 화면 접근이 허용됩니다.
비워두면 개발 편의상 로그인한 모든 계정을 허용하므로, 운영 배포 전 반드시 값을 채우세요.

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
필요한 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_ALLOWED_EMAILS`,
`SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`(실결제 전환 시), `NEXT_PUBLIC_DEARNAME_SITE_URL`.

## 전환율 퍼널 · AI 비용 (Phase 2)

- 본 서비스가 `self_done`(셀프분석 완료) / `premium_view`(프리미엄 요청) / `checkout_start`(결제 모달 오픈) 시점에
  `/proxy/event`로 이벤트를 기록하고, `paid`는 `/proxy/toss/verify` 성공 시 서버가 직접 기록한다.
- `/funnel` 화면은 네 단계의 건수와 이전 단계 대비 전환율을 보여준다.
- `/ai-usage` 화면은 `ai_cost_daily` 뷰(일자·모델·kind별 집계)를 조회해 최근 14일 비용 추이와 모델별 비용을 보여준다.

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

## 고객문의

본 서비스에 로그인한 고객이 마이페이지에서 문의를 남기고, 어드민에서 응대하는 채널입니다.
이메일 발송 인프라가 없어 답변은 고객이 마이페이지에 다시 방문했을 때 확인하는 방식입니다.

- `inquiries` 테이블: `member_id`, 선택적 `report_id`(특정 보고서에 대한 문의일 때), `message`,
  `status`(`pending`/`answered`), `reply`, `replied_at`, `replied_by`.
- 본 서비스: `POST /proxy/inquiry`(로그인한 고객이 문의 등록 — `member`를 통해 upsert_member로
  회원을 먼저 확보), `GET /proxy/inquiry/mine?uid=`(본인 문의+답변 조회, 마이페이지 "고객문의"
  섹션에서 사용).
- 어드민: `/inquiries`(기간·상태 필터 목록) → `/inquiries/[id]`(문의 내용 확인 + 답변 작성).
  답변 저장은 `/api/inquiries/[id]/reply`(service_role)가 처리하며 `status`를 `answered`로
  바꾸고 `audit_logs`에 기록합니다.

## 다음 단계

- 없음(계획서 Phase 0~3 전체 구현 완료). 실 서비스 트래픽이 쌓이면 STEP 1(Supabase 프로젝트
  생성·스키마 실행)과 각 배포 환경변수 설정만 남았습니다.
