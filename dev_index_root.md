# DearName v2 — 개발 종속성 인덱스 (루트)

> Claude 바이브코딩 시 참조용 문서.  
> 각 파일·폴더의 역할, 공개 API, 의존 관계를 기술합니다.

---

## 목차

1. [프로젝트 전체 구조](#1-프로젝트-전체-구조)
2. [파일 로드 순서 및 의존 관계](#2-파일-로드-순서-및-의존-관계)
3. [config.js — 운영자 설정](#3-configjs--운영자-설정)
4. [server.py — 로컬/배포 서버](#4-serverpy--로컬배포-서버)
5. [index.html — 메인 SPA](#5-indexhtml--메인-spa)
6. [하위 폴더 인덱스](#6-하위-폴더-인덱스)

---

## 1. 프로젝트 전체 구조

```
dearname/
├── index.html               ← 메인 SPA (합본28_v2.html → rename)
├── config.js                ← 운영자 키 설정 (TOSS, Google, Apple)
├── server.py                ← Flask 서버 (정적 서빙 + Claude API 프록시)
├── data/
│   ├── hanja-db.js          ← 인명용 한자 7,065자 DB
│   ├── manjuryeok.js        ← 동추원 만세력 1921~2040년
│   ├── suri-data.js         ← 81수리 데이터
│   └── lunar-calendar.js   ← 음력↔양력 변환 테이블
├── lib/
│   ├── saju-engine.js       ← 사주 계산 엔진
│   ├── name-spec.js         ← NameSpec 생성 (이름 설계도)
│   ├── name-search.js       ← 탐색 엔진 Worker 어댑터
│   └── name-search-worker.js ← Web Worker 탐색 로직
└── api/
    └── claude-report.js     ← Claude API 소견서 생성
```

---

## 2. 파일 로드 순서 및 의존 관계

`index.html` 내 `<head>`에서 아래 순서로 로드됩니다.  
**순서가 바뀌면 `undefined` 오류 발생** — 반드시 유지.

```
config.js                  ← 가장 먼저 (window.TOSS_CLIENT_KEY 등 전역 설정)
  ↓
data/lunar-calendar.js     ← LUNAR_DB, normalizeToSolar()
data/hanja-db.js           ← HANJA_DB_FULL, BULYONG_HANJA
data/manjuryeok.js         ← MANJURYEOK
data/suri-data.js          ← SURI_DATA[]
  ↓
lib/saju-engine.js         ← calcSaju() — MANJURYEOK 필요
lib/name-spec.js           ← buildNameSpec() — saju-engine 결과 입력
lib/name-search.js         ← NameSearchEngine class (Worker 어댑터)
  ↓
api/claude-report.js       ← generatePremiumReport() — SURI_DATA 필요
  ↓
CDN: Chart.js, Toss SDK, Google GSI
  ↓
index.html 인라인 <script> ← 위 전역 변수 모두 참조
```

### 의존 관계 요약

| 파일 | 의존하는 전역 변수 |
|---|---|
| `saju-engine.js` | `MANJURYEOK` |
| `name-spec.js` | `getSeoryeokStatus()` (saju-engine) |
| `name-search.js` (Worker) | `HANJA_DB_FULL`, `BULYONG_HANJA`, `SURI_DATA` |
| `claude-report.js` | `SURI_DATA`, `getSeoryeokStatus()` |
| `index.html inline` | 위 전부 + `window.getCho`, `window.getOhengFromCho`, `window.getYinYangFromJung` |

> `window.getCho` 등 3개 함수는 `index.html` 인라인 스크립트 내에서 선언되어  
> `window.*`로 전역 노출됩니다. `name-search-worker.js`는 이 함수들을  
> **Worker 내부에 직접 재구현**하여 사용합니다(window 없는 환경).

---

## 3. config.js — 운영자 설정

### 역할
결제·로그인 서비스의 클라이언트 키를 `window.*`에 주입.  
이 파일만 수정하면 기능 활성화/비활성화 가능.

### 설정 가능한 전역 변수

| 변수 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `window.TOSS_CLIENT_KEY` | `string\|null` | `null` | 토스페이먼츠 클라이언트키. `null`이면 결제 없이 소견서 생성 |
| `window.GOOGLE_CLIENT_ID` | `string\|null` | `null` | Google OAuth 클라이언트 ID. `null`이면 자동 게스트 모드 |
| `window.APPLE_SERVICE_ID` | `string\|null` | `null` | Apple Sign In 서비스 ID. `null`이면 버튼 비활성 |
| `window.DN_CONFIG` | `object` | `{serviceName, version...}` | 서비스 메타 정보 |

---

## 4. server.py — 로컬/배포 서버

### 역할
- 정적 파일 서빙 (Flask)
- Claude API 브라우저 CORS 우회 프록시
- 토스페이먼츠 결제 검증 (선택)

### 환경변수

| 변수 | 필수 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | AI 소견서 사용 시 필수 | `sk-ant-api03-...` |
| `TOSS_SECRET_KEY` | 실결제 검증 시 필수 | `secret_...` |
| `PORT` | 선택 | 기본 `3000` |

### 라우트 목록

| 메서드 | 경로 | 설명 |
|---|---|---|
| `GET` | `/` | `index.html` 서빙 |
| `GET` | `/config.js` | `config.js` 서빙 |
| `GET` | `/data/<filename>` | `data/` 폴더 정적 서빙 |
| `GET` | `/lib/<filename>` | `lib/` 폴더 정적 서빙 |
| `GET` | `/api/<filename>` | `api/` 폴더 정적 서빙 |
| `POST` | `/proxy/claude` | Claude API 프록시 (CORS 해결) |
| `GET` | `/health` | 서버 상태 확인 |
| `POST` | `/proxy/toss/verify` | 토스페이먼츠 결제 검증 |

### 실행

```bash
# 로컬 테스트 (API 없이)
python server.py

# AI 소견서 포함 테스트
ANTHROPIC_API_KEY="sk-ant-..." python server.py

# 포트 변경
PORT=8080 python server.py
```

---

## 5. index.html — 메인 SPA

4개 뷰(view)가 `display: none/block`으로 전환되는 단일 페이지 앱.

---

### UI/UX 변경 이력 (2026-04-18 세션)

#### 네비게이션
- `이름의 과학` → `작명 기준` (nav 링크 텍스트)
- `마이페이지` 버튼: `login-link` 클래스 적용 → 로그인 버튼과 동일한 다크 둥근 버튼
- `showMainView()` 내 `main-nav.style.display = 'flex'` (기존 `'block'` → 줄바꿈 버그 수정)

#### 히어로 섹션
- 영역 확대: padding `220px/140px` → `280px/200px`
- h1 `3.8rem` → `5rem`
- `.hero-eyebrow`: 상단 레이블 (`1.05rem`, 금색)
- `.hero-divider`: 금색 장식 선
- `.hero-sub`: 부제목 단락 (`1.35rem`)
- 하단 CTA 버튼·통계 뱃지 추가 후 사용자 요청으로 제거 (현재 없음)

#### 이름 티커 (`#live-ticker`)
- 아이템 4개 → 8개 (+ 복제 8개 = 총 16개): 끊김 없는 루프 구현
- 폰트 `0.95rem` → `1.1rem`, 볼드 `1.15rem`
- animation `60s` → `50s`

#### 진단 결과 요약 (result grid)
- **사주 오행 카드 제거** (자원 오행과 중복)
- 7개 → 6개 지표, 레이아웃: 2열(자원오행·사격수리) + 4열(보조 4개)
- 추가 CSS: `.result-row-2 { grid-template-columns: repeat(2, 1fr); }`

#### 작명 기준 섹션 (theory section, `#theory`)
- 기존 크기 불균일 카드(split + span-2 + 3열) → **균일 3×2 그리드** (`theory-grid-uniform`)
- 모든 예시(`theory-example`) 제거, 간결 설명만 유지
- 오행 다이어그램 홈에서 제거 (상세 페이지에만 유지)
- 카드 순서: 자원오행 → 수리사격 → 발음오행 → 발음음양 → 수리음양 → 수리오행
- 신규 CSS 클래스:
  - `.theory-grid-uniform`: `display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px`
  - `.theory-card-clean`: 흰색 균일 카드 (패딩 30px, border-radius 20px)
  - `.tc-icon`: 금색 테두리 아이콘 박스 (44×44px)
  - `.tc-sub`: 소제목 레이블 (금색, 0.8rem)
- `디어네임 작명 과학` → `디어네임 작명 기준` (상세 페이지 헤더)

#### 셀프 작명 섹션 (`#self-naming`)
- section-tag: `셀프 작명 진단` → `셀프 작명`
- 제목: `우리 아이 이름, 점수가 몇 점일까요?` → `우리 아이 이름을 직접 지어보아요.`

#### 프리미엄 작명 섹션 (`#premium`)
- 제목: `아이의 사주에 꼭 맞는 이름, 직접 지어드립니다` → `우리 아이에게 꼭 맞는 이름, 직접 지어드립니다.`
- 설명 콤마 뒤 `<br>` 줄바꿈 추가
- `_isSubscribed()` → 항상 `true` 반환 (개발 모드 결제 우회)

#### 보고서 미리보기 섹션 (`#report`)
- 리스트 항목 구조 개선: `<li><div><b>제목</b><span>설명</span></div></li>`
- CSS: `.core-text-area li > div { flex: 1; }`, `.core-text-area li b { display: block; }`
- `ID: ALM-2026-N190` 텍스트 제거

#### 오행 다이어그램 (자원오행 카드 내)
- 제목: `오행의 상생 순환 (시계방향)` → `오행의 상생 순환`
- SVG 시계방향 호 화살표 추가 (Fire~土 사이, 금색)
- 木(나무) 레이블 → 원소 왼쪽 배치 (겹침 해소)
- 土(흙) 레이블 → 원소 오른쪽 배치 (겹침 해소)

#### 카드 텍스트 수정
- `자원 오행 (용신 작명)` → `자원 오행`
- `수리 사격 (81수리)` → `수리 사격`

#### 푸터
- `AI Premium Narrative Naming Service` → `Premium Narrative Naming Service`
- `Designed with Traditional Wisdom & Artificial Intelligence` → `Designed with Traditional Wisdom & Modern Science`

---

### 뷰 전환 함수

| 함수 | 이동 뷰 |
|---|---|
| `showMainView()` | `#main-view` (메인 랜딩) |
| `showReportViewWithoutLock()` | `#report-view` (프리미엄 보고서) |
| `showSelfReportView()` | `#self-report-view` (셀프 진단 보고서) |
| `showTheoryDetailView()` | `#theory-detail-view` (이론 상세) |

### 프리미엄 작명 플로우

```
requestPremiumReport()
  → validatePremiumForm()         검증 (성씨, 생년월일, 연도 범위)
  → processPayment()              결제 (Toss 또는 테스트 모드)
    → startPremiumReportGeneration(maxReports)
        → _buildSearchState()     폼 → SearchState 변환 (음력 변환 포함)
        → NameSearchEngine.search()  Web Worker 탐색
        → generateAllReports()    Claude API 소견서
        → _renderReportTabs()     이름 탭 렌더링
        → _renderReportContent()  보고서 본문 렌더링
```

### 데모 리포트 플로우 (나윤이 예시 버튼)

```
showReportViewWithoutLock()
  → _currentState 에 하드코딩 데모 데이터 주입
      - 사주: 2025-03-25 16:29 → 乙巳년 己卯월 癸巳일 庚申시
      - 성씨: 김(金) s0=8 / 이름: 娜(나·土·10획) 奫(윤·水·15획)
      - 오행 점수: 木25.0 火18.0 土16.75 金26.5 水13.75
      - 수리: 원격25(안강격吉) 형격18(발전격吉) 이격23(혁신격吉) 정격33(등룡격吉)
  → _renderReportTabs([demoCandidate])
  → _renderReportContent(demoCandidate, demoReport, 0)
  → report-view 표시 + 차트 렌더
```

> **주의:** 데모 데이터는 하드코딩. 실제 Claude API 호출 없음.
> 데모 수정 시 `showReportViewWithoutLock()` 내 `_demoReport` 객체 직접 편집.

---

### Executive Summary 오행 시각화

`_renderOhengBars(scores, candidate)` — 시그니처 변경 (candidate 추가)

- 사주 원국 오행(`scores`)과 이름 기여 오행을 한 바에 겹쳐 표시
- 이름 기여분은 연한 색 오버레이로 구분
- "✦ 이름이 채운 기운" 뱃지 + 오행별 컬러 pill 목록 출력
- 이름 오행 기여 = `candidate.oheng` (木/火/土/金/水 per char) 합산

---

### 잠재력 밸런스 레이더 차트 Before/After

`renderCharts()` — 레이더 초기화 시 **2개 데이터셋** 생성 (회색 점선=사주 원국, 금색=이름 후)

`_ohengToRadar(sc)` — 오행 점수 → 6개 레이더 축 변환 (재물/결과, 명예/직업, 학업/문서, 건강/체력, 인복/도움, 창의/표현), clamp(25,99) 적용

`_updateRadarChart(scores, candidate)` — before/after 양쪽 데이터셋 동시 업데이트

---

### 사주 원국 카드 디자인 리뉴얼

`_renderSajuGrid(saju)` — 완전 재작성. 기술 레이블 제거, 스토리 텍스트 중심 카드 UI.

**새 상수:** `_GAN_STORY` (천간 10자), `_JI_STORY` (지지 12자), `JIJI_OHENG_KR` (지지→오행), `_PILLAR_OHENG_COLOR` (오행→색상)

**새 함수:** `_getPillarStory(p, type)` — 주(柱) 타입별 3문장 일상 언어 스토리 생성

**제거된 상수:** `CHEONGAN_DESC`, `JIJI_DESC` (→ `_GAN_STORY`/`_JI_STORY`로 대체)

**새 CSS 클래스:** `.saju-box-bar` (컬러 강조 바), `.saju-box-inner` (내부 패딩), `.saju-oheng-pill` (오행 뱃지), `.saju-story` (스토리 텍스트), `.saju-gungwi` (궁위 레이블)

---

### 사주 엔진 정확도 개선 (만세력 버그 수정)

#### 수정된 버그 3종

**1. -30분 시간 보정 (`apply30min`):**  
KST(UTC+9)는 한국 실태양시보다 30분 빠름. 출생 시각에서 **-30분**하여 실태양시 변환.  
날짜가 이전날로 넘어갈 수 있음 (예: 00:00 KST → 23:30 전날). 일주도 보정된 날짜 기준.

**2. 야자시(`yajasi`):**  
원래 입력 시각 23:00 이상 → 시주 天干 계산에 다음날 일간 사용 (일주는 달력 날짜 유지).

**3. 연주 입춘 경계 버그 (신규 발견·수정):**  
- `getYearPillar()`가 달력 연도 기준 → 1~2월 초 입춘 이전 출생자 연주 오류  
- 예: `2024-01-15` → ~~甲辰年~~ → **癸卯年**  
- 입춘 이전이면 `yearForPillar = adjY - 1`  
- 월주 天干은 달력 연도의 만세력 m[] 데이터 그대로 사용 (五虎遁法 재산출 X)

#### options 파라미터 (calcSaju에 추가)

```js
calcSaju(dateStr, timeStr, {
  apply30min: true,  // 기본: true (한국 실태양시 보정)
  yajasi:     true,  // 기본: true (야자시 적용)
})
```

#### index.html UI 추가

셀프작명 폼 / 프리미엄 폼 각각에 체크박스 추가:
- `self-opt-yajasi`, `self-opt-30min`
- `prem-opt-yajasi`, `prem-opt-30min`  
(기본값 checked, 각 calcSaju 호출 시 options로 전달)

---

### 모바일 반응형 개선

`@media (max-width: 768px)`:
- `.saju-grid` → `repeat(2, 1fr)` (2×2 레이아웃, 1fr 강제에서 분리)
- `.saju-box-inner` 패딩 축소, `.saju-hanja` 2.1rem
- `.name-card-tab` → `calc(50% - 6px)` (2열 나란히)

`@media (max-width: 480px)` (신규):
- 이름 탭 1열, `.saju-hanja` 1.8rem, `.saju-story` 숨김 (초소형 폰)

---

### 셀프 진단 보고서 버그 수정

**HTML 중첩 버그 수정:** 81수리 카드 `</div>` 누락으로 수리/오행 평가 카드가 내부에 중첩되던 문제 수정

**동적 점수 계산:** `self-score-badge` 하드코딩(85) → grade 기반 동적 계산

```js
// 가중치: 수리4格 각 2, 발음오행 1.5, 발음음양 1, 수리오행 2, 수리음양 1, 자원오행 1.5
// 등급 점수: 대길→100, 길→75, 평→50, 흉→25, 대흉→10
finalScore = Math.round(weightedSum / totalWeight)
```

---

### 인증 플로우 (현재 구현)

```
openLoginModal()
  → googleSignIn()   → _onGoogleCredential() → _saveUser()
  → appleSignIn()    → AppleID.auth.signIn()  → _saveUser()
  → (미설정)         → _loginAsGuest()        → _saveUser()
```

### 구독 플랜 (셀프작명 이용권)

| 플랜 | 가격 | 월 환산 | 할인율 |
|---|---|---|---|
| 1개월권 | ₩19,000 | ₩19,000 | - |
| 3개월권 | ₩45,000 | ₩15,000 | 21% |
| 6개월권 | ₩69,000 | ₩11,500 | 39% |
| 12개월권 | ₩99,000 | ₩8,250 | 57% |

- 비회원도 이메일 입력 후 결제 가능 (UI 구현, 실결제 연동은 별도 스프린트)
- 구독 상태 localStorage `dn_subscription` 키로 관리
- `_isSubscribed()` → `expiresAt` 기준 유효성 체크

### 구독 팝업 (`#subscribe-modal`)

- `openSubscribeModal()` / `closeSubscribeModal()`
- `selectPlan(el, label, price)` — 플랜 선택
- `_onSubscribePay()` — 회원 결제 (준비 중 토스트)
- `_onSubscribePayGuest()` — 비회원 이메일 결제 (준비 중 토스트)
- `showSelfReportView()` 진입 시 `_isSubscribed()` 체크 → 미구독 시 팝업 호출

### 이메일 발송 팝업 (`#email-modal`)

- `openEmailModal()` / `closeEmailModal()` / `sendReportEmail()`
- 보고서 하단 "이메일로 받기" 버튼 + 마이페이지 보고서 행 버튼에서 호출
- 실발송은 별도 스프린트 (Firebase Functions + SendGrid)

### 마이페이지 (`#mypage-view`) — 5섹션 구조

| 섹션 | ID | 렌더 함수 | 데이터 소스 |
|---|---|---|---|
| 프로필 | - | `_renderMypageProfile()` | `_dnUser` |
| 구독 현황 | `mypage-subscription` | `_renderMypageSubscription()` | `dn_subscription` (localStorage) |
| 셀프작명 보고서 | `mypage-self-reports` | `_renderMypageSelfReports()` | `dn_self_reports` (localStorage) |
| AI 프리미엄 보고서 | `mypage-ai-reports` | `_renderMypageAIReports()` | `dn_reports` (localStorage) |
| 결제 내역 | `mypage-payments` | `_renderMypagePayments()` | 플레이스홀더 |

#### 데이터 모델 (localStorage)

```js
// dn_user
{ uid, name, email, provider: 'google'|'apple'|'guest', createdAt }

// dn_subscription
{ label: '3개월권', price: 45000, expiresAt: '2025-07-01T00:00:00.000Z' }

// dn_self_reports — 배열 (최대 20건)
[{
  id: 'sr_' + Date.now(),
  createdAt,
  nameKr, nameHanja, gender, birthDate, birthTime
}]

// dn_reports — AI 프리미엄 보고서 배열 (최대 10건)
[{
  id: 'rpt_' + Date.now(),
  uid, createdAt,
  familyKr, familyHanja,
  candidates: [...], reports: [...],
  saju, ohengScores, constraints
}]
```

#### 주요 함수 목록

| 함수 | 역할 |
|---|---|
| `showMypageView()` | 마이페이지 뷰 전환 + 전체 렌더 |
| `_renderMypageSubscription()` | 구독 현황 카드 |
| `_renderMypageSelfReports()` | 셀프작명 보고서 목록 |
| `_renderMypageAIReports()` | AI 보고서 목록 |
| `_renderMypagePayments()` | 결제 내역 (플레이스홀더) |
| `_openSavedSelfReport(id)` | 셀프 보고서 복원 (구독 체크 포함) |
| `_openSavedReport(id)` | AI 보고서 복원 |
| `_deleteSelfReportConfirm(id)` | 셀프 보고서 삭제 확인 |
| `_showToast(msg)` | 하단 토스트 메시지 |
| `showSelfReportViewDirect()` | 구독 체크 없이 셀프 보고서 직접 열기 (마이페이지 복원용) |

#### 셀프작명 보고서 자동 저장

`showSelfReportView()` 완료 시 `_saveSelfReport({ nameKr, nameHanja, gender, birthDate, birthTime })` 자동 호출.  
`dn_self_reports` localStorage에 최대 20건 저장.

---

## 6. 배포 설정

### 파일 목록

| 파일 | 설명 |
|---|---|
| `requirements.txt` | Python 패키지 (flask, flask-cors, anthropic, gunicorn) |
| `render.yaml` | Render 자동 배포 설정 |
| `.gitignore` | 백업 zip, venv 등 제외 |

### Render 배포 절차

```
1. GitHub에 저장소 생성 후 push
   git init && git add . && git commit -m "init"
   git remote add origin https://github.com/YOUR/dearname.git
   git push -u origin main

2. render.com → New Web Service → GitHub 연결

3. 환경변수 설정 (Render 대시보드 → Environment)
   ANTHROPIC_API_KEY = sk-ant-api03-...
   (선택) TOSS_SECRET_KEY = secret_...

4. 자동 빌드 & 배포 완료 → https://dearname.onrender.com
```

### 실행 명령

| 환경 | 명령 |
|---|---|
| 로컬 개발 | `python server.py` |
| 배포 (Render) | `gunicorn server:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120` |

### 주의사항
- Render 무료 티어: 15분 비활성 시 슬립 → 첫 요청 30초 딜레이
- Claude API 응답 타임아웃 120초로 설정 (소견서 생성 시간 고려)
- 커스텀 도메인 연결 시 `server.py` CORS 리스트에 도메인 추가

---

## 7. 하위 폴더 인덱스

각 폴더 내 `dev_index.md` 참조.

| 폴더 | 문서 | 주요 내용 |
|---|---|---|
| `data/` | `data/dev_index.md` | 한자 DB, 만세력, 81수리, 음력 변환 데이터 구조 |
| `lib/` | `lib/dev_index.md` | 사주 엔진, NameSpec, 탐색 엔진 API |
| `api/` | `api/dev_index.md` | Claude API 소견서 생성 인터페이스 |

---

## 8. 기획 중인 기능

### AI 작명 상담 채팅 (`feature_chat_plan.md`)

> 상세 기획서: `C:\dearname\feature_chat_plan.md`

**개요:** AI 프리미엄 보고서 하단에 LLM 채팅 위젯 추가.  
보고서에서 분석된 이름 데이터를 컨텍스트로 가지고, 유저의 추가 질문에 맞춤 답변 생성.

**구현 위치:**

| 파일 | 변경 내용 |
|---|---|
| `server.py` | `POST /proxy/claude-chat` 엔드포인트 신규 추가 |
| `index.html` | `#report-chat-section` HTML/CSS 추가, `_initChatContext()` / `sendChatMessage()` 함수 추가 |

**데이터 흐름:**
```
_renderReportContent() → _initChatContext(candidate, report, scores)
  → 유저 질문 입력
  → POST /proxy/claude-chat { message, context, history }
  → server.py: build_chat_system_prompt(context) + Claude API 호출
  → 답변 말풍선으로 표시
```

**핵심 컨텍스트 (서버 시스템 프롬프트에 주입):**
- 이름 (한글/한자), 종합 점수, tagline
- 사주 원국 (연월일시주)
- 오행 점수 (木火土金水)
- 한자 각 글자의 의미/오행/획수
- 수리 4격 (원형이정격 + 이름)
- 보고서 핵심 스토리 요약

**구현 단계:**
- Phase 1 (MVP): 기본 채팅 UI + `/proxy/claude-chat` 엔드포인트
- Phase 2: Enter 전송, 예시 질문 chip, 로딩 애니메이션
- Phase 3: 스트리밍 응답, 이용 횟수 제한, 채팅 저장

**토큰 비용:** 약 2,250 토큰/1회 상담 → claude-sonnet-4-6 기준 ~$0.006 (약 8원)
