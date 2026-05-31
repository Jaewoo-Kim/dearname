/**
 * suites/premium/namespec.test.js
 * [프리미엄] buildNameSpec 전략 판정 — 종격(從格) + 억부법(抑扶法) 용신.
 *   종격: 한 오행 ≥60pt + 극오행 <5pt → strategy:'reinforce' (강한 기운에 순응).
 *   용신: 신강/신약 판정 후 용신·희신·기신 도출.
 */

// ── 종격(從格) 분기 (동적 탐색) ─────────────────────────────────────
suite('[LOGIC] calcSajuOhengGrade — 종격(從格) 분기');
{
  function findJonggyeok(startYear) {
    const opts = { yajasi: true, apply30min: true };
    for (let yr = startYear; yr <= startYear + 5; yr++) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d++) {
          for (const h of ['02:00','10:00','22:00']) {
            const dateStr = `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const s = calcSaju(dateStr, h, opts);
            if (!s) continue;
            const sp = buildNameSpec(s, calcOhengScores(s));
            if (sp.strategy === 'reinforce') return { date: dateStr, time: h, spec: sp };
          }
        }
      }
    }
    return null;
  }

  const found = findJonggyeok(1930);

  assertCond(found !== null, '[A] 종격 사주 탐색 성공 (strategy=reinforce 확인)');

  if (found) {
    const { date: JD, time: JT, spec: JSP } = found;
    const opts = { yajasi: true, apply30min: true };
    const JDom  = JSP.prefer[0];
    const JCtrl = JSP.avoid[0];
    const SUP_MAP = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
    const JSup  = SUP_MAP[JDom];

    assertEq(calcSajuOhengGrade([JDom], JD, JT, opts).grade, '매우 좋음',
      `[B] 종격(${JD}) + 지배오행[${JDom}] → 매우 좋음`);

    assertEq(calcSajuOhengGrade([JCtrl], JD, JT, opts).grade, '나쁨',
      `[C] 종격(${JD}) + 극오행[${JCtrl}] → 나쁨`);

    assertEq(calcSajuOhengGrade([JSup], JD, JT, opts).grade, '매우 좋음',
      `[D] 종격(${JD}) + 수호오행[${JSup}] → 매우 좋음`);

    const descE = calcSajuOhengGrade([JDom], JD, JT, opts).desc;
    assertCond(descE.includes('종격'), '[E] desc에 "종격" 문구 포함');
  } else {
    ['B','C','D','E'].forEach(id => assertCond(false, `[${id}] 종격 탐색 실패 SKIP`));
  }
}

// ── 억부법(抑扶法) 용신 ────────────────────────────────────────────
suite('[LOGIC] calcYongsin — 억부법(抑扶法) 용신');
{
  function makeSajuForYs(dayGan) {
    return { day:{gan:dayGan,ji:'子'}, year:{gan:'甲',ji:'子'}, month:{gan:'丁',ji:'巳'}, time:{gan:'甲',ji:'子'} };
  }

  // 일간 甲(木): 인성=水, 비겁=木, 식상=火, 재성=土, 관살=金

  // [A] 신강: 인비(60) >> 식재관(15) → isGangShin
  const _sgScores = {'木':30,'水':30,'火':5,'土':5,'金':5};
  const _sgYs = calcYongsin(makeSajuForYs('甲'), _sgScores);
  assertCond(_sgYs?.isGangShin === true, '[A] 신강 판정 (인비 60 > 식재관 15×1.2=18)');

  // [B] 신강 → 용신=식상(火)
  assertEq(_sgYs?.yongsinOheng, '火', '[B] 신강 → 용신=식상(火) (식재관 동점시 식상 우선)');

  // [C] 신약: 식재관(75) >> 인비(10) → isYakShin
  const _skScores = {'木':5,'水':5,'火':25,'土':25,'金':25};
  const _skYs = calcYongsin(makeSajuForYs('甲'), _skScores);
  assertCond(_skYs?.isYakShin === true, '[C] 신약 판정 (식재관 75 > 인비 10×1.2=12)');

  // [D] 신약 → 용신=인성(水)
  assertEq(_skYs?.yongsinOheng, '水', '[D] 신약 → 용신=인성(水) (인비 동점시 인성 우선)');

  // [E] 중화 → yongsinOheng null
  const _chScores = {'木':10,'水':15,'火':10,'土':10,'金':5};
  const _chYs = calcYongsin(makeSajuForYs('甲'), _chScores);
  assertCond(_chYs?.yongsinOheng === null, '[E] 중화(인비 25 ≈ 식재관 25) → 용신 없음(null)');

  // [F] buildNameSpec 반환값에 yongsin 필드 포함
  const _rawF = calcSaju('1990-02-16','16:20',{});
  const _scF  = calcOhengScores(_rawF);
  const _nsF  = buildNameSpec(_rawF, _scF);
  assertCond('yongsin' in _nsF, '[F] buildNameSpec 반환값에 yongsin 필드 포함');
}
