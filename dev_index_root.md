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

### 인증 & 마이페이지 기획

#### 사용자 여정

| 유형 | 플로우 |
|---|---|
| 비회원 | 랜딩 → 프리미엄 신청 → 로그인 모달 → 게스트 선택 → 결제 → 보고서 (저장 안됨) |
| 회원 | 랜딩 → 로그인 → 결제 → 보고서 자동 저장 → 마이페이지 재열람 |
| 재방문 | 자동 로그인 복원 (localStorage) → 마이페이지 → 저장 보고서 클릭 |

#### 로그인 진입점

| 진입점 | 동작 |
|---|---|
| nav "로그인" 버튼 | 로그인 모달 바로 열기 |
| 프리미엄 신청 버튼 | 비로그인 시 모달 먼저 → 로그인 후 결제 자동 재개 (`_pendingAction` 패턴) |

#### 마이페이지 (`#mypage-view`) 기능

| 기능 | Phase 1 (localStorage) | Phase 2 (서버 DB) |
|---|---|---|
| 프로필 (이름/이메일/아바타) | ✅ | Supabase/Firebase |
| 보고서 목록 | ✅ `dn_reports` | DB 조회 |
| 보고서 재열람 | ✅ 저장 JSON → `_renderReportContent()` | DB 조회 |
| 보고서 삭제 | ✅ | DB 삭제 |
| 결제 내역 | ❌ | 토스 연동 |
| 계정 탈퇴 | ❌ | 서버 처리 |

#### 데이터 모델 (localStorage)

```js
// dn_user (기존)
{ uid, name, email, photo, provider: 'google'|'apple'|'guest', createdAt }

// dn_reports (신규, 구현 완료) — 배열
[{
  id: 'rpt_1712800000000',   // 'rpt_' + Date.now()
  uid,                        // dn_user.uid
  createdAt,
  familyKr, familyHanja,
  candidates: [...],          // NameSearchEngine 결과 배열 (전체 candidate 객체)
  reports:    [...],          // Claude 소견서 배열
  saju, ohengScores,
  constraints,                // gender 등 검색 조건
}]
```

#### 구현 완료 (Phase 1) ✅

| Step | 작업 | 함수 |
|---|---|---|
| 1 ✅ | 보고서 자동 저장 (회원만) | `_saveReport(candidates, reports, state)` |
| 2 ✅ | 마이페이지 뷰 HTML | `#mypage-view` (5번째 SPA 뷰) |
| 3 ✅ | 마이페이지 렌더 | `showMypageView()`, `_renderMypageProfile()`, `_renderMypageReports()` |
| 4 ✅ | 보고서 재열람 | `_openSavedReport(id)` → `_renderReportContent()` 재사용 |
| 5 ✅ | 로그인 선행 로직 | `_pendingAction` 패턴, `_saveUser()` 완료 시 자동 재개 |
| 6 ✅ | user-badge 연결 | `showMypageView()`, 로그아웃은 마이페이지 내 버튼으로 이동 |

보조 함수: `_getReports(uid)`, `_deleteReport(id)`, `_confirmDeleteReport(id)`

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
