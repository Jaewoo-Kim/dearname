/**
 * suites/premium/name-score.test.js
 * [프리미엄] NameScore.scoreCombo — 이름 후보 채점 순수 모듈 검증.
 *   name-search-worker.js 가 내장하던 _scoreCombo(컴포넌트 A~K + 하드필터)를
 *   lib/name-score.js 로 추출 → deps 주입으로 결정적(deterministic) 테스트.
 *
 *   SURI_DATA 를 Proxy 로 주입해 4격 등급을 고정하고(전부 '길' → suri +65),
 *   각 컴포넌트를 baseline 대비 delta 로 검증한다.
 */

// 모든 격 번호 → 동일 등급을 반환하는 SURI_DATA 목(mock)
function _suriAll(grade) {
  return new Proxy({}, { get: () => ({ grade }) });
}
function _deps(grade, extra) {
  return Object.assign({ SURI_DATA: _suriAll(grade || '길') }, extra || {});
}

suite('[LOGIC] NameScore.scoreCombo — baseline 정확 산출 (두 글자)');
{
  // family 남(火)·서(金)·연(土) / prefer=[金] / SURI 전부 '길'
  const family = { kr: '남', hanja: '南', strokes: 9 };  // 南: 非분파
  const combo  = {
    h1: { s: 8, kr: '서', h: '瑞', o: '金' },
    h2: { s: 9, kr: '연', h: '玟', o: '土' },             // 玟: 非분파
    s0: 9, isOija: false
  };
  const nameSpec = { prefer: ['金'], avoid: [] };
  const state    = { constraints: {} };

  // [A] 金 충족 +50, prefer 전부충족 +30 = 80
  // [B] g=[17,17,18,26] 전부 '길' → 15+15+15+20 = 65
  // [C] 火→金 상극(-10) + 金→土 상생(+10) = 0
  // [D] strokes[9,8,9] → 양·음·양 혼재 +10
  // [E] 남(ㅏ양)·서(ㅓ음)·연(ㅕ음) 혼재 +5
  // [L] 수리오행 g=[17,17,18,26] → 金·金·金·土 인접 전부 상생 → +15
  // 합계 = 80+65+0+10+5+15 = 175
  const score = NameScore.scoreCombo(combo, nameSpec, family, state, _deps('길'));
  assertEq(score, 175, '두 글자 baseline = 175 (A80+B65+C0+D10+E5+L15)');
}

suite('[LOGIC] NameScore.scoreCombo — [A] 자원오행 prefer delta');
{
  // 상한(200) 회피: 획수 전부 홀수([D]=0) + 음절 전부 양([E]=0)
  const family = { kr: '남', hanja: '南', strokes: 9 };
  const base   = { h1:{s:9,kr:'사',h:'瑞',o:'金'}, h2:{s:9,kr:'자',h:'玟',o:'土'}, s0:9, isOija:false };
  const state  = { constraints: {} };

  const s1 = NameScore.scoreCombo(base, { prefer:['金'] },     family, state, _deps('길'));
  const s2 = NameScore.scoreCombo(base, { prefer:['金','土'] }, family, state, _deps('길'));
  // prefer 2개 모두 충족: +50 추가 (전부충족 보너스 30은 두 경우 모두 적용)
  assertEq(s2 - s1, 50, 'prefer 2개 모두 충족 시 +50 (土 추가 가점)');

  const s3 = NameScore.scoreCombo(base, { prefer:['水'] }, family, state, _deps('길'));
  // 水 미충족: [A]=0 (전부충족 보너스도 없음) → baseline보다 80 낮음
  assertEq(s1 - s3, 80, 'prefer 미충족 시 [A] 가점 80 전부 소멸');
}

suite('[LOGIC] NameScore.scoreCombo — [B] 81수리 하드필터');
{
  const family = { kr: '남', hanja: '南', strokes: 9 };
  const combo  = { h1:{s:8,kr:'서',h:'瑞',o:'金'}, h2:{s:9,kr:'연',h:'玟',o:'土'}, s0:9, isOija:false };
  const spec   = { prefer:['金'] };
  const state  = { constraints: {} };

  // 어느 격이든 '대흉'이면 -999
  const daehyung = { SURI_DATA: _suriAll('대흉') };
  assertEq(NameScore.scoreCombo(combo, spec, family, state, daehyung), -999, '대흉 포함 → -999 하드탈락');

  // 정격(말년, grades[3])이 '평'이면 -999  (g4=26만 평, 나머지 길)
  const jungPyeong = { SURI_DATA: new Proxy({}, { get: (_,k)=>({ grade: Number(k)===26 ? '평' : '길' }) }) };
  assertEq(NameScore.scoreCombo(combo, spec, family, state, jungPyeong), -999, '정격 평 → -999 하드탈락');

  // 정격이 '흉'이어도 -999
  const jungHyung = { SURI_DATA: new Proxy({}, { get: (_,k)=>({ grade: Number(k)===26 ? '흉' : '길' }) }) };
  assertEq(NameScore.scoreCombo(combo, spec, family, state, jungHyung), -999, '정격 흉 → -999 하드탈락');

  // 4격 전부 '대길' → 올클 보너스 +30 포함 (suri = 25+25+25+35 +30 = 140)
  const allDae = NameScore.scoreCombo(combo, spec, family, state, _deps('대길'));
  // [A]80 + suri140 + [C]0 + [D]10 + [E]5 = 235 → cap 200
  assertEq(allDae, 200, '4격 전부 대길 → 점수 상한 200 적용');
}

suite('[LOGIC] NameScore.scoreCombo — [분파] 하드필터');
{
  const state = { constraints: {} };
  const spec  = { prefer: [] };
  // 성+이름 전부 분파 구조 한자(朴·林·安) → -999
  const allBunpa = {
    h1: { s:8, kr:'가', h:'林', o:'木' },
    h2: { s:6, kr:'나', h:'安', o:'土' },
    s0: 6, isOija: false
  };
  const famBunpa = { kr:'박', hanja:'朴', strokes:6 };
  assertEq(NameScore.scoreCombo(allBunpa, spec, famBunpa, state, _deps('길')), -999,
    '성+이름 전부 분파(朴林安) → -999');

  // 한 글자라도 非분파면 통과 (h1 을 非분파 瑞 로 교체)
  const oneSafe = { ...allBunpa, h1:{ s:8, kr:'가', h:'瑞', o:'木' } };
  assertCond(NameScore.scoreCombo(oneSafe, spec, famBunpa, state, _deps('길')) > -999,
    '한 글자라도 非분파(瑞)면 분파필터 통과');
}

suite('[LOGIC] NameScore.scoreCombo — [C] 발음오행 상생/상극');
{
  const state = { constraints: {} };
  const spec  = { prefer: [] };  // [A]=0 으로 격리
  const dep   = _deps('길');     // suri 고정 +65 (두글자)

  // 외자로 단일 pair 격리: family→h1 한 쌍만
  // 木→火 상생(+10):  강(ㄱ木)·나(ㄴ火)
  const sangsaeng = NameScore.scoreCombo(
    { h1:{s:8,kr:'나',h:'奈',o:'火'}, h2:null, s0:11, isOija:true },
    spec, { kr:'강', hanja:'康', strokes:11 }, state, dep);
  // 木→金 상극(-10): 강(ㄱ木)·소(ㅅ金)
  const sangg = NameScore.scoreCombo(
    { h1:{s:8,kr:'소',h:'素',o:'金'}, h2:null, s0:11, isOija:true },
    spec, { kr:'강', hanja:'康', strokes:11 }, state, dep);
  // 두 경우 [D]/[E] 동일(아래 확인) → 차이는 [C] 상생(+10) vs 상극(-10) = 20
  assertEq(sangsaeng - sangg, 20, '발음 상생(+10) vs 상극(-10) → 차이 20');
}

suite('[LOGIC] NameScore.scoreCombo — [F] 성향 보너스 / [J] 동음 패널티');
{
  const family = { kr:'남', hanja:'南', strokes:9 };
  const combo  = { h1:{s:8,kr:'서',h:'瑞',o:'金'}, h2:{s:9,kr:'연',h:'玟',o:'土'}, s0:9, isOija:false };
  const spec   = { prefer:['金'] };

  const noTrait = NameScore.scoreCombo(combo, spec, family, { constraints:{} }, _deps('길'));
  // trait 1 = ['金','火']: 金 매칭 → +3
  const withTrait = NameScore.scoreCombo(combo, spec, family, { constraints:{ traits:[1] } }, _deps('길'));
  assertEq(withTrait - noTrait, 3, '[F] 성향 1(金 매칭) → +3');

  // [J] 성=이름첫글자 동음 → -30
  // 격리: 두 성씨 모두 초성 ㅅ(金)·중성 음 → [C]/[E]/[B] 동일, 차이는 [J]뿐
  //   h1.kr='서'.  성 '서'(동음) vs 성 '시'(비동음), 둘 다 金·음, 획수 9 동일
  const h1Seo = { h1:{ s:8, kr:'서', h:'瑞', o:'金' }, h2:{ s:9, kr:'연', h:'玟', o:'土' }, s0:9, isOija:false };
  const famSeo = { kr:'서', hanja:'徐', strokes:9 };   // 성=이름첫글자 동음
  const famSi  = { kr:'시', hanja:'施', strokes:9 };   // 비동음 (ㅅ金·ㅣ음 동일)
  const dupScore = NameScore.scoreCombo(h1Seo, spec, famSeo, { constraints:{} }, _deps('길'));
  const noDup    = NameScore.scoreCombo(h1Seo, spec, famSi,  { constraints:{} }, _deps('길'));
  assertEq(dupScore - noDup, -30, '[J] 성=이름첫글자 동음 → 정확히 -30');
}

suite('[LOGIC] NameScore.scoreCombo — [K] 현대성/구식 음절 보정');
{
  const family = { kr:'남', hanja:'南', strokes:9 };
  const combo  = { h1:{s:8,kr:'서',h:'瑞',o:'金'}, h2:{s:9,kr:'연',h:'玟',o:'土'}, s0:9, isOija:false };
  const spec   = { prefer:['金'] };

  // MODERN: 서=100, 연=60 → avg 80 → +Math.round(80/20)=+4
  const modern = NameScore.scoreCombo(combo, spec, family, { constraints:{} },
    _deps('길', { MODERN_SYLLABLE_SCORE: { '서':100, '연':60 } }));
  const base = NameScore.scoreCombo(combo, spec, family, { constraints:{} }, _deps('길'));
  assertEq(modern - base, 4, '[K] 현대 인기음절 평균 80 → +4');

  // OLDFASHIONED: 서·연 모두 구식 → -3 -3 = -6
  const old = NameScore.scoreCombo(combo, spec, family, { constraints:{} },
    _deps('길', { OLDFASHIONED_SET: new Set(['서','연']) }));
  assertEq(old - base, -6, '[K] 구식 음절 2개 → -6');
}

suite('[LOGIC] NameScore.scoreCombo — 외자(1글자) 경로');
{
  const family = { kr:'강', hanja:'康', strokes:11 };
  const combo  = { h1:{s:8,kr:'나',h:'奈',o:'火'}, h2:null, s0:11, isOija:true };
  const spec   = { prefer:['火'] };
  const state  = { constraints: {} };

  // [A] 火 +50, 전부충족 +30 = 80
  // [B] 외자 격: g1=s1+1=9, g2=s0+s1=19, g3=s0+1=12, g4=s0+s1=19 → 전부 '길' = 65
  // [C] 강(木)→나(火) 상생 +10
  // [D] strokes[11,8] 양·음 혼재 +10
  // [E] 강(ㅏ양)·나(ㅏ양) 모두 양 → 음양 쏠림 -30
  // [L] 수리오행 g=[9,19,12,19] → 水·水·木·水 인접 전부 상생 → +15
  // 합계 = 80+65+10+10-30+15 = 150
  const score = NameScore.scoreCombo(combo, spec, family, state, _deps('길'));
  assertEq(score, 150, '외자 baseline = 150 (A80+B65+C10+D10+E-30+L15)');
}
