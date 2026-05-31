/**
 * suites/premium/oheng-weighted.test.js
 * [프리미엄] calcOhengScores 지장간 가중 점수 + calcDaeun 대운.
 *   프리미엄은 천간 10pt + 지지 지장간 비율×60pt 의 가중 점수를 사용한다.
 *   (셀프 분석의 8자 단순 카운트와 대비 — self/oheng-count.test.js 참조)
 */

// ── calcOhengScores — 가중 오행 점수 ───────────────────────────────
suite('[SNAP] calcOhengScores — 가중 오행 점수 (프리미엄)');
{
  const raw    = calcSaju('1990-02-16','16:20',{});
  const scores = calcOhengScores(raw);
  const total  = Object.values(scores).reduce((a,b)=>a+b,0);
  assert(total >= 95 && total <= 105, `오행점수 합계 ≈100pt (got ${total.toFixed(1)})`);
  const top = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  assertEq(top[0][0],'水','1위 오행=水'); assertEq(top[1][0],'土','2위 오행=土');
}

// ── calcDaeun — 구조 및 첫 대운 ────────────────────────────────────
suite('[SNAP] calcDaeun — 구조 및 첫 대운');
{
  const CHEONGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const raw    = calcSaju('1990-02-16','16:20',{});
  const result = calcDaeun(raw,'1990-02-16','16:20','남자',{});
  assert(result !== null,'반환값 non-null');
  assert(result.cycles?.length >= 8, `사이클 8개 이상 (got ${result.cycles?.length})`);
  assert(typeof result.startAge === 'number', `startAge 숫자 (got ${result.startAge})`);
  assert(typeof result.isForward === 'boolean', `isForward 불리언 (got ${result.isForward})`);
  const first = result.cycles[0];
  assertEq(first.gan + first.ji,'丁丑','첫 대운 丁丑 [SNAP]');
  const i0=CHEONGAN.indexOf(result.cycles[0].gan);
  const i1=CHEONGAN.indexOf(result.cycles[1].gan);
  const i2=CHEONGAN.indexOf(result.cycles[2].gan);
  assert(((i1-i0+10)%10) === ((i2-i1+10)%10), `대운 천간 방향 일관됨`);
}
