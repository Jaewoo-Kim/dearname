/**
 * suites/premium/formula-fields.test.js
 * [프리미엄] claude-report.js 공식(formula) 필드 — JS 결정적 계산 함수.
 *   LLM이 생성하는 서술(prose)이 아니라, 알고리즘이 확정적으로 만드는 값만 검증한다.
 *   (프롬프트 계약 + 폴백 경계 원칙: Claude 산출물 자체는 단언하지 않음)
 *
 *   대상: _calcGuk(81수리 원형이정 4격), _getSuriData(81수 정규화),
 *         _genCareerJobs(오행→직업), _genHealthAdvice(최약 오행 건강),
 *         _genHanjaDetails/_genOneHanjaDetail(DB 확정 훈음 조립 — AI 창작 차단).
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

// ── _genHanjaDetails / _genOneHanjaDetail — DB 확정 훈음 조립 ──────────
// 2026-07 세션에서 발견된 버그(尹="미쁠", 潤="불을" 등 AI가 DB에 없는
// 훈음을 창작)의 근본 수정 대상. AI 호출 없이 h.m만으로 조립되므로,
// "meaning에 DB의 각 훈음 조각이 모두 포함되고, 그 외의 문구가 훈음
// 자리에 섞이지 않는다"를 구조적으로 보증해야 한다.
suite('[LOGIC] _genHanjaDetails — DB(h.m) 확정 훈음 조립, AI 창작 차단');
{
  // 尹 사례 재현: DB 원문 "다스릴,벼슬" — "미쁠" 등 DB에 없는 훈음이 섞이면 안 됨
  const yun = _genOneHanjaDetail({ h:'尹', kr:'윤', m:'다스릴,벼슬', s:4, o:'水' }, null);
  assert(yun.meaning.includes('다스릴') && yun.meaning.includes('벼슬'), 'DB 훈음(다스릴,벼슬)이 meaning에 그대로 포함');
  assert(!yun.meaning.includes('미쁠') && !yun.meaning.includes('미쁘'), 'DB에 없는 훈음(미쁠)은 섞이지 않음');

  // 潤 사례 재현: DB 원문 "풍부할,윤택" — "불을" 같은 창작 훈음 차단
  const yoon2 = _genOneHanjaDetail({ h:'潤', kr:'윤', m:'풍부할,윤택', s:16, o:'水' }, null);
  assert(yoon2.meaning.includes('풍부할') && yoon2.meaning.includes('윤택'), 'DB 훈음(풍부할,윤택)이 meaning에 그대로 포함');
  assert(!yoon2.meaning.includes('불을'), 'DB에 없는 훈음(불을)은 섞이지 않음');

  // 기본 필드(hanja/kr/strokes/oheng)는 입력값을 그대로 반영 (가공 없음)
  assertEq(yun.hanja, '尹', 'hanja 필드는 입력 그대로');
  assertEq(yun.strokes, 4, 'strokes 필드는 입력 그대로');
  assertEq(yun.oheng, '水', 'oheng 필드는 입력 그대로');

  // synergyWithSaju — nameSpec 기반 결정적 분기 (용신 > prefer > 희신 > avoid > 중립)
  const nameSpecYongsin = { prefer:[], avoid:[], yongsin:{ yongsinOheng:'金', heesinOheng:'土' } };
  const yongsinCase = _genOneHanjaDetail({ h:'銀', kr:'은', m:'은,화폐', s:14, o:'金' }, nameSpecYongsin);
  assert(yongsinCase.synergyWithSaju.includes('용신'), '오행이 용신과 일치하면 "용신" 언급');

  const nameSpecPrefer = { prefer:['水'], avoid:['火'], yongsin:null };
  const preferCase = _genOneHanjaDetail({ h:'河', kr:'하', m:'물,강이름', s:9, o:'水' }, nameSpecPrefer);
  assert(preferCase.synergyWithSaju.includes('보완'), 'prefer 오행 포함 시 "보완" 언급');

  const avoidCase = _genOneHanjaDetail({ h:'夏', kr:'하', m:'여름', s:10, o:'火' }, nameSpecPrefer);
  assert(avoidCase.synergyWithSaju.includes('조심'), 'avoid 오행 포함 시 "조심" 언급');

  // 성/이름 후보 통합 함수 — h1/h2 모두 반영, h2 없으면(외자) 1건만 반환
  const details2 = _genHanjaDetails({ h1:{h:'瑞',kr:'서',m:'상서,길조',s:14,o:'金'}, h2:{h:'尹',kr:'윤',m:'다스릴,벼슬',s:4,o:'水'} }, { nameSpec: nameSpecYongsin });
  assertEq(details2.length, 2, 'h1+h2 있으면 2건 반환');

  const details1 = _genHanjaDetails({ h1:{h:'勳',kr:'훈',m:'공로',s:12,o:'火'}, h2:null }, { nameSpec: null });
  assertEq(details1.length, 1, '외자(h2 없음)면 1건만 반환');
}
