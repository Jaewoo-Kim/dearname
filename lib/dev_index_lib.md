# lib/ — 개발 종속성 인덱스

> 사주 계산·이름 탐색 엔진 폴더.  
> `data/` 파일들이 먼저 로드된 후에만 정상 동작.

---

## 목차

1. [saju-engine.js — 사주 계산 엔진](#1-saju-enginejs--사주-계산-엔진)
2. [name-spec.js — NameSpec 생성](#2-name-specjs--namespec-생성)
3. [name-search.js — 탐색 엔진 (Worker 어댑터)](#3-name-searchjs--탐색-엔진-worker-어댑터)
4. [name-search-worker.js — Web Worker 탐색 로직](#4-name-search-workerjs--web-worker-탐색-로직)
5. [name-formula.js — 발음(소리) 분석 순수 모듈](#5-name-formulajs--발음소리-분석-순수-모듈)
6. [name-score.js — 이름 후보 채점 순수 모듈](#6-name-scorejs--이름-후보-채점-순수-모듈)

---

## 1. saju-engine.js — 사주 계산 엔진

### 의존 전역 변수
- `MANJURYEOK` (`data/manjuryeok.js`)

### 선언하는 전역 변수 (상수)

| 상수 | 설명 |
|---|---|
| `CHEONGAN` | 천간 10자 배열 `['甲','乙',...]` |
| `JIJI` | 지지 12자 배열 `['子','丑',...]` |
| `CHEONGAN_OHENG` | 천간→오행 맵 |
| `JIJANGGAN` | 지지→지장간 배열 (비율 포함) |
| `YEAR_BASE` | 연주 계산 기준 `{year:1984, ganIdx:0, jiIdx:0}` |
| `SEORYEOK_LABEL` | 세력 상태 한글 라벨 맵 |

### 공개 함수

#### `calcSaju(dateStr, timeStr, options) → Object|null`

만세력 기반 사주 4주 계산. 핵심 진입점.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `dateStr` | `string` | 양력 `'YYYY-MM-DD'` |
| `timeStr` | `string` | `'HH:MM'` (기본 `'12:00'`) |
| `options.apply30min` | `boolean` | 한국 실태양시 보정 +30분 적용 (기본 `true`) |
| `options.yajasi` | `boolean` | 야자시(夜子時) 적용 (기본 `true`) |

**-30분 보정 원리:** KST(UTC+9)는 한국 경도(127.5°E) 실태양시보다 30분 빠름.  
출생 시각에서 30분을 **빼서** 실태양시로 변환 후 모든 주(柱)를 결정.  
자정 근처 출생 시 날짜가 이전날로 바뀔 수 있음 (예: 00:00 → 23:30 전날).

**야자시(夜子時):** 보정 후 시각(adjH) 23:00 이상이면 시주 天干 계산에 다음날 일간 사용.  
일주(日柱)는 보정된 날짜 기준. 월주는 만세력 m[] 데이터 그대로 사용.

**반환:**
```js
{
  year:  { gan: '乙', ji: '巳' },
  month: { gan: '己', ji: '卯' },
  day:   { gan: '癸', ji: '巳' },
  time:  { gan: '庚', ji: '申' }
}
// 연도 범위 벗어나면 null
```

#### `calcOhengScores(saju) → Object`

사주 4주에서 오행 점수 계산.

| 파라미터 | 설명 |
|---|---|
| `saju` | `calcSaju()` 반환값 |

**반환:** `{ '木': 15.0, '火': 22.5, '土': 20.0, '金': 12.5, '水': 30.0 }`  
- 천간 각 10점, 지지 각 15점 (지장간 비율로 분배)
- 4주 합계 = 100점

#### `getSeoryeokStatus(score) → string`

| score 범위 | 반환값 |
|---|---|
| `< 10` | `'extreme_weak'` |
| `< 20` | `'weak'` |
| `< 30` | `'balanced'` |
| `< 50` | `'strong'` |
| `>= 50` | `'extreme_strong'` |

#### `calcSajuOhengGrade(hanjaOhengs, birthDate, birthTime, options) → Object`

셀프작명 6번째 지표(사주오행) 전용. 프리미엄 보고서 자원오행 grade에도 공통 사용.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `hanjaOhengs` | `string[]` | 선택된 한자들의 자원오행 배열 |
| `birthDate` | `string` | 양력 `'YYYY-MM-DD'` |
| `birthTime` | `string` | `'HH:MM'` |
| `options` | `Object` | `calcSaju()` options와 동일 (apply30min, yajasi) |

**반환:** `{ grade: '매우 좋음'|'좋음'|'나쁨', desc: string }`

**판정 순서: ① 종격 체크 → ② 통관 체크 → ③ 8자 카운트 로직**

**① 종격(從格) 분기 (지장간 가중 점수 기준 — buildNameSpec과 동일 조건):**

`calcOhengScores(saju)` 결과에서 한 오행 ≥ 60점 + 그 오행의 극오행 < 5점이면 종격으로 판정.

| 이름의 오행 | 등급 |
|---|---|
| **극오행** 포함 | `나쁨` — "종격입니다. 극오행 포함해 좋지 않습니다" |
| **지배오행** 또는 **수호오행** 포함 | `매우 좋음` — "종격입니다. 기운을 강화하여 매우 좋습니다" |
| 중립 오행만 | `좋음` — "종격입니다. 지배·수호 오행 선택하면 더욱 좋습니다" |

로컬 상수 (파일 상단, name-spec.js와 동일 값):
```javascript
const _JONGGYEOK_CTRL = {'木':'金','火':'水','土':'木','金':'火','水':'土'};
const _JONGGYEOK_SUP  = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
```

**② 통관(通關) 분기 (지장간 가중 점수 기준 — buildNameSpec과 동일 조건):**

`calcOhengScores` 결과에서 상극 쌍이 각 ≥25점이면 통관 판정. **불균형(=0 오행)보다 우선.**
단순 카운트로 0인 오행이 있어도 통관이 먼저 판정되므로 충돌 오행을 추가하는 선택은 나쁨으로 평가됨.

| 이름의 오행 | 등급 |
|---|---|
| **중재 오행** 포함 | `매우 좋음` — "통관 사주입니다. 중재 기운이 두 오행을 중화합니다" |
| **충돌 쌍(A 또는 B)** 포함 | `나쁨` — "충돌 오행을 강화해 대립 심화" |
| 그 외 | `좋음` — "중재 오행을 선택하면 더욱 좋습니다" |

통관 쌍별 중재 오행 (MEDIATORS):

| 충돌 쌍 | 중재 오행 | 원리 |
|---|---|---|
| 木克土 | 火 | 木→火→土 |
| 火克金 | 土 | 火→土→金 |
| 土克水 | 金 | 土→金→水 |
| 金克木 | 水 | 金→水→木 |
| 水克火 | 木 | 水→木→火 |

**③ 8자 단순 카운트 로직 (지장간 미포함, 종격·통관 아닌 경우에만 도달):**

| 사주 유형 | 조건 (max = 8자 중 최대 오행 수) | 이름 행동별 등급 |
|---|---|---|
| 불균형 | 빈 오행(=0) 존재 | 부족 오행 전부 보완=매우 좋음 / 일부=좋음 / 미보완=나쁨 |
| 편중 | 빈 오행 없고 `max === 3` (`{3,2,1,1,1}`) | 지배 오행 강화 시 **나쁨 강등** / 약한 것만 보충=매우 좋음 |
| 강세(특수격) | 빈 오행 없고 `max >= 4` (`{4,1,1,1,1}` 등) | relStrong 강화=나쁨 / relWeak 보충=매우 좋음 |
| 균형 | 빈 오행 없고 `max <= 2` | relWeak만=매우 좋음 / 혼합=좋음 / relStrong만=나쁨 |

- `_isSkewed = _maxCnt === 3`, `_domSet` = 최댓값 오행. `_nameHitsDom`이면 편중형에서 나쁨 강등.
- **뱃지 4-state** (index.html `self-oheng-balance-badge` / `premium-oheng-badge`):
  - 불균형 = 빨강(`#dc2626`)  /  강세 = 주황·진한(`#c2410c`)  /  편중 = 주황·연한(`#b45309`)  /  균형 = 초록(`#16a34a`)
  - 프리미엄 보고서 Ch1에도 동일 4-state 뱃지(`premium-oheng-badge`) 추가됨.
- 진단 박스 색상도 동기화: 강세는 오렌지 계열(`#ffedd5`), 편중/균형은 기존과 동일.
- **프리미엄 보고서 자원오행 grade 수정** (`_applyVerdicts()` 내 `verdict-ch3`):
  - 기존: 이름 오행 유일값 수만으로 등급 결정 (2개 이상 → 항상 "매우 좋음")
  - 변경: `calcSajuOhengGrade()` 직접 호출 → 셀프작명과 완전히 동일한 기준 적용
  - `_currentState._inputRaw.birthDate/birthTime` + `_currentState._sajuOpts` 사용
  - `_sajuOpts` 저장을 위해 `_buildSearchState()` 반환값에 `_sajuOpts` 필드 추가됨.

### 내부 함수 (외부 호출 불필요)

| 함수 | 역할 |
|---|---|
| `getYearPillar(year)` | 60갑자 순환으로 연주 계산 |
| `getMonthPillar(year, month, day, hour, min)` | 절기 기준 월주 결정 |
| `getDayPillar(year, month, day)` | 1월1일 일진 + 경과일로 일주 계산 |
| `getTimePillar(dayGan, hour)` | 五子遁法으로 시주 계산 |
| `parsePillar(str)` | `"己卯"` → `{gan:'己', ji:'卯'}` |

### 내부 함수 변경 사항

| 함수 | 변경 내용 |
|---|---|
| `getYearPillar(year)` | 내부 동일. `calcSaju`에서 입춘 이전 감지 후 `year-1` 전달로 간접 수정 |
| `calcSaju` 내부 연주 보정 | 입춘(j['2']) 이전이면 `yearForPillar = adjY - 1` 적용 |
| `calcSaju` 내부 월주 보정 | 입춘 이전이면 `MONTH_GAN_BASE` 五虎遁法으로 天干 재산출 |

**五虎遁法 月干 산출표:**

| 年干 | 子月干 시작 | base |
|---|---|---|
| 甲/己 | 甲 | 0 |
| 乙/庚 | 丙 | 2 |
| 丙/辛 | 戊 | 4 |
| 丁/壬 | 庚 | 6 |
| 戊/癸 | 壬 | 8 |

`monthGan = CHEONGAN[(base + JIJI.indexOf(monthJi)) % 10]`

### 검증 케이스

| 입력 | 기대값 | 비고 |
|---|---|---|
| `calcSaju('2025-03-25', '16:29')` | 연乙巳 월己卯 일癸巳 시庚申 | 기준값 |
| `calcSaju('2024-02-04', '17:20')` | 연甲辰 월丙寅 일戊戌 시辛酉 | 입춘 경계 (-30분 보정) |
| `calcSaju('2024-05-10', '23:40')` | 연甲辰 월己巳 일甲戌 시丙子 | 야자시 |
| `calcSaju('1989-02-04', '00:00')` | 연戊辰 월乙丑 일甲午 시丙子 | -30분→23:30 전날, 야자시 |
| `calcSaju('2024-01-15', '12:00')` | 연癸卯 월乙丑 | 입춘 이전 (달력연도 月干 그대로) |

---

## 2. name-spec.js — NameSpec 생성

### 의존 함수
- `getSeoryeokStatus()` (`lib/saju-engine.js`)

### 공개 함수

#### `calcYongsin(saju, scores) → Object|null`

억부법(抑扶法) 용신 계산. 일간 강약(신강/신약/중화)을 판단하고 용신·희신·기신 반환.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `saju` | `Object` | `calcSaju()` 반환값 (day.gan 필수) |
| `scores` | `Object` | `calcOhengScores()` 반환값 |

**반환:** (일간 불명 시 null)
```js
{
  dayGan, dayOheng,                // 일간 천간 및 오행
  inOheng, bikOheng,              // 인성, 비겁 오행
  sikOheng, jaeOheng, gwanOheng,  // 식상, 재성, 관살 오행
  inbiScore, sjgScore,            // 인비세력 점수, 식재관세력 점수
  isGangShin, isYakShin,          // 신강/신약 여부
  yongsinOheng,                   // 용신 오행 (중화면 null)
  heesinOheng,                    // 희신 오행 (용신이 있을 때)
  gisinOheng,                     // 기신 오행 (용신이 있을 때)
  desc                            // 판정 설명 문자열
}
```

**판정 기준:**
- **신강:** 인비세력 > 식재관세력 × 1.2 → 용신 = 식재관 중 최약 오행
- **신약:** 식재관세력 > 인비세력 × 1.2 → 용신 = 인비 중 최약 오행 (인성 우선)
- **중화:** 그 외 → yongsinOheng = null

---

#### `buildNameSpec(saju, scores, daeun?) → Object`

사주 + 오행 점수 → 이름 설계도(NameSpec) 생성.  
판단 우선순위: **긴급진단 → 억부 용신 → 특수격 → 일반격 중화**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `saju` | `Object` | `calcSaju()` 반환값 |
| `scores` | `Object` | `calcOhengScores()` 반환값 |
| `daeun` | `Object?` | `calcDaeun()` 반환값 (선택) |

**반환:**
```js
{
  prefer:   ['水', '木'],    // 자원오행에 포함해야 할 오행 (최대 2개)
  avoid:    ['火', '土'],    // 자원오행에서 피해야 할 오행 (최대 2개)
  minCount: { '水': 1 },    // 최소 포함 횟수
  strategy: 'balance',      // 'balance' | 'reinforce'
  gridType: 'general',      // 격 종류 (특수격이면 '종왕격' 등)
  diagnosis: [              // 진단 결과 메모 배열
    { type: '조후',  msg: '여름 태생 + 水 부족 → 水 최우선 배치' },
    { type: '통관',  msg: '木↔土 전쟁 → 火으로 중재' },
    { type: '고립',  msg: '木 고립 + 金 압도 → 水 긴급 수혈' },
    { type: '억부',  msg: '신강(인비 45pt > 식재관 30pt) — 관살(金) 용신 / 희신:土 기신:火' }
  ],
  yongsin: { ... }          // calcYongsin() 반환값 (일간 불명 시 null)
}
```

### 판단 로직 (우선순위 순)

1. **조후 긴급:** 월지 기준 여름(巳午未) + 水<15점 → prefer 水  
   겨울(亥子丑) + 火<15점 → prefer 火
2. **통관 긴급:** 상극 쌍 각 25점↑ 대립 → 중재 오행 prefer  
3. **고립 긴급:** 오행 5점 미만 + 극하는 오행 40점↑ → 생하는 오행 prefer  
4. **억부법 용신:** `calcYongsin()` 항상 계산 → diagnosis에 추가.  
   **긴급진단(1~3)으로 prefer가 비어 있을 때만** 용신·희신을 prefer에, 기신을 avoid에 추가.
5. **특수격(종격):** 특정 오행 60점↑ + 극오행 5점 미만 → `strategy:'reinforce'` 반환  
   - `prefer: [지배오행, 수호오행]`, `avoid: [극오행]`, `gridType: SPECIAL_GUK_NAMES[지배오행]`
   - 프리미엄 Ch1 뱃지에 보라색 "종격 (XX격)" 안내 표시 (index.html `_renderPremiumOhengBadge`)
   - Claude 프롬프트에 `[종격(從格) 판정]` 섹션 추가 (api/claude-report.js)
6. **일반격:** 부족(weak↓) prefer, 과다(strong↑) avoid

**SPECIAL_GUK_NAMES** (종격 유형명):

| 오행 | 종격 유형명 |
|---|---|
| 木 | 종왕/종강격 |
| 火 | 종아격 |
| 土 | 전왕격 |
| 金 | 종재격 |
| 水 | 종살격 |

---

## 3. name-search.js — 탐색 엔진 (Worker 어댑터)

### 역할
무거운 이름 탐색 연산을 Web Worker에 위임.  
Worker 실패 시 메인 스레드 fallback 자동 전환.

### 의존 전역 변수
- `HANJA_DB_FULL`, `BULYONG_HANJA` (`data/hanja-db.js`)
- `SURI_DATA` (`data/suri-data.js`)

### 클래스: `NameSearchEngine`

#### `new NameSearchEngine()`

인스턴스 생성. Worker는 `search()` 최초 호출 시 초기화.

#### `async search(state, onProgress) → Array`

SearchState를 입력받아 이름 후보 배열 반환. **비동기.**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `state` | `SearchState` | `_buildSearchState()` 반환값 |
| `onProgress` | `Function\|null` | `({ progress, found })` 콜백 (5%마다 호출) |

**반환:** `[{ h1, h2, s0, isOija, score, familyKr, familyHanja }, ...]`

#### `getRelaxedState(state) → SearchState`

"더보기" 용 — `qualityThreshold -15`, `maxResults +5` 완화.

#### `async searchRelaxed(state, onProgress) → { results, relaxedState }`

완화된 상태로 재탐색. 결과와 새 상태 동시 반환.

### SearchState 구조

```js
{
  nameSpec: { prefer, avoid, minCount, strategy, gridType },
  familyName: { kr: '김', hanja: '金', strokes: 8 },
  constraints: {
    gender: 'M' | 'F',
    dolrim: { kr, hanja, strokes, pos: 2|3 } | null,
    hangryul: { kr, hanja, strokes, pos: 2|3 } | null,
    traits: [1,2,3,4,5,6],   // 성향 코드
    nameType: 1 | 2           // 1=외자, 2=두글자
  },
  searchControl: {
    maxResults: 5,
    qualityThreshold: 60
  },
  _saju: Object,    // calcSaju() 결과 (보고서 렌더링용)
  _scores: Object   // calcOhengScores() 결과
}
```

### 점수 계산 우선순위

**[1순위] 자원오행** — 사주 맞춤 (최대 +130점)

| 항목 | 점수 |
|---|---|
| prefer 오행 1개 충족 | +50 (최대 100) |
| prefer 전부 충족 보너스 | +30 |

**[2순위] 81수리** — 엄격 필터 후 가점 (최대 +130점)

| 조건 | 처리 |
|---|---|
| 정격(말년, g4) ≠ 대길 | **-999 즉시 탈락** |
| 흉·대흉·평 1개라도 있음 | **-999 즉시 탈락** |
| 길 이상만 통과 → 대길 | +25/격 |
| 길 이상만 통과 → 길 | +15/격 |
| 4격 전부 대길 올클 보너스 | +30 |

**[3순위~] 보조 기준**

| 항목 | 점수 | 설명 |
|---|---|---|
| 발음오행 상생 | +10 | 상극 -10, 비화 +5 |
| 수리음양 균형 | +10 | |
| 성향 보너스 | 최대 +15 | |
| 발음음양 균형 | +5 | |

---

## 4. name-search-worker.js — Web Worker 탐색 로직

### 역할
`name-search.js`로부터 Worker로 실행되는 실제 탐색 로직.  
`window` 객체 없음 — `getCho` 등 유틸 함수를 **내부에 재선언**.

> **채점 로직 위임:** 컴포넌트 A~K 채점(`_scoreCombo`)은 `lib/name-score.js`(NameScore)로 추출됨.  
> 워커 최상단에서 `importScripts('name-score.js')`로 로드 후 `_scoreCombo`는 thin 위임자로 동작:  
> `NameScore.scoreCombo(combo, nameSpec, familyName, state, { SURI_DATA, MODERN_SYLLABLE_SCORE, OLDFASHIONED_SET })`.  
> 분파(分破)·운수리(LUCK_SURI)·발음 상수도 NameScore로 이전됨(단일 진실 공급원).  
> ⚠️ `importScripts` 실패 시 INIT_OK가 발신되지 않아 초기화가 멈추므로 경로(lib/name-score.js) 주의.

### 메시지 프로토콜

#### 수신 (main → worker)

| `type` | `payload` | 설명 |
|---|---|---|
| `'INIT'` | `{ hanjaDB, bulyong, suriData }` | 데이터 초기화 (최초 1회) |
| `'SEARCH'` | `{ state }` | 탐색 실행 |
| `'SEARCH_RELAXED'` | `{ state }` | 완화된 조건으로 탐색 |

#### 송신 (worker → main)

| `type` | `payload` | 설명 |
|---|---|---|
| `'INIT_OK'` | - | 초기화 완료 |
| `'SEARCH_RESULT'` | `results[]` | 탐색 결과 |
| `'PROGRESS'` | `{ progress, found }` | 진행률 (5%마다) |

### 성능 설계

| 항목 | 값 | 설명 |
|---|---|---|
| Pool 최대 크기 | 1,500자 | `MAX_POOL = 1500` |
| Prefer 오행 우선 샘플링 | ✅ | prefer 오행 먼저, 나머지 균등 |
| 조기 종료 | `maxResults * 4` 개 | 충분한 결과 확보 시 중단 |
| 진행률 보고 | 5%마다 | postMessage type: `PROGRESS` |

### 내부 선언 상수 (window 없이 독립 동작)

| 상수 | 설명 |
|---|---|
| `OHENG_CYCLE` | `['木','火','土','金','水']` |
| `CHOSUNG` | 한글 초성 19자 |
| `JUNGSUNG` | 한글 중성 21자 |
| `CHO_OHENG` | 초성→오행 맵 |
| `YANG_JUNG` | 양성 모음 Set |
| `TRAIT_MAP` | 성향코드→오행 맵 |

---

## 5. name-formula.js — 발음(소리) 분석 순수 모듈

### 역할
초성→발음오행, 중성→발음음양, 상생 판별, 발음오행 등급 로직의 **단일 진실 공급원**.
이전에는 `index.html`(작명 엔진 closure)·worker 가 각자 같은 로직을 중복 정의했으나,
한 곳(`NameFormula` 네임스페이스)으로 모아 유닛 테스트로 고정한다.

### 충돌 방지
전역에 `NameFormula` 객체 **하나만** 노출. 내부 상수(CHOSUNG/JUNGSUNG/OHENG_CYCLE/YANG_JUNG)는
IIFE 지역 상수라 `index.html`의 기존 `const CHOSUNG`(5276줄)과 충돌하지 않음.
- 브라우저: `window.NameFormula` + 하위호환용 `window.getCho`/`getOhengFromCho`/`getYinYangFromJung` (미정의 시에만 세팅)
- Node(vm): `var NameFormula` 로 context 프로퍼티 노출

### 공개 함수 (NameFormula.*)

| 함수 | 반환 | 설명 |
|---|---|---|
| `getCho(char)` | `string` | 음절 → 초성 (한글 아니면 `''`) |
| `getOhengFromCho(cho)` | `string` | 초성 → 발음오행 (木火土金水) |
| `getChoOheng(char)` | `string` | 음절 → 발음오행 (위 둘 결합) |
| `getYinYangFromJung(char)` | `'양'\|'음'\|''` | 중성 → 발음음양 |
| `isSangsaeng(e1, e2)` | `boolean` | 두 오행 상생/비화 여부 (순·역방향 + 같은 기운 인정) |
| `gradePronunciation(nameStr)` | `{grade, desc, badCount, total, ohengs}` | 이름 전체 초성 오행 연쇄 상생/상극 등급 |

### 발음오행 매핑

| 오행 | 초성 |
|---|---|
| 木 | ㄱ ㅋ ㄲ |
| 火 | ㄴ ㄷ ㄹ ㅌ ㄸ |
| 土 | ㅇ ㅎ |
| 金 | ㅅ ㅈ ㅊ ㅆ ㅉ |
| 水 | ㅁ ㅂ ㅍ ㅃ |

### gradePronunciation 등급 기준 (badCount = 인접 상극 쌍 수, total = 음절수-1)

| 조건 | 등급 |
|---|---|
| `badCount === 0` | 매우 좋음 |
| `badCount * 2 <= total` | 좋음 |
| `badCount === total` | 매우 나쁨 |
| 그 외 | 나쁨 |

### 소비처 (single source of truth)
- `index.html` 작명 엔진 closure (5498~) — `getCho`/`getOhengFromCho`/`isSangsaeng`/`gradePronunciation`/`getYinYangFromJung` 위임
- `<script src="lib/name-formula.js">` 는 `lib/name-spec.js` 다음에 로드
- 테스트: `tests/suites/self/pronunciation.test.js` (45케이스)

> 참고: `index.html` 내 다른 closure(약 5615·7914줄)와 `name-search-worker.js`는 여전히 독립 정의 보유.
> worker 는 `window` 부재로 모듈 import 불가하므로 점진적 통합 대상.

---

## 6. name-score.js — 이름 후보 채점 순수 모듈

### 역할
프리미엄 작명 탐색의 **이름 후보 채점 로직**(구 `name-search-worker.js`의 `_scoreCombo`)을
순수 모듈로 추출 → **single source of truth**. 워커와 (필요 시) 메인스레드가 동일 로직 공유.

`var NameScore = (function(){ ... })()` IIFE 네임스페이스. 공개 멤버:
- `NameScore.scoreCombo(combo, nameSpec, familyName, state, deps)` — 후보 1건 채점
- `NameScore.BUNPA_HANJA` — 분파 구조 한자 Set (400개)
- `NameScore.LUCK_SURI` — 운(運) 중심 길수리 집합

### 충돌 방지
내부 상수(`OHENG_CYCLE`/`CHOSUNG`/`JUNGSUNG`/`CHO_OHENG`/`YANG_JUNG`/`TRAIT_MAP`)와
헬퍼(`_getCho`/`_getJung`)는 **IIFE-local** — `index.html`의 기존 전역 `const CHOSUNG`(5276줄) 등과 충돌 없음.
푸터: `if(typeof window!=='undefined'){ window.NameScore = NameScore; }` — 브라우저/Node 양쪽 안전.

### deps 주입 (결정적 테스트용)
모듈은 워커 모듈 레벨 상태에 직접 의존하지 않고 `deps` 인자로 주입받아 결정적(deterministic):
```javascript
NameScore.scoreCombo(combo, nameSpec, familyName, state, {
  SURI_DATA,               // 81수리 등급표 — 4격 채점([B])
  MODERN_SYLLABLE_SCORE,   // 현대 인기음절 점수표 ([K])
  OLDFASHIONED_SET,        // 구식 음절 Set ([K])
});
```
테스트는 `SURI_DATA`를 Proxy 목으로 주입해 4격 등급을 고정(예: 전부 '길')하고 컴포넌트별 delta 검증.

### 채점 컴포넌트 (A~K) + 하드필터
- **[A] 자원오행** prefer 충족 +50/오행, 전부충족 보너스 +30
- **[B] 81수리** 4격(원·형·이·정) 등급 채점 — 하드필터: 어느 격이든 '대흉' → **-999**, 정격(말년) '평/흉' → **-999**; 등급별 차등(대길/길/평/흉)
- **[C] 발음오행** 상생 +10 / 비화 +5 / 상극 -10
- **[D] 수리음양** 혼재 +10
- **[E] 발음음양** 혼재 +5
- **[F] 성향(traits)** TRAIT_MAP 매칭 +3/개 (최대 15)
- **[G] 대운 보완 / [H] 운 중심 LUCK_SURI(hits×8) / [I] 부모 사주**
- **[J] 동음 패널티** 성=이름첫글자 -30, 이름 두글자 동음 -20
- **[K] 현대성** MODERN_SYLLABLE_SCORE 평균→round(avg/20) 가점 / OLDFASHIONED_SET -3/개
- **분파 하드필터:** [family, h1, h2] 전부 BUNPA_HANJA → **-999** (한 글자라도 非분파면 통과)
- 상한 200 / 하한 -999

### 워커 위임 관계 (single source of truth)
- `name-search-worker.js` 최상단 `importScripts('name-score.js')` 후
  `_scoreCombo`는 thin 위임자: `return NameScore.scoreCombo(combo, nameSpec, familyName, state, { SURI_DATA, MODERN_SYLLABLE_SCORE, OLDFASHIONED_SET });`
- `BUNPA_HANJA`/`LUCK_SURI` 원본 소유권이 NameScore로 이전 — 워커 내 중복 정의 삭제됨
- ⚠️ `importScripts` 실패 시 INIT_OK 미발신 → 초기화 hang. 경로(lib/name-score.js) 주의.

### 로드 순서
`<script src="lib/name-score.js">` 는 `lib/name-formula.js` 다음, `lib/name-search.js` 이전.

### 테스트
`tests/suites/premium/name-score.test.js` (15케이스) — baseline(두글자 160 / 외자 165),
[A] prefer delta, [B] 하드필터(대흉·정격평/흉→-999, 전부대길→cap200), [분파], [C] 상생/상극 delta20,
[F] trait +3, [J] 동음 -30, [K] 현대 +4 / 구식 -6. 헬퍼 `_suriAll(grade)`(Proxy) / `_deps(grade, extra)`.
