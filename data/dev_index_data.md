# data/ — 개발 종속성 인덱스

> 순수 데이터 파일 폴더. 로직 없음, 전역 변수만 선언.  
> 수정 시 반드시 아래 기술된 데이터 구조와 검증 케이스를 확인할 것.

---

## 목차

1. [hanja-db.js — 인명용 한자 DB](#1-hanja-dbjs--인명용-한자-db)
2. [manjuryeok.js — 동추원 만세력](#2-manjuryeokjs--동추원-만세력)
3. [suri-data.js — 81수리](#3-suri-datajs--81수리)
4. [lunar-calendar.js — 음력 변환](#4-lunar-calendarjs--음력-변환)
5. [modern-name-db.js — 현대 이름 음절 점수 DB](#5-modern-name-dbjs--현대-이름-음절-점수-db)

---

## 1. hanja-db.js — 인명용 한자 DB

### 출처
인명용 한자 획수 원획법 구분용 엑셀 (한국어문회 기준)

### 선언하는 전역 변수

#### `HANJA_DB_FULL`
```js
// 구조: { '음(한글)': [ {h, m, s, o}, ... ] }
const HANJA_DB_FULL = {
  '가': [
    { h: '伽', m: '절',       s: 7,  o: '火' },
    { h: '佳', m: '아름다울', s: 8,  o: '火' },
    // ...
  ],
  '나': [ ... ],
  // ...총 505개 음
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `h` | `string` | 한자 글자 |
| `m` | `string` | 뜻 (훈) |
| `s` | `number` | **원획법** 획수 (수리 계산에 사용) |
| `o` | `string` | 자원오행 (`'木'|'火'|'土'|'金'|'水'`) |

- 총 **7,017자** (정제 완료: 획수오류 2건 수정, 중복 28건·PUA 19건·불용한자丑 1건 제거)
- `s` 값은 일반 획수가 아닌 **원획법(原劃法)** 기준 — 수리 계산 시 반드시 이 값 사용

#### `BULYONG_HANJA`
```js
const BULYONG_HANJA = ['磬', '辜', '錮', ...]; // 총 46자
```
이름에 사용 금지된 한자 목록. `NameSearchEngine._buildPool()`에서 자동 필터링됨.

### 사용처
- `lib/name-search.js` → `_buildPool()` — Pool 구성 시 참조
- `lib/name-search-worker.js` → `_buildPool()` — Worker 내 Pool 구성
- `index.html` → `generateHanjaSelectors()` — 한자 선택 드롭다운 생성
- `index.html` → `getHanjaStrokes()` — 한자 획수 조회

### 주의사항
- `h` 중복 가능 (같은 한자가 다른 음으로 등록된 경우)
- `o` 값이 없거나 `s <= 0`인 항목은 `_buildPool()`에서 자동 제외됨

---

## 2. manjuryeok.js — 동추원 만세력

### 출처
동추원만세력.pdf — 1921~2040년, 총 120개 연도

### 선언하는 전역 변수

#### `MANJURYEOK`
```js
const MANJURYEOK = {
  "2025": {
    m: {                         // 월주 (月柱) — 12개
      "1": "丁丑月", "2": "戊寅月", ...
    },
    j: {                         // 절기 (節氣) — 12개, 월주 변경 기준점
      "1": { d: 5, h: 11, min: 32 },   // 1월: 5일 11시 32분
      "3": { d: 5, h: 17, min:  7 },   // 3월(경칩): 5일 17시 7분
      // ...
    },
    g: "庚",  // 1월 1일 일진 — 천간
    z: "午"   // 1월 1일 일진 — 지지
  },
  "1921": { ... },
  // ...1921~2040
}
```

| 키 | 설명 |
|---|---|
| `m[월번호]` | 해당 월의 월주 간지 문자열 (`"己卯月"` 형식) |
| `j[월번호].d` | 해당 월 절기 날짜 (양력 일) |
| `j[월번호].h` | 절기 시각 (시) |
| `j[월번호].min` | 절기 시각 (분) |
| `g` | 해당 연도 1월 1일의 일진 **천간** |
| `z` | 해당 연도 1월 1일의 일진 **지지** |

### 사용처
- `lib/saju-engine.js` → `getMonthPillar()` — 절기 기준 월주 결정
- `lib/saju-engine.js` → `getDayPillar()` — 1월1일 일진 + 경과일 계산

### 검증 케이스 (수정 시 반드시 확인)

| 입력 | 기대 결과 |
|---|---|
| 2025년 3월 25일 (양력) | 일주: 癸巳, 월주: 己卯月 |
| 2025년 3월 3일 10시 | 경칩(3/5) 이전 → 월주: 戊寅月 |
| 1984년 1월 1일 | 일진: 甲午 (`g:"甲"`, `z:"午"`) |

---

## 3. suri-data.js — 81수리

### 출처
합본28.html 인라인 스크립트에서 분리

### 선언하는 전역 변수

#### `SURI_DATA`
```js
const SURI_DATA = [
  null,  // 인덱스 0 (미사용)
  { name: "태초격(太初格)", grade: "길",  desc: "..." },  // 1수
  { name: "분리격(分離格)", grade: "흉",  desc: "..." },  // 2수
  // ...총 81항목 (1~81)
];
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `name` | `string` | 수리 격 이름 |
| `grade` | `'길'\|'흉'` | 등급 (대길/대흉 미사용, 길/흉만 있음) |
| `desc` | `string` | 풀이 설명 |

- **`grade` 분포:** 길 44개, 흉 37개
- **대흉 과락 로직:** `lib/name-search-worker.js`에서 `_scoreCombo()` 시 `grade === '대흉'` 체크 → 현재 데이터엔 없지만 로직은 준비됨

### 사용처
- `lib/name-search-worker.js` → `_scoreCombo()._getSuriGrade()`
- `api/claude-report.js` → `getSuriInfo()` — 소견서 팩트 구성
- `index.html` → `getAnalysisData()` — 셀프 진단 수리 분석

### 수리 계산 공식 (4격)

| 격 | 외자 | 두 글자 | 의미 |
|---|---|---|---|
| 원격 | `s1 + 1` | `s1 + s2` | 초년운 |
| 형격 | `s0 + s1` | `s0 + s1` | 청년운 (중심운) |
| 이격 | `s0 + 1` | `s0 + s2` | 장년운 |
| 정격 | `s0 + s1` | `s0 + s1 + s2` | 말년운 (총운) |

> `s0` = 성씨 획수, `s1` = 이름 첫째 글자 원획법 획수, `s2` = 이름 둘째 글자 원획법 획수  
> 81 초과 시: `n % 81` (0이면 81로 처리)

---

## 4. lunar-calendar.js — 음력 변환

### 출처
한국천문연구원 역서 기준 (1960~2030년)

### 선언하는 전역 변수

#### `LUNAR_DB`
```js
const LUNAR_DB = {
  2024: {
    leap: 6,                  // 윤달 위치 (0이면 윤달 없음)
    starts: [                 // 각 음력월 1일의 양력 절대일수
      45330,  // 음력 1월 1일 = 양력 2024-02-10
      45360,  // 음력 2월 1일 = 양력 2024-03-11
      // ...
      45684,  // 음력 12월 1일 = 양력 2025-01-29 (← 다음해도 포함 가능)
    ]
  },
  // 1960~2030
}
```

- **기준일:** 양력 1900년 1월 1일 = 절대일수 0
- **윤달이 있는 해:** `starts` 배열이 13개 (`leap` 값 위치에 윤달 삽입)
  - `leap=6`이면 `starts[5]`=6월, `starts[6]`=윤6월, `starts[7]`=7월, ...

#### `_LUNAR_BASE`
```js
const _LUNAR_BASE = new Date(Date.UTC(1900, 0, 1));
```

### 공개 함수

#### `lunarToSolar(ly, lm, ld, isLeap) → string|null`

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `ly` | `number` | 음력 연도 |
| `lm` | `number` | 음력 월 (1~12) |
| `ld` | `number` | 음력 일 |
| `isLeap` | `boolean` | 윤달 여부 |

**반환:** `'YYYY-MM-DD'` 양력 날짜 문자열 또는 `null` (변환 실패)

#### `normalizeToSolar(dateStr, calType) → string`

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `dateStr` | `string` | `'YYYY-MM-DD'` |
| `calType` | `'solar'\|'lunar'\|'leap'` | 달력 종류 |

**반환:** 양력 `'YYYY-MM-DD'`. 변환 실패 시 `dateStr` 원본 반환.

### 검증 케이스 (수정 시 반드시 확인)

| 음력 입력 | 기대 양력 결과 |
|---|---|
| 2025년 1월 1일 | 2025-01-29 |
| 2024년 6월 1일 | 2024-07-06 |
| 2024년 **윤**6월 1일 | 2024-08-04 |
| 2022년 **윤**2월 1일 | 2022-04-01 |
| 1990년 1월 1일 | 1990-01-27 |

### 사용처
- `index.html` → `_buildSearchState()` — 프리미엄 폼 음력 변환
- `index.html` → `getAnalysisData()` — 셀프 진단 음력 변환
- `index.html` → `updateLunarLabel()` — 실시간 변환 라벨 표시
- `index.html` → `updateSelfLunarLabel()` — 셀프작명 변환 라벨 표시
- `index.html` → `validatePremiumForm()` — 입력값 검증

---

## 5. modern-name-db.js — 현대 이름 음절 점수 DB

### 출처
2020–2025 통계청 신생아 출생신고 통계 기반 인기 음절 순위

### 선언하는 전역 변수

#### `MODERN_SYLLABLE_SCORE`
```js
// 구조: { '한글음절': 점수(0~100) }
const MODERN_SYLLABLE_SCORE = {
  '서': 100, '윤': 95, '아': 92, '이': 90, ...
};
```
- 여아·남아 모두 포함
- 점수 범위: 0 (미등록/구식) ~ 100 (최상위 인기)

#### `OLDFASHIONED_SYLLABLES`
```js
// Set<string> — 구식으로 분류된 한글 음절
const OLDFASHIONED_SYLLABLES = new Set(['순', '자', '복', ...]);
```

#### `calcModernBonus(h1Kr, h2Kr) → number`
- 두 이름 음절의 현대성 점수를 계산해 -5 ~ +5 범위의 보너스 반환

### 사용처
- `lib/name-search.js` → Worker INIT 메시지에 포함하여 전달
- `lib/name-search-worker.js` → `_scoreCombo()` `[K] 현대성 보너스` (최대 +5점)
- `index.html` → 데모 이름 후보 (김서윤·김리서·김채서) 우선 선택 기준
