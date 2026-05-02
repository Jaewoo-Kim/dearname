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
