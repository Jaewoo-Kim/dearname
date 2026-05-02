# api/ — 개발 종속성 인덱스

> Claude API 소견서 생성 폴더.  
> 브라우저에서 직접 호출하지 않고, `index.html` 인라인 JS가 import하여 사용.

---

## 목차

1. [claude-report.js — 소견서 생성](#1-claude-reportjs--소견서-생성)

---

## 1. claude-report.js — 소견서 생성

> **v2.1 (2026-05-02)**: 공식 생성 필드 분리 + 프롬프트 캐싱 적용 — 비용 ~27% 절감

### 의존 전역 변수
- `SURI_DATA` (`data/suri-data.js`)
- `getSeoryeokStatus()` (`lib/saju-engine.js`)
- `window.getCho`, `window.getOhengFromCho`, `window.getYinYangFromJung` (index.html 인라인 노출)

### 호출 순서 (API 우선순위)

```
1차: POST /proxy/claude          ← server.py 프록시 (CORS 안전)
  ↓ 실패(404) 또는 연결 불가
2차: POST https://api.anthropic.com/v1/messages
     + 헤더: anthropic-dangerous-direct-browser-access: true
     + 헤더: anthropic-beta: prompt-caching-2024-07-31
     (개발 환경 전용, 프로덕션 비권장)
```

### 아키텍처: 공식 필드 vs Claude 필드

12개 보고서 필드를 역할별로 분리:

| 구분 | 필드 | 생성 방식 |
|---|---|---|
| **JS 공식** | `soundStory`, `suriStory`, `lifeFlow`, `careerJobs`, `healthAdvice` | `_genFormulaFields()` — 데이터 기반 확정 생성 |
| **Claude 서술** | `tagline`, `sajuStory`, `jawonStory`, `hanjaDetails`, `hanjaStory`, `conclusionLetter`, `careerAdvice` | Claude API — 감성·맥락 서술 |

→ Claude 출력 토큰 ~480 tok 절감 (~22%), 전체 비용 ~27% 절감

### 공개 함수

#### `async generatePremiumReport(candidate, state) → Object`

단일 이름 후보 → Claude 7개 서술 필드 JSON 생성.

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

**반환 (성공):** 7개 Claude 필드 (`tagline`, `sajuStory`, `jawonStory`, `hanjaDetails[]`, `hanjaStory`, `conclusionLetter`, `careerAdvice`)  
**반환 (실패 시):** 동일 구조 폴백. 절대 `throw` 안 함.

#### `async generateAllReports(candidates, state) → Array`

최대 3개 후보를 **순차(sequential)** 호출 → 프롬프트 캐시 히트 극대화.  
각 이름에 `_genFormulaFields()`로 공식 필드 생성 후 Claude 결과와 병합 반환.

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `candidates` | `Array` | `search()` 결과 배열 |
| `state` | `SearchState` | SearchState |

**반환:** `[report1, report2, report3]` — 12개 필드 완성된 객체 배열

#### 내부 공식 생성 함수 (비공개)

| 함수 | 출력 필드 | 로직 |
|---|---|---|
| `_genSoundStory(candidate)` | `soundStory` | `window.getCho`→초성오행→상생 분석, 음양 모음 체크 |
| `_genSuriStory(candidate)` | `suriStory` | g1~g4 계산 → `SURI_DATA` 격명 조합 |
| `_genLifeFlow(candidate)` | `lifeFlow.early/middle/late` | g1~g4 + 자원오행으로 시기별 서술 |
| `_genCareerJobs(candidate)` | `careerJobs` | 자원오행 기반 직업군 4개 반환 |
| `_genHealthAdvice(state)` | `healthAdvice` | `_scores` 가장 낮은 오행 기반 조언 |
| `_genFormulaFields(candidate, state)` | 위 5개 합본 | orchestrator |

### 내부 동작

#### 프롬프트 구성 팩트 (system + user)

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
| max_tokens | **1,800** (기존 2,500 → 절감) |
| 응답 형식 | JSON only (no markdown) |
| 시스템 프롬프트 캐싱 | `cache_control: {type: 'ephemeral'}` (5분 TTL) |

#### 비용 구조 (실측 기준)

| 이름 수 | 입력(캐시미스) | 입력(캐시히트) | 출력 | 합계 |
|---|---|---|---|---|
| 1개 | ~$0.004 | — | ~$0.026 | **~$0.030** |
| 3개 | $0.004 + $0.001×2 | — | ~$0.079 | **~$0.085** |
| 최적(3개, 캐시 적중) | $0.004 + $0.0003×2 | — | ~$0.079 | **~$0.083** |

### 주의사항

- **JSON 파싱 에러 처리:** `replace(/\`\`\`json|\`\`\`/g, '')` 후 파싱
- **캐시 히트 로깅:** 개발 콘솔에서 `[DearName] 토큰 — 입력:N 캐시읽기:N ...` 확인 가능
- **순차 호출 이유:** `generateAllReports`가 `Promise.all` → `for...of` 순차로 변경됨.  
  시스템 프롬프트 캐시(5분 TTL)가 2·3번째 이름 호출 시 적중하려면 순차가 필요.
- **Rate limit:** 429 오류 시 catch에서 폴백 반환 → UI 크래시 없음
