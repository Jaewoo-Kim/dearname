# dearname-admin

DearName 운영 어드민. `admin_site_plan.md` STEP 3~5 구현(조회 화면 + 환불).

## 구성

- Next.js 14 (App Router) + Tailwind
- Supabase Auth(매직 링크) + Postgres(RLS)
- 화면: 대시보드(합계 카드) / 주문·결제(목록+통합 상세, 환불) / 보고서(목록+상세, 환불) / 회원(목록+상세, 환불)
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

## 배포 (Vercel)

이 저장소를 Vercel에 연결할 때 **Root Directory를 `admin`으로 지정**합니다.
필요한 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_ALLOWED_EMAILS`,
`SUPABASE_SERVICE_ROLE_KEY`, `TOSS_SECRET_KEY`(실결제 전환 시).

## 다음 단계 (미구현)

- STEP 6 보고서 재발급 + "디어네임에서 열기"(본 서비스에 보고서 재조회 라우트가 아직 없어 연결 보류)
- STEP 7 대시보드 일/월/연 전환 + 매출 추이 그래프
