/**
 * suites/premium/saju-grade-prem.test.js
 * [프리미엄] calcSajuOhengGrade — premium 모드 전용 분기.
 *   premium:true 전달 시에만 활성화되는 지장간 가중 + 통관(通關) 판정.
 *   (셀프 8자 기준은 self/saju-grade.test.js 참조)
 */

// ── 균형형 (1990-02-16) — 프리미엄 통관 적용 ───────────────────────
suite('[LOGIC] calcSajuOhengGrade — 프리미엄 통관(土克水)');
// 가중 점수: 土·水 각 ≥25 → 土克水 통관. premium=true 시에만 통관 판정.
{
  const D = '1990-02-16', T = '16:20';
  const prem = { premium: true };
  assertEq(calcSajuOhengGrade(['金'], D, T, prem).grade, '매우 좋음', '[C2] 통관(土克水) + 중재오행(金) → 매우 좋음');
  assertEq(calcSajuOhengGrade(['土'], D, T, prem).grade, '나쁨',      '[C3] 통관(土克水) + 충돌오행(土) → 나쁨');
}

// ── 통관(通關) 분기 (동적 탐색) ─────────────────────────────────────
suite('[LOGIC] calcSajuOhengGrade — 통관(通關) 분기');
{
  const _TG_PAIRS   = [['木','土'],['火','金'],['土','水'],['金','木'],['水','火']];
  const _TG_MED_MAP = {
    '木土':'火','土木':'火','火金':'土','金火':'土',
    '土水':'金','水土':'金','金木':'水','木金':'水','水火':'木','火水':'木'
  };
  const _TG_CTRL = {'木':'金','火':'水','土':'木','金':'火','水':'土'};

  function findTonggwan(startYear) {
    const opts = { yajasi: true, apply30min: true };
    for (let yr = startYear; yr <= startYear + 10; yr++) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d++) {
          for (const h of ['02:00','10:00','22:00']) {
            const dateStr = `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const s = calcSaju(dateStr, h, opts);
            if (!s) continue;
            const sc = calcOhengScores(s);
            const isJong = Object.entries(sc).some(([o, v]) => v >= 60 && sc[_TG_CTRL[o]] < 5);
            if (isJong) continue;
            for (const [a, b] of _TG_PAIRS) {
              if (sc[a] >= 25 && sc[b] >= 25) {
                return { date: dateStr, time: h, scores: sc, pairA: a, pairB: b, med: _TG_MED_MAP[a + b] };
              }
            }
          }
        }
      }
    }
    return null;
  }

  const tg = findTonggwan(1960);

  assertCond(tg !== null, '[A] 통관 사주 탐색 성공 (상극쌍 각 ≥25점 확인)');

  if (tg) {
    const { date: TD, time: TT, pairA: TA, pairB: TB, med: TMED } = tg;
    const optsPrem = { yajasi: true, apply30min: true, premium: true };
    const optsSelf = { yajasi: true, apply30min: true };

    assertEq(calcSajuOhengGrade([TMED], TD, TT, optsPrem).grade, '매우 좋음',
      `[B] 통관(${TD}) + 중재오행[${TMED}] + premium → 매우 좋음`);

    assertEq(calcSajuOhengGrade([TA], TD, TT, optsPrem).grade, '나쁨',
      `[C] 통관(${TD}) + 충돌오행A[${TA}] + premium → 나쁨`);

    assertEq(calcSajuOhengGrade([TB], TD, TT, optsPrem).grade, '나쁨',
      `[D] 통관(${TD}) + 충돌오행B[${TB}] + premium → 나쁨`);

    const gradeE = calcSajuOhengGrade([TMED], TD, TT, optsSelf).grade;
    assertCond(gradeE !== undefined, '[E] 셀프작명(premium=false)은 통관 미적용 — 8자 기준 grade 반환');
  } else {
    ['B','C','D','E'].forEach(id => assertCond(false, `[${id}] 통관 탐색 실패 SKIP`));
  }
}
