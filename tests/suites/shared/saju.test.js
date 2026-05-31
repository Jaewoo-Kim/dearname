/**
 * suites/shared/saju.test.js
 * [공통] calcSaju 만세력 엔진 — 프리미엄·셀프 두 제품이 공유하는 기반 로직
 *   입춘·절기 경계, 야자시, 지방시 30분 보정, 도시 보정, 표준시(+30),
 *   서머타임(-60), 만세력 범위 검증.
 */

// ── GOLD: 엔진 검증 케이스 & 실사용 회귀 ─────────────────────────────
suite('[GOLD] 엔진 검증 케이스 & 실사용 회귀');
{
  // 출처: saju-engine.js 헤더 주석
  const x = saju('2025-03-25','16:29');
  assertEq(x.year,'乙巳','연주'); assertEq(x.month,'己卯','월주');
  assertEq(x.day,'癸巳','일주'); assertEq(x.time,'庚申','시주');
}
{
  // 1990-02-16 16:20 — 사용자 보고 회귀 케이스 (strongList8 스코프 버그)
  const x = saju('1990-02-16','16:20');
  assertEq(x.year,'庚午','연주'); assertEq(x.month,'戊寅','월주');
  assertEq(x.day,'壬子','일주'); assertEq(x.time,'戊申','시주');
}

// ── 입춘 경계 — 연주 전환 ──────────────────────────────────────────
suite('[LOGIC] 입춘 경계 — 연주 전환');
{
  assertEq(saju('1990-02-04','11:00').year,'己巳','入春 직전(adjH=10) → 己巳년');
  assertEq(saju('1990-02-04','12:00').year,'庚午','入春 직후(adjH=11,adjMin=28) → 庚午년');
  assertEq(saju('2025-02-03','23:41').year,'甲辰','2025 入春 직전(adjMin=9) → 甲辰년');
  assertEq(saju('2025-02-03','23:43').year,'乙巳','2025 入春 직후(adjMin=11) → 乙巳년');
}

// ── 절기 경계 — 월주 전환 ──────────────────────────────────────────
suite('[LOGIC] 절기 경계 — 월주 전환');
{
  // 경칩(2025) = j['3'] = 3/5 17:07  /  KST 17:06 adjH=16(前) / 17:40 adjH=17(後)
  assertEq(saju('2025-03-05','17:06').month,'戊寅','경칩 직전(adjH=16) 월주 戊寅');
  assertEq(saju('2025-03-05','17:40').month,'己卯','경칩 직후(adjH=17,adjMin=28) 월주 己卯');
}

// ── 야자시 — 시주 일간 전환 ─────────────────────────────────────────
suite('[LOGIC] 야자시 — 시주 일간 전환');
{
  assertEq(saju('2025-03-26','00:30',{yajasi:true}).time,'甲子','야자시 ON  → 甲子');
  assertEq(saju('2025-03-26','00:30',{yajasi:false}).time,'壬子','야자시 OFF → 壬子');
  assert(saju('2025-03-26','00:30',{yajasi:true}).day === saju('2025-03-26','00:30',{yajasi:false}).day,
    '야자시 ON/OFF 일주 동일');
  assertEq(saju('2025-03-25','22:59',{yajasi:true,apply30min:false}).time,'癸亥','22:59 → 亥시 癸亥');
  assertEq(saju('2025-03-25','23:00',{yajasi:true,apply30min:false}).time,'甲子','23:00 → 야자시 甲子');
}

// ── 지방시 30분 보정 on/off ────────────────────────────────────────
suite('[LOGIC] 지방시 30분 보정 on/off');
{
  // 15:10 KST: 보정ON → adjH=14 未시 丁未 / 보정OFF → adjH=15 申시 戊申
  assertEq(saju('1990-02-16','15:10',{apply30min:true}).time,'丁未','apply30min=true  → 未시 丁未');
  assertEq(saju('1990-02-16','15:10',{apply30min:false}).time,'戊申','apply30min=false → 申시 戊申');
}

// ── 도시 보정 — 서울 vs 독도 ───────────────────────────────────────
suite('[LOGIC] 도시 보정 — 서울 vs 독도');
{
  assertEq(saju('2025-03-25','23:30',{city:'서울'}).time,'癸亥','서울(adjH=22) → 亥시 癸亥');
  assertEq(saju('2025-03-25','23:30',{city:'독도'}).time,'甲子','독도(adjH=23) → 야자시 甲子');
}

// ── 표준시 보정 +30분 (1954~1961) ──────────────────────────────────
suite('[LOGIC] 표준시 보정 +30분 (1954~1961)');
{
  const inPeriod  = saju('1958-06-15','01:31').time;
  const outPeriod = saju('1962-06-15','01:31').time;
  assert(inPeriod !== outPeriod, `보정 기간 내/외 시주 달라야 함 (${inPeriod} vs ${outPeriod})`);
  const x = saju('1958-06-15','14:00');
  assertEq(x.year,'戊戌','연주 戊戌'); assertEq(x.month,'戊午','월주 戊午');
  assertEq(x.day,'癸亥','일주 癸亥');  assertEq(x.time,'戊午','시주 戊午 [SNAP]');
}

// ── 서머타임 -60분 (1955 하절기) ───────────────────────────────────
suite('[LOGIC] 서머타임 -60분 (1955 하절기)');
{
  assert(saju('1955-07-01','14:00').time.endsWith('午'),'서머타임 적용 中: 午시');
  assert(saju('1955-10-01','14:00').time.endsWith('未'),'서머타임 종료 後: 未시');
  const x = saju('1955-07-01','14:00');
  assertEq(x.year,'乙未','연주 乙未'); assertEq(x.month,'壬午','월주 壬午');
  assertEq(x.day,'癸亥','일주 癸亥'); assertEq(x.time,'戊午','시주 戊午 [SNAP]');
}

// ── 만세력 범위 외 연도 — null 반환 ────────────────────────────────
suite('[LOGIC] 만세력 범위 외 연도 — null 반환');
{
  assert(calcSaju('1920-01-01','12:00',{}) === null,'1920년 → null');
  assert(calcSaju('2041-01-01','12:00',{}) === null,'2041년 → null');
  assert(calcSaju('1921-01-06','12:00',{}) !== null,'1921년 → 정상 반환');
  assert(calcSaju('2040-12-25','12:00',{}) !== null,'2040년 → 정상 반환');
}
