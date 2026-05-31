/**
 * suites/self/saju-grade.test.js
 * [셀프 분석] calcSajuOhengGrade — 기본(default) 모드, 8자 카운트 기준 등급.
 *   premium 옵션 미전달 → 통관/지장간 가중 미적용, 순수 8자 균형 판정.
 *   (프리미엄 통관 분기는 premium/saju-grade-prem.test.js 참조)
 */

// 8자 카운트용 매핑 (불균형 탐색에 사용)
const _CG = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const _JJ = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};

// ── 특수 입력 처리 ─────────────────────────────────────────────────
suite('[LOGIC] calcSajuOhengGrade — 특수 입력 처리');
{
  const rA = calcSajuOhengGrade(['木','火'], '', '12:00', {});
  assertEq(rA.grade, '나쁨', '[A] 날짜없음 → grade 나쁨');
  assert(rA.desc.includes('출생일시를 입력'), '[A] 날짜없음 → desc 안내 포함');

  const rB = calcSajuOhengGrade(['木'], '1920-01-01', '12:00', {});
  assertEq(rB.grade, '나쁨', '[B] 범위밖 → grade 나쁨');
  assert(rB.desc.includes('1921') && rB.desc.includes('2040'), '[B] 범위밖 → desc 연도범위 언급');
}

// ── 균형형 (1990-02-16 16:20) — 셀프 8자 기준 ──────────────────────
suite('[LOGIC] calcSajuOhengGrade — 균형형 (셀프 8자기준)');
// 8자: 木1 火1 土2 金2 水2 / avg=1.6 (relWeak: 木·火 / relStrong: 土·金·水)
{
  const D = '1990-02-16', T = '16:20';
  assertEq(calcSajuOhengGrade(['木'], D, T, {}).grade, '매우 좋음', '[C] 셀프 약한오행(木) → 매우 좋음');
  assertEq(calcSajuOhengGrade(['土'], D, T, {}).grade, '나쁨',      '[D] 셀프 강한오행(土) → 나쁨');
  assertEq(calcSajuOhengGrade(['木','土'], D, T, {}).grade, '좋음', '[E] 셀프 약+강 혼합 → 좋음');
}

// ── 편중형 (2000-03-01 22:00) ──────────────────────────────────────
suite('[LOGIC] calcSajuOhengGrade — 편중형 (2000-03-01 22:00)');
// 庚辰 戊寅 戊午 癸亥 → 木1 火1 土3 金1 水2 / relWeak:木,火,金 / relStrong:土,水 / domSet:土
{
  const D = '2000-03-01', T = '22:00';
  assertEq(calcSajuOhengGrade(['土'], D, T, {}).grade, '나쁨',      '[F] 편중형 지배오행강화 → 나쁨 강등');
  assertEq(calcSajuOhengGrade(['木'], D, T, {}).grade, '매우 좋음', '[G] 편중형 약한오행보충 → 매우 좋음');
  assertEq(calcSajuOhengGrade(['水'], D, T, {}).grade, '나쁨',      '[H] 편중형 relStrong(非지배,水) → 나쁨 [SNAP]');
}

// ── 특수격 (2000-03-01 02:00) ──────────────────────────────────────
suite('[SNAP] calcSajuOhengGrade — 특수격 (2000-03-01 02:00)');
// 庚辰 戊寅 戊午 癸丑 → 木1 火1 土4 金1 水1 / relWeak:木,火,金,水 / relStrong:土 / domSet:土
{
  const D = '2000-03-01', T = '02:00';
  assertEq(calcSajuOhengGrade(['土'], D, T, {}).grade, '나쁨',      '[I] 특수격 지배오행강화 → 나쁨 [SNAP]');
  assertEq(calcSajuOhengGrade(['木'], D, T, {}).grade, '매우 좋음', '[J] 특수격 약한오행보충 → 매우 좋음 [SNAP]');
}

// ── 불균형형 (동적 탐색) ───────────────────────────────────────────
suite('[LOGIC] calcSajuOhengGrade — 불균형형');
{
  let _dateU = null, _timeU = null, _weakU = null;
  for (let d = 8; d <= 31 && !_weakU; d++) {
    const dt = `2000-08-${String(d).padStart(2,'0')}`;
    for (const h of ['02:00','10:00','14:00','22:00']) {
      if (_weakU) break;
      try {
        const r = calcSaju(dt, h, {});
        if (!r) continue;
        const c = {'木':0,'火':0,'土':0,'金':0,'水':0};
        for (const p of [r.year, r.month, r.day, r.time]) {
          if (_CG[p.gan]) c[_CG[p.gan]]++;
          if (_JJ[p.ji])  c[_JJ[p.ji]]++;
        }
        const w = Object.entries(c).filter(([,v]) => v === 0).map(([o]) => o);
        if (w.length > 0) { _dateU = dt; _timeU = h; _weakU = w; }
      } catch(e) {}
    }
  }
  assert(_weakU && _weakU.length > 0, `불균형 날짜 탐색 성공 (발견: ${_dateU} ${_timeU})`);
  if (_weakU && _weakU.length > 0) {
    assertEq(calcSajuOhengGrade(_weakU, _dateU, _timeU, {}).grade, '매우 좋음', '불균형 — 전부보완 → 매우 좋음');
    if (_weakU.length >= 2) {
      assertEq(calcSajuOhengGrade([_weakU[0]], _dateU, _timeU, {}).grade, '좋음', '불균형 — 부분보완 → 좋음');
    }
    const _nonWeak = ['木','火','土','金','水'].filter(o => !_weakU.includes(o))[0];
    if (_nonWeak) {
      assertEq(calcSajuOhengGrade([_nonWeak], _dateU, _timeU, {}).grade, '나쁨', '불균형 — 보완없음 → 나쁨');
    }
  }
}
