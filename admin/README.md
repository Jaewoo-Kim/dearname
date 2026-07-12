# dearname-admin

DearName 운영 어드민 (Phase 1 MVP — 조회 전용). `admin_site_plan.md` STEP 3~4 구현.

## 구성

- Next.js 14 (App Router) + Tailwind
- Supabase Auth(매직 링크) + Postgres(RLS)
- 화면: 대시보드(합계 카드) / 주문·결제(목록+통합 상세) / 보고서(목록+상세) / 회원(목록+상세)

## 로컬 실행

```bash
cd admin
npm install
cp .env.example .env.local   # Supabase URL/키, 허용 이메일 입력
npm run dev
```

사전 준비: 저장소 루트의 `supabase/schema.sql`을 Supabase SQL 편집기에서 실행해 테이블·RLS를 만들어야 합니다.

## 로그인

이메일 매직 링크 방식입니다. `ADMIN_ALLOWED_EMAILS`(쉼표 구분)에 등록된 이메일만 로그인 후 화면 접근이 허용됩니다.
비워두면 개발 편의상 로그인한 모든 계정을 허용하므로, 운영 배포 전 반드시 값을 채우세요.

## 배포 (Vercel)

이 저장소를 Vercel에 연결할 때 **Root Directory를 `admin`으로 지정**합니다.
필요한 환경변수: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_ALLOWED_EMAILS`.

## 다음 단계 (미구현)

- STEP 5 환불(서버 함수 + 토스 환불 + 멱등성 + audit_logs) — 상세 화면에 버튼 자리만 마련해둠
- STEP 6 보고서 재발급 + "디어네임에서 열기"(본 서비스에 보고서 재조회 라우트가 아직 없어 연결 보류)
- STEP 7 대시보드 일/월/연 전환 + 매출 추이 그래프
