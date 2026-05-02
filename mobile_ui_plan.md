# 모바일 UI 개선 기획서

> 기준일: 2026-05-02  
> 대상: `index.html` 인라인 CSS (반응형 미디어쿼리)  
> 참고: 사용자 실기기 스크린샷 분석 + CSS 코드 리뷰 종합

---

## 1. 현황 요약

### 현재 적용된 반응형 구조

| breakpoint | 주요 처리 |
|---|---|
| `max-width: 992px` | .theory-split 세로 전환 |
| `max-width: 768px` | 그리드 1열, 히어로 패딩/폰트 축소, 햄버거 메뉴 |
| `max-width: 640px` | .exec-summary 세로 전환, .oheng-layout 1열 |
| `max-width: 600px` | .suri-seasons-grid, .ai-conclusion-grid, chat 버블 |
| `max-width: 540px` | .chapter-theory-pillars 1열 |
| `max-width: 520px` | .oheng-tip-card 컬럼 축소 |
| `max-width: 480px` | 이름탭 1열, 사주한자 폰트, 섹션/히어로/카드 패딩 대폭 축소 |

---

## 2. 문제점 분석 (스크린샷 기반)

### 🔴 Critical — 레이아웃 파괴 수준

#### P1. `.report-visual` 패딩 모바일 미적용
```css
/* 현재 (모바일 오버라이드 없음) */
.report-visual { padding: 50px; }
```
- 390px 화면에서 좌우 패딩 합 100px → 컨텐츠 너비 190px밖에 남지 않음
- "AI 대가의 작명 소견서" 미리보기 카드가 극도로 압축돼 보임
- **수정**: `768px` → `padding: 28px 20px`, `480px` → `padding: 20px 14px`

#### P2. `.form-card` 패딩 모바일 미적용
```css
/* 현재 (모바일 오버라이드 없음) */
.form-card { padding: 60px; }
```
- 셀프 작명 섹션 입력 폼 카드가 극도로 압축됨
- **수정**: `768px` → `padding: 28px 16px`, `480px` → `padding: 20px 12px`

#### P3. `.full-width-form` grid-column span 미해제
```css
/* 현재 */
.full-width-form { grid-column: span 2; }
/* 768px에서 form-grid가 1열이 되어도 span 2가 유지됨 → 레이아웃 깨짐 */
```
- **수정**: `768px` → `.full-width-form { grid-column: span 1; }`

---

### 🟠 Major — 가독성·사용성 저하

#### P4. `.timeline` 좌측 오프셋 과다
```css
/* 현재 (모바일 오버라이드 없음) */
.timeline { padding-left: 50px; margin-left: 20px; }
/* 합계 70px → 390px 화면의 18% 소비 */
.time-step { margin-bottom: 60px; }
.time-step::before { left: -61px; } /* 타임라인 도트 좌표도 불일치 가능 */
```
- 프로세스 스텝 섹션이 오른쪽으로 치우쳐 보임
- **수정**: `768px` → `padding-left: 28px; margin-left: 8px; .time-step { margin-bottom: 36px; }`

#### P5. `.highlight-quote` 폰트 모바일 미축소
```css
/* 현재 (모바일 오버라이드 없음) */
.highlight-quote { font-size: 1.7rem; }
```
- intro-grid가 1열로 전환될 때 헤드라인이 여전히 데스크탑 크기
- **수정**: `768px` → `font-size: 1.35rem`

#### P6. `.hanja-circle` (섹션용) 크기 모바일 미축소
```css
/* 현재 — 소개 섹션 한자 원 (모바일 오버라이드 없음) */
.hanja-circle { width: 100px; height: 100px; font-size: 2.8rem; }
/* 보고서 내부 한자 원은 이미 72px로 별도 정의됨 */
```
- 소개 섹션(이름 뜻 설명)에서 100px 원이 세로 배치 시 불균형
- **수정**: `768px` → `width: 72px; height: 72px; font-size: 2rem; border-width: 3px`

#### P7. `.report-narrative` 패딩
```css
/* 현재 (모바일 오버라이드 없음) */
.report-narrative { padding: 25px; }
```
- report-visual 내부 인용구 박스가 좌우 공간 과다 사용
- **수정**: `768px` → `padding: 16px`

#### P8. `.intro-grid` gap 과다 (1열 전환 후)
```css
/* 현재 */
.intro-grid { gap: 60px; }
/* 768px에서 1열 전환되지만 gap은 60px 유지 */
```
- 세로 스택 시 섹션 간 간격이 60px로 너무 큼
- **수정**: `768px` → `.intro-grid { gap: 32px; }`

---

### 🟡 Minor — 세부 폴리싱

#### P9. `.advice-card` 패딩 (768px 오버라이드 없음)
```css
.advice-card { padding: 40px 30px; }
/* 480px에서 28px 18px 적용되지만 768px~480px 사이 구간 미처리 */
```
- **수정**: `768px` → `padding: 28px 20px`

#### P10. `.time-step h4` 폰트
```css
.time-step h4 { font-size: 1.4rem; }
/* 모바일 오버라이드 없음 */
```
- **수정**: `768px` → `font-size: 1.15rem`

#### P11. `.report-visual h4` 폰트
```css
.report-visual h4 { font-size: 1.5rem; }
/* 모바일 오버라이드 없음 */
```
- **수정**: `768px` → `font-size: 1.2rem`

#### P12. `.meaning-item` margin-bottom/padding-bottom (소개 섹션)
```css
.meaning-item { margin-bottom: 40px; padding-bottom: 40px; }
/* 768px에서 flex-direction:column으로 전환되나 gap은 유지 */
```
- **수정**: `768px` → `margin-bottom: 28px; padding-bottom: 28px; gap: 20px`

---

## 3. 개선 계획 (우선순위별)

### Phase 1 — Critical 수정 (P1~P3)
> 레이아웃 파괴 수준 버그. 즉시 적용 필요.

| 항목 | 변경 내용 | 예상 효과 |
|---|---|---|
| `.report-visual` | 768px: `padding:28px 20px` / 480px: `padding:20px 14px` | 소견서 미리보기 카드 정상화 |
| `.form-card` | 768px: `padding:28px 16px` / 480px: `padding:20px 12px` | 폼 카드 압축 해제 |
| `.full-width-form` | 768px: `grid-column:span 1` | 폼 그리드 1열에서 레이아웃 정상화 |

### Phase 2 — Major 수정 (P4~P8)
> 가독성 및 시각적 완성도. 1~2일 내 적용 권장.

| 항목 | 변경 내용 |
|---|---|
| `.timeline` | 768px: `padding-left:28px; margin-left:8px` |
| `.time-step` | 768px: `margin-bottom:36px` |
| `.time-step::before` | 768px: `left:-37px` (새 오프셋 맞춤) |
| `.highlight-quote` | 768px: `font-size:1.35rem` |
| `.hanja-circle` (소개용) | 768px: `width:72px; height:72px; font-size:2rem` |
| `.report-narrative` | 768px: `padding:16px` |
| `.intro-grid` | 768px: `gap:32px` 추가 |

### Phase 3 — Minor 폴리싱 (P9~P12)
> 세부 완성도. 여유 시 적용.

| 항목 | 변경 내용 |
|---|---|
| `.advice-card` | 768px: `padding:28px 20px` |
| `.time-step h4` | 768px: `font-size:1.15rem` |
| `.report-visual h4` | 768px: `font-size:1.2rem` |
| `.meaning-item` | 768px: `margin-bottom:28px; padding-bottom:28px; gap:20px` |

---

## 4. 추가 고려사항

### 미완료 모바일 최적화
- `section-tag` (섹션 태그 라벨) 폰트 모바일 미축소
- `.live-ticker` 텍스트 크기 모바일 미처리
- `#self-naming` 폼 섹션 입력 필드 최소 높이 44px 보장 필요 (iOS 터치 타겟)
- 프리미엄 섹션 내부 `h2` 폰트 모바일 오버라이드 없음

### 보고서 뷰 모바일
- `exec-summary` 640px 처리 있음 ✅
- `oheng-layout`, `suri-seasons-grid`, `ai-conclusion-grid` 처리됨 ✅
- `chapter-verdict-strip` 모바일 여백 검토 필요

---

## 5. 구현 위치

`index.html` 내 `@media (max-width: 768px)` 블록 (현재 라인 약 560~600)과  
`@media (max-width: 480px)` 블록 (현재 라인 약 603~630)에 추가.

```
Phase 1 변경량: +6줄 CSS
Phase 2 변경량: +12줄 CSS
Phase 3 변경량: +8줄 CSS
총 예상 변경: ~26줄
```

---
---

# 2차 모바일 UI 개선 기획서

> 기준일: 2026-05-02  
> 배경: 사용자 실기기 스크린샷 2차 분석 — 탭·폼·결과 그리드 영역

---

## A. 현황 요약 — 신규 문제 영역

1차 기획(Phase 1~3)에서 처리한 패딩·폰트 이슈와 별개로,  
**입력 폼 구조 / 탭 UI / 결과 그리드** 세 영역에 구조적 레이아웃 파괴가 존재.

---

## B. 문제점 분석

### 🔴 Critical — 레이아웃 파괴 수준

#### F1. `.birth-form-area` — 출생 입력 행 모바일 전면 붕괴

**현재 구조:**
```
[연도▼] [월▼] [일▼] [양력|음력] | [오전|오후] [시▼] [분▼] [출생지▼▼▼▼▼▼▼▼]
```
- 총 8개 요소가 `display:flex; flex-wrap:wrap` 한 행에 나열
- 최소 필요 너비: ~650px (연도 106 + 월+일 각 ~80 + pill ~100 + sep + ampm ~90 + 시 70 + 분 74 + 출생지 90)
- 390px 화면에서 `flex-wrap:wrap`이 발동되나 **줄바꿈 경계가 예측 불가**
  → 출생지 select가 시간 select 사이에 끼거나, 양력/음력 pill이 고립되는 등 랜덤 배치

**수정 방향 — HTML 구조 수정 + CSS:**
```
[행 1 — 날짜] [연도▼] [월▼] [일▼] [양력|음력]
[행 2 — 시간] [오전|오후] [시▼] [분▼]
[행 3 — 지역] [출생지▼▼▼▼▼▼▼▼▼▼▼▼▼▼]
```

**구체적 수정:**
1. HTML: `birth-form-area` 내부를 3개 `<div class="bf-row">` 로 그루핑
   - `.bf-row--date`: 연도·월·일·양력음력 pill
   - `.bf-row--time`: 오전오후·시·분
   - `.bf-row--city`: 출생지 select
2. CSS(768px):
   ```css
   .birth-form-area { flex-direction: column; gap: 10px; align-items: stretch; }
   .bf-row { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; }
   .bf-row--date .bf-select { flex: 1; min-width: 0; }
   .bf-row--city .bf-city-select { width: 100%; }
   .bf-sep { display: none; }
   ```
3. 대상 섹션: `#self-naming` + `#premium` wizard step 1 + step 3 부모 사주 행 (동일 구조 3곳)

---

#### F2. `#hanja-dropdowns` — 한자 드롭다운 인라인 flex 고정

**현재:**
```html
<div id="hanja-dropdowns" style="display: flex; gap: 20px;"></div>
```
- 2개 `.hanja-block` (성·이름)이 `flex:1`로 나란히 배치
- 390px 기준 각 block: (390 - 28pad*2 - 20gap) / 2 ≈ **157px** → 내부 select 극도로 압축

**수정:**
- HTML: inline style `style="display: flex; gap: 20px;"` → class="hanja-dropdowns-flex" 로 전환 (inline 제거)
- CSS:
  ```css
  .hanja-dropdowns-flex { display: flex; gap: 20px; }
  /* 768px */
  .hanja-dropdowns-flex { flex-direction: column; gap: 14px; }
  ```
- `#hanja-dropdowns` 를 id selector로 직접 오버라이드해도 가능 (inline style 제거 후):
  ```css
  /* 768px */
  #hanja-dropdowns { flex-direction: column; gap: 14px; }
  ```

---

### 🟠 Major — 가독성·사용성 저하

#### F3. 폼 섹션 h3 타이틀 인라인 폰트 미적용

**현재:**
```html
<h3 style="font-size: 2rem; ...">우리 아이 이름을 직접 지어보아요.</h3>
```
- inline style → CSS media query가 덮을 수 없음
- 390px에서 2rem(32px) 제목 2줄 → 과도한 공간 차지

**수정:**
- HTML: `style="font-size:2rem"` 제거 → `.form-card-title` class 추가
- CSS:
  ```css
  .form-card-title { font-size: 2rem; margin-bottom: 12px; font-weight: 800; }
  /* 768px */
  .form-card-title { font-size: 1.55rem; }
  /* 480px */
  .form-card-title { font-size: 1.35rem; }
  ```

---

#### F4. `.result-row-4` — 진단결과 4열 그리드 모바일 미해제

**현재:**
```css
.result-row-4 { grid-template-columns: repeat(4, 1fr); }
```
- 390px에서 4열 = 각 셀 약 **80px** → 내용이 모두 overflow·압축

**수정:**
```css
/* 768px */
.result-row-4 { grid-template-columns: repeat(2, 1fr); }
/* 480px */
.result-row-4 { grid-template-columns: 1fr; }
```

---

#### F5. `#analysis-result-area` h3 — 진단결과 헤더 flex overflow

**현재:**
```html
<h3 style="display: flex; align-items: center; justify-content: space-between;">
    진단 결과 요약
    <span style="...">총 6개 지표 평가 완료</span>
</h3>
```
- 좁은 화면에서 뱃지 텍스트가 h3와 같은 줄에 들어가지 않아 overflow·압축

**수정:**
- HTML: inline style → `.result-summary-header` class
- CSS:
  ```css
  .result-summary-header { font-size:1.6rem; font-weight:800; display:flex; align-items:center; justify-content:space-between; margin-bottom:25px; }
  /* 768px */
  .result-summary-header { flex-direction: column; align-items: flex-start; gap: 8px; font-size: 1.3rem; }
  ```

---

#### F6. `.result-box` padding 모바일 미축소

**현재:**
```css
.result-box { padding: 30px; }
```
- 768px 이하 오버라이드 없음

**수정:**
```css
/* 768px */
.result-box { padding: 20px 16px; border-radius: 18px; }
/* 480px */
.result-box { padding: 16px 12px; }
```

---

#### F7. Wizard 탭 텍스트 overflow

**현재:**
```css
.wizard-progress { display: flex; gap: 16px; }
.tab-label { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
```
- 3개 탭 (`① 기본 정보` / `② 작명 방향` / `③ 심층 분석`) 이 가로 배치
- 390px 화면에서 각 탭 ~113px → 한국어 텍스트 넘침

**수정:**
```css
/* 768px */
.wizard-progress { gap: 8px; margin-bottom: 32px; }
.tab-label { font-size: 0.72rem; letter-spacing: 0; }
/* 480px */
.tab-label { font-size: 0.68rem; }
```

---

#### F8. 프리미엄 섹션 헤드 h2 폰트·줄바꿈

**현재:**
```html
<h2 class="section-title" style="color:white; font-size:2.8rem; margin-bottom:20px;">
    우리 아이에게 꼭 맞는 이름,<br>직접 지어드립니다.
</h2>
```
- inline `font-size:2.8rem` → CSS 오버라이드 불가
- `<br>` 태그: 모바일에서 원치 않는 위치에서 줄바꿈

**수정:**
- HTML: inline `font-size` 제거 → `.section-title` CSS로 관리
- CSS `.section-title`:
  ```css
  /* 기존 전역 */
  .section-title { font-size: 2.8rem; }  /* 이미 존재하면 통합 */
  /* 768px */
  .section-title { font-size: 2rem; }
  /* 480px */
  .section-title { font-size: 1.7rem; }
  ```
- `<br>` → CSS `br.mobile-hide { display: none }` 또는 HTML에서 제거하고 CSS word-break 위임

---

### 🟡 Minor — 세부 폴리싱

#### F9. 섹션 상하 패딩 압축 (스크롤 길이)

**현재:**
```html
<section id="premium" style="padding-top:100px; padding-bottom:120px;">
```
- inline style로 고정 → 모바일에서도 동일 패딩 유지

**수정 방향:**
- HTML inline `padding-top/bottom` → CSS class 관리로 전환하거나
- 전역 `section { ... }` 모바일 오버라이드:
  ```css
  /* 768px */
  .section-inner { padding-top: 60px; padding-bottom: 70px; }
  ```
- 분석 결과: 스크롤 단축 **최대 40%** 기대 (각 섹션 160~220px → 120~130px)

---

#### F10. `#analysis-result-area` 상단 margin/padding

**현재:**
```css
#analysis-result-area { margin-top: 50px; padding-top: 50px; }
```
**수정:**
```css
/* 768px */
#analysis-result-area { margin-top: 32px; padding-top: 32px; }
```

---

#### F11. `.form-card p` (소개 문구) 모바일 폰트

**현재:**
```html
<p style="font-size:1.05rem; margin-bottom:40px;">마음에 두고 있는 이름이...</p>
```
**수정:**
- CSS:
  ```css
  /* 768px */
  .form-card > p { font-size: 0.97rem; margin-bottom: 28px; }
  ```

---

## C. 개선 계획 (우선순위별)

### Phase 4 — Critical 폼 구조 (F1~F2)
> HTML 수정 포함. 입력 폼 전체 사용 불가 수준.

| 항목 | 변경 내용 | 난이도 |
|---|---|---|
| `.birth-form-area` | HTML: 3개 `.bf-row` div로 그루핑 + CSS flex-direction:column | HTML+CSS |
| `#hanja-dropdowns` | HTML: inline style 제거 + CSS `flex-direction:column` | HTML+CSS |

### Phase 5 — Major 가독성 (F3~F8)
> CSS 위주, 일부 HTML inline style 클래스로 전환.

| 항목 | 변경 내용 |
|---|---|
| 폼 h3 타이틀 | HTML class 전환 + `768px: 1.55rem` / `480px: 1.35rem` |
| `.result-row-4` | `768px: 2열` / `480px: 1열` |
| 진단결과 헤더 h3 | HTML class 전환 + `768px: flex-direction:column` |
| `.result-box` | `768px: padding 20px 16px` / `480px: 16px 12px` |
| `.wizard-progress` | `768px: gap:8px` / `.tab-label: 0.72rem` |
| 프리미엄 h2 | HTML inline 제거 + CSS `.section-title 768px: 2rem` |

### Phase 6 — Minor 폴리싱 (F9~F11)

| 항목 | 변경 내용 |
|---|---|
| 섹션 패딩 (스크롤 압축) | `section-inner` 또는 각 section inline padding → CSS 이관 |
| `#analysis-result-area` | `768px: margin-top/padding-top: 32px` |
| `.form-card > p` | `768px: 0.97rem; margin-bottom:28px` |

---

## D. 구현 위치

| Phase | 변경 파일 | 변경 유형 | 예상 줄수 |
|---|---|---|---|
| Phase 4 | `index.html` HTML 구조 | HTML div 그루핑 2곳×3 = 6블록 | +18줄 HTML |
| Phase 4 | `index.html` CSS 768px | `.birth-form-area`, `.bf-row`, `#hanja-dropdowns` | +8줄 CSS |
| Phase 5 | `index.html` HTML inline 제거 | h3, h2, result h3 (class 전환) | HTML 수정 5곳 |
| Phase 5 | `index.html` CSS 768px+480px | F3~F8 | +14줄 CSS |
| Phase 6 | `index.html` CSS | F9~F11 | +6줄 CSS |

```
총 예상 변경: HTML 수정 ~24곳 + CSS ~28줄 추가
```

---

## E. 적용 우선순위 판단

```
Phase 4 (F1 birth-form-area) → 즉시 적용 필수
Phase 4 (F2 hanja-dropdowns) → 즉시 적용 필수
Phase 5 (F4 result-row-4) → CSS만, 즉시 가능
Phase 5 (F3, F5~F8) → 1~2일 내
Phase 6 → 여유 시
```
