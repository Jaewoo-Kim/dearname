/**
 * suites/premium/formula-fields.test.js
 * [프리미엄] claude-report.js 공식(formula) 필드 — JS 결정적 계산 함수.
 *   LLM이 생성하는 서술(prose)이 아니라, 알고리즘이 확정적으로 만드는 값만 검증한다.
 *   (프롬프트 계약 + 폴백 경계 원칙: Claude 산출물 자체는 단언하지 않음)
 *
 *   대상: _calcGuk(81수리 원형이정 4격), _getSuriData(81수 정규화),
 *         _genCareerJobs(오행→직업), _genHealthAdvice(최약 오행 건강).
 *   ※ _genSoundStory/_genFormulaFields 는 브라우저 window.getCho 의존 → 여기서 제외.
 */

// ── _calcGuk — 81수리 4격(원/형/이/정) 산출 ───────────────────────
suite('[LOGIC] _calcGuk — 81수리 4격 산출 (프리미엄)');
{
  // 이자 이름: 성 s0=3, 첫이름 h1.s=8, 끝이름 h2.s=9
  const gj = _calcGuk({ s0: 3, h1: { s: 8 }, h2: { s: 9 } });
  assertEq(gj.g1, 17, '[이자] 원격 = h1.s + h2.s = 8+9');
  assertEq(gj.g2, 11, '[이자] 형격 = s0 + h1.s = 3+8');
  assertEq(gj.g3, 12, '[이자] 이격 = s0 + h2.s = 3+9');
  assertEq(gj.g4, 20, '[이자] 정격 = s0 + h1.s + h2.s = 3+8+9');

  // 외자 이름: 성 s0=3, 이름 h1.s=8, h2 없음
  const go = _calcGuk({ s0: 3, h1: { s: 8 }, h2: null });
  assertEq(go.g1, 9,  '[외자] 원격 = h1.s + 1 = 8+1');
  assertEq(go.g2, 11, '[외자] 형격 = s0 + h1.s = 3+8');
  assertEq(go.g3, 4,  '[외자] 이격 = s0 + 1 = 3+1');
  assertEq(go.g4, 11, '[외자] 정격 = s0 + h1.s = 3+8');
}

// ── _getSuriData — 81수 정규화(81 초과 wrap / 0 → 81) ──────────────
suite('[LOGIC] _getSuriData — 81수 정규화');
{
  // SURI_DATA 미정의 컨텍스트 → 폴백 {name:`${num}수격`, grade:'평'}.
  // 정규화(wrap) 수식 자체를 검증한다.
  assertEq(_getSuriData(1).name,   '1수격',  '1 → 그대로 1');
  assertEq(_getSuriData(81).name,  '81수격', '81 → 경계 그대로 81 (>81 아님)');
  assertEq(_getSuriData(82).name,  '1수격',  '82 → 82%81 = 1');
  assertEq(_getSuriData(162).name, '81수격', '162 → 162%81=0 → 81 보정');
  assert(typeof _getSuriData(50).grade === 'string', '반환 객체에 grade(string) 존재');
}

// ── _genCareerJobs — 오행→직업 매핑 (dedupe, 최대 4개) ─────────────
suite('[LOGIC] _genCareerJobs — 오행 기반 직업 추천');
{
  // 단일 오행(水): 4개 직업
  const w = _genCareerJobs({ h1: { o: '水' }, h2: null });
  assertEq(w.length, 4, '단일 오행(水) → 4개');
  assert(w.includes('외교관·국제전문가'), '水 → 외교관·국제전문가 포함');

  // 동일 오행 2글자(木+木): 중복 제거되어 4개 (8개 아님)
  const mm = _genCareerJobs({ h1: { o: '木' }, h2: { o: '木' } });
  assertEq(mm.length, 4, '木+木 중복 제거 → 4개');
  assert(mm.includes('교육자·교사'), '木 → 교육자·교사 포함');

  // 서로 다른 오행(木+火): pool 8개지만 slice(0,4) → 4개
  const mf = _genCareerJobs({ h1: { o: '木' }, h2: { o: '火' } });
  assertEq(mf.length, 4, '木+火 → 최대 4개로 절단');
}

// ── _genHealthAdvice — 최약 오행 기반 건강 조언 ────────────────────
suite('[LOGIC] _genHealthAdvice — 최약 오행 건강 조언');
{
  // 木이 최약(5pt) → 간·담·눈 조언
  const a = _genHealthAdvice({ _scores: { 木:5, 火:30, 土:20, 金:25, 水:10 } });
  assert(a.includes('간'), '최약=木 → 간 관련 조언');

  // 水가 최약(3pt) → 신장·방광 조언
  const b = _genHealthAdvice({ _scores: { 木:20, 火:30, 土:20, 金:25, 水:3 } });
  assert(b.includes('신장'), '최약=水 → 신장 관련 조언');

  // _scores 없음 → 기본 조언 폴백
  const c = _genHealthAdvice({});
  assert(c.includes('규칙적인'), '_scores 없음 → 기본 조언 폴백');
}
