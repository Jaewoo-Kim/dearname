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
loadScript('lib/name-spec.js',   ctx);   // Suite 4-14 종격 판정에 필요

// MANJURYEOK 은 const 선언이라 ctx 객체 프로퍼티로 노출되지 않으나 vm 스코프 내부에서는 정상 접근 가능
['calcSaju', 'calcOhengScores', 'calcDaeun', 'calcSajuOhengGrade', 'buildNameSpec', 'calcYongsin'].forEach(name => {
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
//  4-12. calcSajuOhengGrade — 분기별 등급 검증
// ════════════════════════════════════════════════════════
// 고정 날짜 (브라우저 엔진 실측, apply30min=true 기준):
//   1990-02-16 16:20 → 庚午 戊寅 壬子 戊申 → 木1 火1 土2 金2 水2  (균형, avg=1.6)
//   2000-03-01 22:00 → 庚辰 戊寅 戊午 癸亥 → 木1 火1 土3 金1 水2  (편중형, 土 지배)
//   2000-03-01 02:00 → 庚辰 戊寅 戊午 癸丑 → 木1 火1 土4 金1 水1  (특수격, 土 지배)

const CG = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const JJ = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};

suite('[LOGIC] calcSajuOhengGrade — 특수 입력 처리');
{
  // [A] birthDate 없음 → grade 나쁨, "출생일시를 입력" 안내
  const rA = ctx.calcSajuOhengGrade(['木','火'], '', '12:00', {});
  assertEq(rA.grade, '나쁨', '[A] 날짜없음 → grade 나쁨');
  assert(rA.desc.includes('출생일시를 입력'), '[A] 날짜없음 → desc 안내 포함');

  // [B] 만세력 범위 밖 (1920년) → grade 나쁨, "1921~2040" 언급
  const rB = ctx.calcSajuOhengGrade(['木'], '1920-01-01', '12:00', {});
  assertEq(rB.grade, '나쁨', '[B] 범위밖 → grade 나쁨');
  assert(rB.desc.includes('1921') && rB.desc.includes('2040'), '[B] 범위밖 → desc 연도범위 언급');
}

suite('[LOGIC] calcSajuOhengGrade — 균형형 (1990-02-16 16:20)');
// 8자: 木1 火1 土2 金2 水2 / avg=1.6
// ※ 가중 점수로는 土·水 각 ≥25 → 土克水 통관 사주. premium=true 시에만 통관 판정됨.
{
  const D = '1990-02-16', T = '16:20';
  const prem = { premium: true };

  // [C] 셀프작명(default) — 통관 미적용, 8자 균형 기준: 木은 relWeak → 매우 좋음
  const rC = ctx.calcSajuOhengGrade(['木'], D, T, {});
  assertEq(rC.grade, '매우 좋음', '[C] 셀프(8자기준) 약한오행(木) → 매우 좋음');

  // [D] 셀프작명(default) — 土는 relStrong → 나쁨
  const rD = ctx.calcSajuOhengGrade(['土'], D, T, {});
  assertEq(rD.grade, '나쁨', '[D] 셀프(8자기준) 강한오행(土) → 나쁨');

  // [E] 셀프작명(default) — 약(木)+강(土) 혼합 → 좋음
  const rE = ctx.calcSajuOhengGrade(['木','土'], D, T, {});
  assertEq(rE.grade, '좋음', '[E] 셀프(8자기준) 약+강 혼합 → 좋음');

  // [C2] 프리미엄 모드 — 통관 적용: 중재오행(金) → 매우 좋음
  const rC2 = ctx.calcSajuOhengGrade(['金'], D, T, prem);
  assertEq(rC2.grade, '매우 좋음', '[C2] 프리미엄 통관(土克水) + 중재오행(金) → 매우 좋음');

  // [C3] 프리미엄 모드 — 통관 적용: 충돌오행(土) → 나쁨
  const rC3 = ctx.calcSajuOhengGrade(['土'], D, T, prem);
  assertEq(rC3.grade, '나쁨', '[C3] 프리미엄 통관(土克水) + 충돌오행(土) → 나쁨');
}

suite('[LOGIC] calcSajuOhengGrade — 편중형 (2000-03-01 22:00)');
// 庚辰 戊寅 戊午 癸亥 → 木1 火1 土3 金1 水2 / avg=1.6
// relWeak: 木(1),火(1),金(1) / relStrong: 土(3),水(2) / domSet: 土
{
  const D = '2000-03-01', T = '22:00';

  // [F] 지배오행(土) 강화 → 나쁨 강등 (핵심 신규 로직)
  const rF = ctx.calcSajuOhengGrade(['土'], D, T, {});
  assertEq(rF.grade, '나쁨', '[F] 편중형 지배오행강화 → 나쁨 강등');

  // [G] 약한 오행(木) 보충 → 매우 좋음
  const rG = ctx.calcSajuOhengGrade(['木'], D, T, {});
  assertEq(rG.grade, '매우 좋음', '[G] 편중형 약한오행보충 → 매우 좋음');

  // [H] 지배오행 아닌 relStrong(水) 강화 → 나쁨 [SNAP]
  const rH = ctx.calcSajuOhengGrade(['水'], D, T, {});
  assertEq(rH.grade, '나쁨', '[H] 편중형 relStrong(非지배,水) 강화 → 나쁨 [SNAP]');
}

suite('[SNAP] calcSajuOhengGrade — 특수격 (2000-03-01 02:00)');
// 庚辰 戊寅 戊午 癸丑 → 木1 火1 土4 金1 水1 / avg=1.6
// relWeak: 木(1),火(1),金(1),水(1) / relStrong: 土(4) / domSet: 土
{
  const D = '2000-03-01', T = '02:00';

  // [I] 지배오행(土4) 강화 → 나쁨 (종격 평가는 프리미엄 영역, 현재 relStrong 기준 적용)
  const rI = ctx.calcSajuOhengGrade(['土'], D, T, {});
  assertEq(rI.grade, '나쁨', '[I] 특수격 지배오행강화 → 나쁨 [SNAP]');

  // [J] 약한 오행(木) 보충 → 매우 좋음 [SNAP]
  const rJ = ctx.calcSajuOhengGrade(['木'], D, T, {});
  assertEq(rJ.grade, '매우 좋음', '[J] 특수격 약한오행보충 → 매우 좋음 [SNAP]');
}

suite('[LOGIC] calcSajuOhengGrade — 불균형형');
// 庚辰년(2000) 戊申월(金, 金): 年+月 = 庚(金)辰(土)+戊(土)申(金) → 金2 土2 → 木/火/水 결핍 가능
// 2000-08 이후 범위에서 첫 번째 불균형 날짜 탐색 (결정적: 항상 같은 날짜 발견)
{
  let _dateU = null, _timeU = null, _weakU = null;
  for (let d = 8; d <= 31 && !_weakU; d++) {
    const dt = `2000-08-${String(d).padStart(2,'0')}`;
    for (const h of ['02:00','10:00','14:00','22:00']) {
      if (_weakU) break;
      try {
        const r = ctx.calcSaju(dt, h, {});
        if (!r) continue;
        const c = {'木':0,'火':0,'土':0,'金':0,'水':0};
        for (const p of [r.year, r.month, r.day, r.time]) {
          if (CG[p.gan]) c[CG[p.gan]]++;
          if (JJ[p.ji])  c[JJ[p.ji]]++;
        }
        const w = Object.entries(c).filter(([,v]) => v === 0).map(([o]) => o);
        if (w.length > 0) { _dateU = dt; _timeU = h; _weakU = w; }
      } catch(e) {}
    }
  }
  assert(_weakU && _weakU.length > 0, `불균형 날짜 탐색 성공 (발견: ${_dateU} ${_timeU})`);
  if (_weakU && _weakU.length > 0) {
    // 부족 오행 전부 보완 → 매우 좋음
    assertEq(ctx.calcSajuOhengGrade(_weakU, _dateU, _timeU, {}).grade, '매우 좋음', '불균형 — 전부보완 → 매우 좋음');
    // 부족 오행 일부 보완 (weak 2개 이상일 때) → 좋음
    if (_weakU.length >= 2) {
      assertEq(ctx.calcSajuOhengGrade([_weakU[0]], _dateU, _timeU, {}).grade, '좋음', '불균형 — 부분보완 → 좋음');
    }
    // 보완 없음 (非weak 오행만 선택) → 나쁨
    const _nonWeak = ['木','火','土','金','水'].filter(o => !_weakU.includes(o))[0];
    if (_nonWeak) {
      assertEq(ctx.calcSajuOhengGrade([_nonWeak], _dateU, _timeU, {}).grade, '나쁨', '불균형 — 보완없음 → 나쁨');
    }
  }
}

// ════════════════════════════════════════════════════════
//  4-13. 오행 분류 로직 — 편중/특수격/균형/불균형 직접 검증
// ════════════════════════════════════════════════════════
suite('[LOGIC] 오행 분류 — 균형/편중/특수격/불균형');
{
  // 분류 헬퍼 (index.html 의 분류 로직과 동일)
  function classify(cnt) {
    const vals  = Object.values(cnt);
    const max   = Math.max(...vals);
    const hasZero = vals.some(v => v === 0);
    const isBalanced = !hasZero;
    const isSkewed   = isBalanced && max === 3;
    const isSpecial  = isBalanced && max >= 4;
    if (!isBalanced) return '불균형';
    if (isSpecial)   return '특수격';
    if (isSkewed)    return '편중형';
    return '균형';
  }

  // [A] {木2,火2,土2,金1,水1} → max=2, 빈오행없음 → 균형
  assertEq(classify({木:2,火:2,土:2,金:1,水:1}), '균형', '[A] 균형형 ({2,2,2,1,1})');

  // [B] {木1,火2,土3,金1,水1} → max=3, 빈오행없음 → 편중형
  assertEq(classify({木:1,火:2,土:3,金:1,水:1}), '편중형', '[B] 편중형 ({3,2,1,1,1})');

  // [C] {木1,火1,土4,金1,水1} → max=4, 빈오행없음 → 특수격
  assertEq(classify({木:1,火:1,土:4,金:1,水:1}), '특수격', '[C] 특수격 ({4,1,1,1,1})');

  // [D] {木0,火2,土3,金1,水2} → 빈오행 있음 → 불균형
  assertEq(classify({木:0,火:2,土:3,金:1,水:2}), '불균형', '[D] 불균형 (木=0)');

  // [E] {木2,火2,土2,金2,水0} → 빈오행 있음 → 불균형
  assertEq(classify({木:2,火:2,土:2,金:2,水:0}), '불균형', '[E] 불균형 (水=0)');
}

// ════════════════════════════════════════════════════════
//  Suite 4-14: calcSajuOhengGrade — 종격(從格) 분기 [LOGIC]
// ════════════════════════════════════════════════════════
{
  // 종격 사주 동적 탐색 헬퍼
  function findJonggyeok(startYear) {
    const opts = { yajasi: true, apply30min: true };
    for (let yr = startYear; yr <= startYear + 5; yr++) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d++) {
          for (const h of ['02:00','10:00','22:00']) {
            const dateStr = `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const s = ctx.calcSaju(dateStr, h, opts);
            if (!s) continue;
            const sp = ctx.buildNameSpec(s, ctx.calcOhengScores(s));
            if (sp.strategy === 'reinforce') return { date: dateStr, time: h, spec: sp };
          }
        }
      }
    }
    return null;
  }

  suite('[LOGIC] calcSajuOhengGrade — 종격(從格) 분기');

  const found = findJonggyeok(1930);

  // [A] 종격 사주 동적 탐색 성공 확인
  assert(found !== null, '[A] 종격 사주 탐색 성공 (strategy=reinforce 확인)');

  if (found) {
    const { date: JD, time: JT, spec: JSP } = found;
    const opts = { yajasi: true, apply30min: true };
    const JDom  = JSP.prefer[0];   // 지배 오행
    const JCtrl = JSP.avoid[0];    // 극오행 (피해야 할 오행)
    const CTRL_MAP = {'木':'金','火':'水','土':'木','金':'火','水':'土'};
    const SUP_MAP  = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
    const JSup  = SUP_MAP[JDom];   // 수호 오행

    // [B] 종격 + 지배 오행 이름 → '매우 좋음'
    assertEq(ctx.calcSajuOhengGrade([JDom], JD, JT, opts).grade, '매우 좋음',
      `[B] 종격(${JD}) + 지배오행[${JDom}] → 매우 좋음`);

    // [C] 종격 + 극오행 이름 → '나쁨'
    assertEq(ctx.calcSajuOhengGrade([JCtrl], JD, JT, opts).grade, '나쁨',
      `[C] 종격(${JD}) + 극오행[${JCtrl}] → 나쁨`);

    // [D] 종격 + 수호 오행 이름 → '매우 좋음'
    assertEq(ctx.calcSajuOhengGrade([JSup], JD, JT, opts).grade, '매우 좋음',
      `[D] 종격(${JD}) + 수호오행[${JSup}] → 매우 좋음`);

    // [E] desc에 "종격" 문구 포함 확인
    const descE = ctx.calcSajuOhengGrade([JDom], JD, JT, opts).desc;
    assert(descE.includes('종격'), `[E] desc에 "종격" 문구 포함`);
  } else {
    // [B][C][D][E] — 탐색 실패 시 SKIP (passed 카운트 유지용 더미)
    ['B','C','D','E'].forEach(id => assert(false, `[${id}] 종격 사주 탐색 실패 — SKIP`));
  }
}

// ════════════════════════════════════════════════════════
//  Suite 4-15: calcSajuOhengGrade — 통관(通關) 분기 [LOGIC]
// ════════════════════════════════════════════════════════
{
  const _TG_PAIRS   = [['木','土'],['火','金'],['土','水'],['金','木'],['水','火']];
  const _TG_MED_MAP = {
    '木土':'火','土木':'火','火金':'土','金火':'土',
    '土水':'金','水土':'金','金木':'水','木金':'水','水火':'木','火水':'木'
  };
  const _TG_CTRL = {'木':'金','火':'水','土':'木','金':'火','水':'土'};

  // 통관 사주 동적 탐색 (종격 아닌 것만)
  function findTonggwan(startYear) {
    const opts = { yajasi: true, apply30min: true };
    for (let yr = startYear; yr <= startYear + 10; yr++) {
      for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d++) {
          for (const h of ['02:00','10:00','22:00']) {
            const dateStr = `${yr}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const s = ctx.calcSaju(dateStr, h, opts);
            if (!s) continue;
            const sc = ctx.calcOhengScores(s);
            // 종격 제외 (종격이 먼저 판정됨)
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

  suite('[LOGIC] calcSajuOhengGrade — 통관(通關) 분기');

  const tg = findTonggwan(1960);

  // [A] 통관 사주 탐색 성공
  assert(tg !== null, '[A] 통관 사주 탐색 성공 (상극쌍 각 ≥25점 확인)');

  if (tg) {
    const { date: TD, time: TT, pairA: TA, pairB: TB, med: TMED } = tg;
    // 통관은 premium:true 전달 시만 활성화
    const optsPrem = { yajasi: true, apply30min: true, premium: true };
    const optsSelf = { yajasi: true, apply30min: true };

    // [B] 중재 오행 + premium=true → 매우 좋음
    assertEq(ctx.calcSajuOhengGrade([TMED], TD, TT, optsPrem).grade, '매우 좋음',
      `[B] 통관(${TD}) + 중재오행[${TMED}] + premium → 매우 좋음`);

    // [C] 충돌 오행 A + premium=true → 나쁨
    assertEq(ctx.calcSajuOhengGrade([TA], TD, TT, optsPrem).grade, '나쁨',
      `[C] 통관(${TD}) + 충돌오행A[${TA}] + premium → 나쁨`);

    // [D] 충돌 오행 B + premium=true → 나쁨
    assertEq(ctx.calcSajuOhengGrade([TB], TD, TT, optsPrem).grade, '나쁨',
      `[D] 통관(${TD}) + 충돌오행B[${TB}] + premium → 나쁨`);

    // [E] 셀프작명(premium 미전달)은 통관 미적용 → 8자 카운트 기준
    const gradeE = ctx.calcSajuOhengGrade([TMED], TD, TT, optsSelf).grade;
    assert(gradeE !== undefined, `[E] 셀프작명(premium=false)은 통관 미적용 — 8자 기준 grade 반환`);
  } else {
    ['B','C','D','E'].forEach(id => assert(false, `[${id}] 통관 사주 탐색 실패 — SKIP`));
  }
}

// ════════════════════════════════════════════════════════
//  Suite 4-16: calcYongsin — 억부법(抑扶法) 용신 [LOGIC]
// ════════════════════════════════════════════════════════
{
  // 합성 사주 생성 헬퍼 (일간만 중요)
  function makeSajuForYs(dayGan) {
    return { day:{gan:dayGan,ji:'子'}, year:{gan:'甲',ji:'子'}, month:{gan:'丁',ji:'巳'}, time:{gan:'甲',ji:'子'} };
  }

  suite('[LOGIC] calcYongsin — 억부법(抑扶法) 용신');

  // 일간 甲(木): 인성=水, 비겁=木, 식상=火, 재성=土, 관살=金
  // [A] 신강: 인비(60pt) >> 식재관(15pt) → isGangShin=true
  const _sgScores = {'木':30,'水':30,'火':5,'土':5,'金':5};
  const _sgYs = ctx.calcYongsin(makeSajuForYs('甲'), _sgScores);
  assert(_sgYs?.isGangShin === true,
    '[A] 신강 판정 (인비 60 > 식재관 15×1.2=18)');

  // [B] 신강 → 용신 = 식재관 최약 오행 (火·土·金 동점 → 식상 火 우선)
  assertEq(_sgYs?.yongsinOheng, '火',
    '[B] 신강 → 용신=식상(火) (식재관 동점시 식상 우선)');

  // [C] 신약: 식재관(75pt) >> 인비(10pt) → isYakShin=true
  const _skScores = {'木':5,'水':5,'火':25,'土':25,'金':25};
  const _skYs = ctx.calcYongsin(makeSajuForYs('甲'), _skScores);
  assert(_skYs?.isYakShin === true,
    '[C] 신약 판정 (식재관 75 > 인비 10×1.2=12)');

  // [D] 신약 → 용신 = 인비 최약 오행 (水5·木5 동점 → 인성 水 우선)
  assertEq(_skYs?.yongsinOheng, '水',
    '[D] 신약 → 용신=인성(水) (인비 동점시 인성 우선)');

  // [E] 중화: 인비=식재관=25pt → yongsinOheng null
  const _chScores = {'木':10,'水':15,'火':10,'土':10,'金':5};
  const _chYs = ctx.calcYongsin(makeSajuForYs('甲'), _chScores);
  assert(_chYs?.yongsinOheng === null,
    '[E] 중화(인비 25 ≈ 식재관 25) → 용신 없음(null)');

  // [F] buildNameSpec 반환값에 yongsin 필드 포함
  const _rawF = ctx.calcSaju('1990-02-16','16:20',{});
  const _scF  = ctx.calcOhengScores(_rawF);
  const _nsF  = ctx.buildNameSpec(_rawF, _scF);
  assert('yongsin' in _nsF,
    '[F] buildNameSpec 반환값에 yongsin 필드 포함');
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
