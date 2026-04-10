# lib/ — 개발 종속성 인덱스

> 사주 계산·이름 탐색 엔진 폴더.  
> `data/` 파일들이 먼저 로드된 후에만 정상 동작.

---

## 목차

1. [saju-engine.js — 사주 계산 엔진](#1-saju-enginejs--사주-계산-엔진)
2. [name-spec.js — NameSpec 생성](#2-name-specjs--namespec-생성)
3. [name-search.js — 탐색 엔진 (Worker 어댑터)](#3-name-searchjs--탐색-엔진-worker-어댑터)
4. [name-search-worker.js — Web Worker 탐색 로직](#4-name-search-workerjs--web-worker-탐색-로직)

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

셀프작명 6번째 지표(사주오행) 전용.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `hanjaOhengs` | `string[]` | 선택된 한자들의 자원오행 배열 |
| `birthDate` | `string` | 양력 `'YYYY-MM-DD'` |
| `birthTime` | `string` | `'HH:MM'` |
| `options` | `Object` | `calcSaju()` options와 동일 (apply30min, yajasi) |

**반환:** `{ grade: '대길'|'길'|'평'|'흉', desc: string }`

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

#### `buildNameSpec(saju, scores) → Object`

사주 + 오행 점수 → 이름 설계도(NameSpec) 생성.  
3단계 우선순위: **긴급진단 → 특수격 → 일반격 중화**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `saju` | `Object` | `calcSaju()` 반환값 |
| `scores` | `Object` | `calcOhengScores()` 반환값 |

**반환:**
```js
{
  prefer:   ['水', '木'],    // 자원오행에 포함해야 할 오행 (최대 2개)
  avoid:    ['火', '土'],    // 자원오행에서 피해야 할 오행 (최대 2개)
  minCount: { '水': 1 },    // 최소 포함 횟수
  strategy: 'balance',      // 'balance' | 'reinforce'
  gridType: 'general',      // 격 종류 (특수격이면 '종왕격' 등)
  diagnosis: [              // 긴급진단 결과 메모
    { type: '조후', msg: '여름 태생 + 水 극약 → 水 최우선' }
  ]
}
```

### 판단 로직 (우선순위 순)

1. **조후 긴급:** 월지 기준 여름(巳午未) + 水<5점 → prefer Water  
2. **통관 긴급:** 상극 쌍 각 25점↑ 대립 → 중재 오행 prefer  
3. **고립 긴급:** 오행 5점 미만 + 극하는 오행 40점↑ → 생하는 오행 prefer  
4. **특수격:** 특정 오행 60점↑ + 극오행 5점 미만 → 강화(reinforce) 전략  
5. **일반격:** 부족(weak↓) prefer, 과다(strong↑) avoid

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

### 점수 계산 항목 (최대 100점)

| 항목 | 점수 | 설명 |
|---|---|---|
| 자원오행 prefer 충족 | Prefer 1개 +50 | 최대 100 |
| Prefer 전부 충족 보너스 | +30 | |
| 81수리 길 격 수 | 격당 +5 | 최대 20 |
| 81수리 대흉 | -999 | 즉시 탈락 |
| 발음오행 상생 | +10 | 상극 -10, 비화 +5 |
| 수리음양 균형 | +10 | |
| 발음음양 균형 | +5 | |
| 성향 보너스 | 최대 +15 | |

---

## 4. name-search-worker.js — Web Worker 탐색 로직

### 역할
`name-search.js`로부터 Worker로 실행되는 실제 탐색 로직.  
`window` 객체 없음 — `getCho` 등 유틸 함수를 **내부에 재선언**.

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
