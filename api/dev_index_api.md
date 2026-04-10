# api/ — 개발 종속성 인덱스

> Claude API 소견서 생성 폴더.  
> 브라우저에서 직접 호출하지 않고, `index.html` 인라인 JS가 import하여 사용.

---

## 목차

1. [claude-report.js — 소견서 생성](#1-claude-reportjs--소견서-생성)

---

## 1. claude-report.js — 소견서 생성

### 의존 전역 변수
- `SURI_DATA` (`data/suri-data.js`)
- `getSeoryeokStatus()` (`lib/saju-engine.js`)

### 호출 순서 (API 우선순위)

```
1차: POST /proxy/claude          ← server.py 프록시 (CORS 안전)
  ↓ 실패(404) 또는 연결 불가
2차: POST https://api.anthropic.com/v1/messages
     + 헤더: anthropic-dangerous-direct-browser-access: true
     (개발 환경 전용, 프로덕션 비권장)
```

### 공개 함수

#### `async generatePremiumReport(candidate, state) → Object`

단일 이름 후보 → Claude 소견서 JSON 생성.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `candidate` | `Object` | `NameSearchEngine.search()` 결과 항목 |
| `state` | `SearchState` | `_buildSearchState()` 반환값 |

**candidate 구조:**
```js
{
  h1: { kr, h, m, s, o },   // 이름 첫째 글자
  h2: { kr, h, m, s, o },   // 이름 둘째 글자 (외자면 null)
  s0: 8,                     // 성씨 원획법 획수
  score: 87,                 // 종합 점수
  familyKr: '김',
  familyHanja: '金',
  isOija: false
}
```

**반환 (성공):**
```js
{
  tagline: '"김나윤, 깊은 물처럼 고요하게 세상을 밝히다"',
  sajuAnalysis: '癸巳 일주의 기질로...',
  namingLogic: '자원오행 土와 水가 사주의 부족한...',
  hanjaDetails: [
    {
      hanja: '娜', kr: '나', meaning: '아리따울',
      strokes: 10, oheng: '土',
      synergyWithSaju: '火가 강한 사주에 土로 연결하여...'
    },
    { hanja: '奫', ... }
  ],
  lifeFlow: {
    early: '탄탄한 기초를 쌓는 시기',
    middle: '재능을 발휘하는 시기',
    late: '풍요로운 결실의 시기'
  },
  careerAdvice: '언론, 교육, 창작 분야에서 두각을 나타냅니다.',
  healthAdvice: '水 기운 보충을 위해 충분한 수분 섭취를 권장합니다.'
}
```

**반환 (실패 시 기본값):**  
API 오류 또는 JSON 파싱 실패 시 구조는 동일하나 내용이 단순해짐.  
절대 `throw`하지 않음 — 항상 객체 반환.

#### `async generateAllReports(candidates, state) → Array`

최대 3개 후보를 병렬(Promise.all)로 소견서 생성.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `candidates` | `Array` | `search()` 결과 배열 |
| `state` | `SearchState` | SearchState |

**반환:** `[report1, report2, report3]` — candidates 순서와 동일

### 내부 동작

#### 프롬프트 구성 팩트 (system + user)

소견서 품질은 아래 팩트의 정확성에 의존.  
**saju-engine, name-search 결과가 정확해야 소견서도 정확.**

| 팩트 | 출처 |
|---|---|
| 사주 4주 (연월일시 간지) | `state._saju` |
| 오행 점수 + 세력 상태 | `state._scores` |
| NameSpec (prefer/avoid/strategy) | `state.nameSpec` |
| 한자별 뜻·획수·자원오행 | `candidate.h1`, `candidate.h2` |
| 4격 수리 (원격·형격·이격·정격) | 내부 계산 |
| 부모 희망 성향 | `state.constraints.traits` |

#### 사용 모델 및 파라미터

| 항목 | 값 |
|---|---|
| 모델 | `claude-sonnet-4-20250514` |
| max_tokens | 1,500 |
| 응답 형식 | JSON only (no markdown) |

### 주의사항

- **JSON 파싱 에러 처리:** `replace(/\`\`\`json|\`\`\`/g, '')` 후 파싱
- **비용:** 소견서 1개 약 $0.01~0.03 (Sonnet 기준)
- **소요 시간:** 1개 약 5~15초, 3개 병렬 약 10~20초
- **Rate limit:** Anthropic 계정 티어에 따라 429 오류 가능  
  → `api/claude-report.js` 내 catch에서 기본값 반환하므로 UI 크래시 없음
