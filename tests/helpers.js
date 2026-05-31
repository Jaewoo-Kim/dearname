/**
 * tests/helpers.js
 * 공용 테스트 헬퍼 — 엔진(calcSaju 등)이 같은 컨텍스트에 먼저 로드되어 있어야 한다.
 *
 * ⚠️ var / function 선언만 사용 (framework.js 와 동일한 이유 — vm cross-file 접근).
 * 엔진 함수(calcSaju, calcOhengScores, buildNameSpec ...)는 bare name 으로 참조한다.
 *   - Node vm: 같은 context 에 로드된 function 선언은 전역 프로퍼티이므로 접근 가능
 *   - 브라우저: window 전역이므로 접근 가능
 */

// 천간/지지 → 오행 매핑 (셀프 분석: 8자 단순 카운트용)
var CG = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
var JJ = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};

// 사주 4기둥을 문자열로 반환 (raw 원본도 포함). null 이면 throw.
function saju(d, t, o) {
  var r = calcSaju(d, t, o || {});
  if (!r) throw new Error('calcSaju returned null: ' + d + ' ' + t);
  return {
    year:  r.year.gan  + r.year.ji,
    month: r.month.gan + r.month.ji,
    day:   r.day.gan   + r.day.ji,
    time:  r.time.gan  + r.time.ji,
    raw:   r
  };
}

// 8자 단순 오행 카운트 (셀프 분석 기준 — 지장간 미고려)
function count8(raw) {
  var c = {'木':0,'火':0,'土':0,'金':0,'水':0};
  [raw.year, raw.month, raw.day, raw.time].forEach(function (p) {
    if (CG[p.gan]) c[CG[p.gan]]++;
    if (JJ[p.ji])  c[JJ[p.ji]]++;
  });
  return c;
}
