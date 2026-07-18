# dearname-admin

DearName 운영 어드민. `admin_site_plan.md` STEP 3~7(Phase 1) + Phase 2 일부(전환율 퍼널, AI 비용) 구현.

## 구성

- Next.js 14 (App Router) + Tailwind + Recharts
- Supabase Auth(매직 링크) + Postgres(RLS + 매출/AI비용 집계 뷰)
- 화면: 대시보드(일/월/연 전환, 매출 추이·상품 비중 그래프) / 주문·결제(목록+통합 상세, 환불) /
  보고서(목록+상세, 환불·재발급·열기) / 회원(목록+상세, 환불) / 전환율 퍼널 / AI 비용
- 환불: `/api/refund` Route Handler가 토스페이먼츠 결제취소 API를 서버에서만 호출 (브라우저는 직접 호출 안 함)

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

주문·회원·보고서 상세 어디서든 "환불하기" 버튼(결제완료 상태인 주문만 노출)으로 실행합니다.

- `SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`는 서버 전용 환경변수(`NEXT_PUBLIC_` 접두사 절대 금지)로만 설정합니다.
- Phase 0에서 테스트 모드로 쌓인 주문(`toss_payment_key`가 없거나 `test_` 접두)은 실제 토스 API를 호출하지 않고 상태만 `refunded`로 정리합니다.
- 실결제 주문은 토스 결제취소 API 호출 성공 후에만 DB 상태를 갱신하며, 실패 시 상태를 바꾸지 않고 사유를 화면에 노출합니다.
- 이미 `refunded`/`failed` 상태인 주문은 CAS(조건부 업데이트)로 재환불을 차단합니다(멱등성).
- 모든 환불 시도는 `audit_logs`에 운영자 이메일·금액·사유와 함께 기록됩니다.

## 보고서 재발급 · "디어네임에서 열기"

- "디어네임에서 열기"는 본 서비스(저장소 루트)의 `report-view.html?id=<reportId>`로 이동합니다.
  `NEXT_PUBLIC_DEARNAME_SITE_URL`을 설정해야 링크가 활성화됩니다.
- "재발급"은 아직 이메일 발송 인프라가 없어 **실제 메일 전송 대신** ①`audit_logs`에 재발급 기록을 남기고
  ②열람 링크를 운영자 클립보드로 복사합니다. 운영자가 그 링크를 고객에게 직접 전달하는 방식입니다.
  (추후 Resend/SendGrid 등을 붙이면 이 버튼 하나로 실제 발송까지 확장 가능)

## 대시보드

`supabase/schema.sql`에 추가된 `revenue_daily`/`revenue_monthly`/`revenue_yearly`/`revenue_by_product` 뷰를 조회합니다
(별도 집계 테이블 없이 `orders`를 `date_trunc`로 그룹핑 — 뷰이므로 `orders`의 기존 RLS 정책을 그대로 따름).

- 상단 세그먼트로 일/월/연 전환, 가장 최근 구간의 매출·주문·평균 객단가·환불 금액을 카드로 표시
- 매출 추이는 막대(매출)+라인(주문건수) 콤보 차트, 상품 비중은 도넛 차트(Recharts)

## 배포 (Vercel)

이 저장소를 Vercel에 연결할 때 **Root Directory를 `admin`으로 지정**합니다.
필요한 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_ALLOWED_EMAILS`,
`SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`(실결제 전환 시), `NEXT_PUBLIC_DEARNAME_SITE_URL`.

## 전환율 퍼널 · AI 비용 (Phase 2)

- 본 서비스가 `self_done`(셀프분석 완료) / `premium_view`(프리미엄 요청) / `checkout_start`(결제 모달 오픈) 시점에
  `/proxy/event`로 이벤트를 기록하고, `paid`는 `/proxy/toss/verify` 성공 시 서버가 직접 기록한다.
- `/funnel` 화면은 네 단계의 건수와 이전 단계 대비 전환율을 보여준다.
- `/ai-usage` 화면은 `ai_cost_daily` 뷰(일자·모델·kind별 집계)를 조회해 최근 14일 비용 추이와 모델별 비용을 보여준다.

## 다음 단계 (Phase 2 잔여 / Phase 3)

- 결제수단별 매출 세분화(토스 응답의 `method` 필드를 `orders`에 저장해야 함)
- Phase 3: 한자 DB 수정, 금기 한자 관리, 가격 변경, 점검(maintenance) 모드 등 콘텐츠·운영 설정 화면
