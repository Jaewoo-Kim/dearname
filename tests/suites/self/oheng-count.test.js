/**
 * suites/self/oheng-count.test.js
 * [셀프 분석] 오행 8자 단순 카운트 — 지장간 미고려.
 *   셀프 분석은 천간·지지 각 글자를 1로 세는 단순 카운트를 사용한다.
 *   (프리미엄은 calcOhengScores 지장간 가중 — premium/oheng-weighted.test.js 참조)
 */

// ── 8자 단순 오행 카운트 ───────────────────────────────────────────
suite('[GOLD] 오행 8자 단순 카운트 (셀프 분석)');
{
  // 1990-02-16 16:20 → 庚午 戊寅 壬子 戊申 → 木1 火1 土2 金2 水2
  const raw = calcSaju('1990-02-16','16:20',{});
  const cnt = count8(raw);
  assertEq(cnt['木'],1,'오행카운트 木=1'); assertEq(cnt['火'],1,'오행카운트 火=1');
  assertEq(cnt['土'],2,'오행카운트 土=2'); assertEq(cnt['金'],2,'오행카운트 金=2');
  assertEq(cnt['水'],2,'오행카운트 水=2');
}

// ── 오행 분류 — 균형/편중/특수격/불균형 ────────────────────────────
suite('[LOGIC] 오행 분류 — 균형/편중/특수격/불균형');
{
  // index.html 셀프 분석 분류 로직과 동일
  function classify(cnt) {
    const vals = Object.values(cnt);
    const max  = Math.max(...vals);
    const isBalanced = !vals.some(v => v === 0);
    if (!isBalanced)              return '불균형';
    if (isBalanced && max >= 4)   return '특수격';
    if (isBalanced && max === 3)  return '편중형';
    return '균형';
  }
  assertEq(classify({木:2,火:2,土:2,金:1,水:1}), '균형',  '[A] 균형형 ({2,2,2,1,1})');
  assertEq(classify({木:1,火:2,土:3,金:1,水:1}), '편중형', '[B] 편중형 ({3,2,1,1,1})');
  assertEq(classify({木:1,火:1,土:4,金:1,水:1}), '특수격', '[C] 특수격 ({4,1,1,1,1})');
  assertEq(classify({木:0,火:2,土:3,金:1,水:2}), '불균형', '[D] 불균형 (木=0)');
  assertEq(classify({木:2,火:2,土:2,金:2,水:0}), '불균형', '[E] 불균형 (水=0)');
}
