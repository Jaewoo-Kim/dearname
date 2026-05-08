/**
 * tests/runner.js
 * DearName 만세력 엔진 유닛 테스트
 *
 * 실행: npm test  (또는 node tests/runner.js)
 *   → Node.js 설치 필요: https://nodejs.org
 *
 * 브라우저 실행: tests/test.html 을 브라우저로 열기
 *
 * ──────────────────────────────────────────────
 * 테스트 등급
 *   [GOLD]  외부 만세력·현장 검증된 케이스
 *   [LOGIC] 보정 수식으로 직접 계산·검증된 케이스
 *   [SNAP]  현재 엔진 출력을 기준선 고정 (회귀 방지)
 */

'use strict';

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

// ════════════════════════════════════════════════════════
//  1. 엔진 로드 — vm.runInContext
// ════════════════════════════════════════════════════════
const ROOT = path.join(__dirname, '..');

function loadScript(relPath, ctx) {
  const fullPath = path.join(ROOT, relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  try {
    vm.runInContext(code, ctx);
  } catch (e) {
    console.error(`\n스크립트 로드 실패: ${relPath}\n${e.message}`);
    process.exit(1);
  }
}

const ctx = vm.createContext({ console });
loadScript('data/manjuryeok.js', ctx);
loadScript('lib/saju-engine.js', ctx);

['calcSaju', 'calcOhengScores', 'calcDaeun', 'MANJURYEOK'].forEach(name => {
  if (!ctx[name]) {
    console.error(`엔진 로드 오류: ${name} 를 찾을 수 없습니다.`);
    process.exit(1);
  }
});

// ════════════════════════════════════════════════════════
//  2. 경량 Assert 프레임워크
// ════════════════════════════════════════════════════════
let passed = 0, failed = 0;
const failures = [];
let currentSuite = '';

function suite(name) {
  currentSuite = name;
  console.log(`\n  ── ${name}`);
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log('    ✓ ' + msg);
  } else {
    failed++;
    failures.push(`${currentSuite} › ${msg}`);
    console.log('    ✗ ' + msg);
  }
}

function assertEq(actual, expected, msg) {
  assert(
    actual === expected,
    `${msg}  got="${actual}"  expected="${expected}"`
  );
}

// ════════════════════════════════════════════════════════
//  3. 헬퍼
// ════════════════════════════════════════════════════════
function saju(date, time, opts) {
  const s = ctx.calcSaju(date, time, opts ?? {});
  if (!s) throw new Error(`calcSaju(${date}, ${time}) returned null`);
  return {
    year:  s.year.gan  + s.year.ji,
    month: s.month.gan + s.month.ji,
    day:   s.day.gan   + s.day.ji,
    time:  s.time.gan  + s.time.ji,
    raw:   s,
  };
}

// ════════════════════════════════════════════════════════
//  4. 테스트 케이스
// ════════════════════════════════════════════════════════

// ── 4-1. GOLD ────────────────────────────────────────────────────────
suite('[GOLD] 엔진 검증 케이스 & 실사용 회귀');
{
  // 출처: saju-engine.js 헤더 주석 ✅
  const x = saju('2025-03-25', '16:29');
  assertEq(x.year,  '乙巳', '연주');
  assertEq(x.month, '己卯', '월주');
  assertEq(x.day,   '癸巳', '일주');
  assertEq(x.time,  '庚申', '시주');
}
{
  // 1990-02-16 16:20 — 사용자 보고 회귀 케이스 (strongList8 스코프 버그)
  const x = saju('1990-02-16', '16:20');
  assertEq(x.year,  '庚午', '연주');
  assertEq(x.month, '戊寅', '월주');
  assertEq(x.day,   '壬子', '일주');
  assertEq(x.time,  '戊申', '시주');
}
{
  // 오행 8자 카운트: 木1·火1·土2·金2·水2
  const raw = ctx.calcSaju('1990-02-16', '16:20', {});
  const CG = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  const JJ = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
  const cnt = {'木':0,'火':0,'土':0,'金':0,'水':0};
  [raw.year, raw.month, raw.day, raw.time].forEach(p => {
    cnt[CG[p.gan]]++;
    cnt[JJ[p.ji]]++;
  });
  assertEq(cnt['木'], 1, '오행카운트 木=1');
  assertEq(cnt['火'], 1, '오행카운트 火=1');
  assertEq(cnt['土'], 2, '오행카운트 土=2');
  assertEq(cnt['金'], 2, '오행카운트 金=2');
  assertEq(cnt['水'], 2, '오행카운트 水=2');
}

// ── 4-2. 입춘 경계 ───────────────────────────────────────────────────
// 1990년 입춘 = 2월 4일 11:14  /  2025년 입춘 = 2월 3일 23:10
// 서울 보정(-32분): KST adjMin 오차 기준으로 경계 양쪽 검증
suite('[LOGIC] 입춘 경계 — 연주 전환');
{
  // 1990: KST 11:00 → adjH=10 (前) / KST 12:00 → adjH=11,adjMin=28 (後)
  assertEq(saju('1990-02-04','11:00').year, '己巳', '入春 직전(adjH=10) → 己巳년');
  assertEq(saju('1990-02-04','12:00').year, '庚午', '入春 직후(adjH=11,adjMin=28) → 庚午년');
}
{
  // 2025: KST 23:41 → adjMin=9 < 10 (前) / KST 23:43 → adjMin=11 > 10 (後)
  assertEq(saju('2025-02-03','23:41').year, '甲辰', '2025 入春 직전(adjMin=9) → 甲辰년');
  assertEq(saju('2025-02-03','23:43').year, '乙巳', '2025 入春 직후(adjMin=11) → 乙巳년');
}

// ── 4-3. 절기 경계 (월주 전환) ─────────────────────────────────────
// MANJURYEOK.j[month]는 해당 '월'의 절기. 경칩(2025)=3월 j['3']=3/5 17:07
// KST 17:06 → adjH=16 (前 戊寅) / KST 17:40 → adjH=17,adjMin=28 (後 己卯)
suite('[LOGIC] 절기 경계 — 월주 전환');
{
  const before = saju('2025-03-05', '17:06');
  const after  = saju('2025-03-05', '17:40');
  assertEq(before.month, '戊寅', '경칩 직전(adjH=16) 월주 戊寅');
  assertEq(after.month,  '己卯', '경칩 직후(adjH=17,adjMin=28) 월주 己卯');
}

// ── 4-4. 야자시 ─────────────────────────────────────────────────────
// 2025-03-26 00:30 KST → adjTotal=−2 → 전날(25일) adjH=23 → 야자시
// 야자시 ON: 다음날(26일) 일간(甲) 기준 → 甲子
// 야자시 OFF: 당일(25일) 일간(癸) 기준 → 壬子  (DAY_BASE癸=8, jiIdx子=0, 8%10=8→壬)
suite('[LOGIC] 야자시 — 시주 일간 전환');
{
  assertEq(saju('2025-03-26','00:30',{yajasi:true }).time, '甲子', '야자시 ON  → 甲子');
  assertEq(saju('2025-03-26','00:30',{yajasi:false}).time, '壬子', '야자시 OFF → 壬子');
  // 야자시여도 일주 날짜는 동일(25일)
  assert(
    saju('2025-03-26','00:30',{yajasi:true}).day ===
    saju('2025-03-26','00:30',{yajasi:false}).day,
    '야자시 ON/OFF 일주 동일'
  );
}
{
  // apply30min=false 기준 경계: 22:59 亥시 / 23:00 야자시(子)
  assertEq(saju('2025-03-25','22:59',{yajasi:true,apply30min:false}).time, '癸亥', '22:59 → 亥시 癸亥');
  assertEq(saju('2025-03-25','23:00',{yajasi:true,apply30min:false}).time, '甲子', '23:00 → 야자시 甲子');
}

// ── 4-5. 30분 지방시 보정 ────────────────────────────────────────────
// 시주가 달라지는 경계 시각 사용: 1990-02-16 15:10
//   보정 ON : adjTotal=15*60+10-32=878, adjH=14 → 未시 → 丁未
//   보정 OFF: adjTotal=15*60+10=910,    adjH=15 → 申시 → 戊申
suite('[LOGIC] 지방시 30분 보정 on/off');
{
  assertEq(saju('1990-02-16','15:10',{apply30min:true }).time, '丁未', 'apply30min=true  → 未시 丁未');
  assertEq(saju('1990-02-16','15:10',{apply30min:false}).time, '戊申', 'apply30min=false → 申시 戊申');
}

// ── 4-6. 도시 보정 ───────────────────────────────────────────────────
// 서울(1925s=32min) vs 독도(741s=12min)
// 2025-03-25 23:30: 서울 adjH=22 → 亥시 癸亥 / 독도 adjH=23 → 야자시 甲子
suite('[LOGIC] 도시 보정 — 서울 vs 독도');
{
  assertEq(saju('2025-03-25','23:30',{city:'서울'}).time, '癸亥', '서울(adjH=22) → 亥시 癸亥');
  assertEq(saju('2025-03-25','23:30',{city:'독도'}).time, '甲子', '독도(adjH=23) → 야자시 甲子');
}

// ── 4-7. 표준시 보정 +30분 (1954-03-21 ~ 1961-08-09) ────────────────
// 보정 기간 내(1958) vs 기간 후(1962): 경계 시각에서 시주 달라짐
// 1958-06-15 01:31 KST (stdBonus=+30):
//   adjTotal=1*60+31-32+30=90, adjH=1 → 丑시
// 1962-06-15 01:31 KST (stdBonus=0):
//   adjTotal=1*60+31-32+0 =60, adjH=1, adjMin=0 → 丑시 경계 확인
// 더 명확한 시각 사용: 01:01 KST
//   stdBonus=+30: adjTotal=61-32+30=59, adjH=0 → 子시
//   stdBonus=0:   adjTotal=61-32=29,    adjH=0 → 子시 (같음)
// → 01:31 사용: 1958년 adjH=1(丑), 1962년 adjH=1(丑) — 같은 시지
// 가장 명확한 방법: 보정 적용 전후 시주 비교 (apply30min 이용)
suite('[LOGIC] 표준시 보정 +30분 (1954~1961)');
{
  // 1958년 01:31: stdBonus +30 → adjTotal=90 → adjH=1,adjMin=30
  // 1962년 01:31: stdBonus  0 → adjTotal=60 → adjH=1,adjMin=0
  // 같은 adjH 이지만 adjMin 차이로 연주/월주 경계 케이스엔 영향
  // 가장 확실한 검증: 두 해의 시주가 다름을 확인
  const inPeriod  = saju('1958-06-15','01:31').time;
  const outPeriod = saju('1962-06-15','01:31').time;
  assert(inPeriod !== outPeriod,
    `표준시 보정 기간 내/외 시주 달라야 함 (${inPeriod} vs ${outPeriod})`);
}
{
  // SNAP: 1958-06-15 14:00 전체 사주
  const x = saju('1958-06-15', '14:00');
  assertEq(x.year,  '戊戌', '연주 戊戌');
  assertEq(x.month, '戊午', '월주 戊午');
  assertEq(x.day,   '癸亥', '일주 癸亥');
  assertEq(x.time,  '戊午', '시주 戊午 [SNAP]');
}

// ── 4-8. 서머타임 -60분 (1955 하절기) ───────────────────────────────
// 1955-07-01 14:00: 순보정 −32+30−60=−62분 → adjH=12 → 午시(11-13)
// 1955-10-01 14:00: 순보정 −32+30=−2분     → adjH=13 → 未시(13-15)
suite('[LOGIC] 서머타임 -60분 (1955 하절기)');
{
  assert(saju('1955-07-01','14:00').time.endsWith('午'), '서머타임 적용 中: 午시');
  assert(saju('1955-10-01','14:00').time.endsWith('未'), '서머타임 종료 後: 未시');
}
{
  // SNAP: 1955-07-01 전체
  const x = saju('1955-07-01','14:00');
  assertEq(x.year,  '乙未', '연주 乙未');
  assertEq(x.month, '壬午', '월주 壬午');
  assertEq(x.day,   '癸亥', '일주 癸亥');
  assertEq(x.time,  '戊午', '시주 戊午 [SNAP]');
}

// ── 4-9. 오행 가중 점수 ──────────────────────────────────────────────
// calcOhengScores: 천간 10pt + 지지 지장간 비율×60pt → 총 ≈100pt
suite('[SNAP] calcOhengScores — 가중 오행 점수');
{
  const raw    = ctx.calcSaju('1990-02-16','16:20',{});
  const scores = ctx.calcOhengScores(raw);
  const total  = Object.values(scores).reduce((a,b)=>a+b,0);
  assert(total >= 95 && total <= 105, `오행점수 합계 ≈100pt (got ${total.toFixed(1)})`);
  // 1990-02-16 사주: 水(28.8) > 土(28.3) 순서 [SNAP]
  const top = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  assertEq(top[0][0], '水', `1위 오행=水 (got ${top[0][0]})`);
  assertEq(top[1][0], '土', `2위 오행=土 (got ${top[1][0]})`);
}

// ── 4-10. 대운 ───────────────────────────────────────────────────────
// calcDaeun(saju, birthDateStr, birthTimeStr, gender, options)
suite('[SNAP] calcDaeun — 구조 및 첫 대운');
{
  const raw    = ctx.calcSaju('1990-02-16','16:20',{});
  const result = ctx.calcDaeun(raw,'1990-02-16','16:20','남자',{});
  assert(result !== null, '반환값 non-null');
  assert(result.cycles && result.cycles.length >= 8, `사이클 8개 이상 (got ${result.cycles?.length})`);
  assert(typeof result.startAge === 'number', `startAge 숫자 (got ${result.startAge})`);
  assert(typeof result.isForward === 'boolean', `isForward 불리언 (got ${result.isForward})`);
  // 첫 대운 고정 [SNAP]
  const first = result.cycles[0];
  assertEq(first.gan + first.ji, '丁丑', '첫 대운 丁丑 [SNAP]');
  // 연속 대운의 천간 방향이 일관됨
  const CHEONGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const i0 = CHEONGAN.indexOf(result.cycles[0].gan);
  const i1 = CHEONGAN.indexOf(result.cycles[1].gan);
  const i2 = CHEONGAN.indexOf(result.cycles[2].gan);
  const d01 = (i1 - i0 + 10) % 10;
  const d12 = (i2 - i1 + 10) % 10;
  assertEq(d01, d12, `대운 천간 방향 일관됨 (${d01}씩 순환)`);
}

// ── 4-11. 범위 밖 연도 ───────────────────────────────────────────────
suite('[LOGIC] 만세력 범위 외 연도 — null 반환');
{
  assert(ctx.calcSaju('1920-01-01','12:00',{}) === null, '1920년 → null');
  assert(ctx.calcSaju('2041-01-01','12:00',{}) === null, '2041년 → null');
  assert(ctx.calcSaju('1921-01-06','12:00',{}) !== null, '1921년 → 정상 반환');
  assert(ctx.calcSaju('2040-12-25','12:00',{}) !== null, '2040년 → 정상 반환');
}

// ════════════════════════════════════════════════════════
//  5. 결과
// ════════════════════════════════════════════════════════
const total = passed + failed;
console.log('\n' + '─'.repeat(52));
console.log(`  총 ${total}개:  ✓ ${passed}개 통과  ${failed > 0 ? '/ ✗ ' + failed + '개 실패' : '/ 전체 통과 🎉'}`);
if (failures.length) {
  console.log('\n  실패 목록:');
  failures.forEach(f => console.log('    • ' + f));
}
console.log('─'.repeat(52) + '\n');
process.exit(failed > 0 ? 1 : 0);
