/**
 * suites/self/pronunciation.test.js
 * [셀프] 발음(소리) 분석 순수 모듈(NameFormula) 검증.
 *   index.html·worker 가 사용하던 초성→오행, 중성→음양, 상생 판별,
 *   발음오행 등급 로직을 lib/name-formula.js 로 추출 → 단일 진실 공급원.
 *   이 suite 는 그 순수 모듈의 계산 정확성을 고정한다.
 */

suite('[LOGIC] NameFormula.getCho — 음절 → 초성');
{
  assertEq(NameFormula.getCho('김'), 'ㄱ', "'김' 초성 = ㄱ");
  assertEq(NameFormula.getCho('서'), 'ㅅ', "'서' 초성 = ㅅ");
  assertEq(NameFormula.getCho('연'), 'ㅇ', "'연' 초성 = ㅇ");
  assertEq(NameFormula.getCho('빠'), 'ㅃ', "'빠' 초성 = ㅃ (쌍자음)");
  assertEq(NameFormula.getCho('A'), '',   "한글 아님 → 빈 문자열");
}

suite('[LOGIC] NameFormula.getOhengFromCho — 초성 → 발음오행');
{
  // 木: ㄱㅋㄲ / 火: ㄴㄷㄹㅌㄸ / 土: ㅇㅎ / 金: ㅅㅈㅊㅆㅉ / 水: ㅁㅂㅍㅃ
  assertEq(NameFormula.getOhengFromCho('ㄱ'), '木', 'ㄱ → 木');
  assertEq(NameFormula.getOhengFromCho('ㅋ'), '木', 'ㅋ → 木');
  assertEq(NameFormula.getOhengFromCho('ㄷ'), '火', 'ㄷ → 火');
  assertEq(NameFormula.getOhengFromCho('ㄹ'), '火', 'ㄹ → 火');
  assertEq(NameFormula.getOhengFromCho('ㅇ'), '土', 'ㅇ → 土');
  assertEq(NameFormula.getOhengFromCho('ㅎ'), '土', 'ㅎ → 土');
  assertEq(NameFormula.getOhengFromCho('ㅅ'), '金', 'ㅅ → 金');
  assertEq(NameFormula.getOhengFromCho('ㅈ'), '金', 'ㅈ → 金');
  assertEq(NameFormula.getOhengFromCho('ㅁ'), '水', 'ㅁ → 水');
  assertEq(NameFormula.getOhengFromCho('ㅍ'), '水', 'ㅍ → 水');
  assertEq(NameFormula.getOhengFromCho(''),   '',   '빈 초성 → 빈 오행');
}

suite('[LOGIC] NameFormula.getChoOheng — 음절 → 발음오행 (결합)');
{
  assertEq(NameFormula.getChoOheng('김'), '木', "'김'(ㄱ) → 木");
  assertEq(NameFormula.getChoOheng('서'), '金', "'서'(ㅅ) → 金");
  assertEq(NameFormula.getChoOheng('연'), '土', "'연'(ㅇ) → 土");
  assertEq(NameFormula.getChoOheng('민'), '水', "'민'(ㅁ) → 水");
}

suite('[LOGIC] NameFormula.isSangsaeng — 오행 상생/비화 판별');
{
  // 상생 순환: 木→火→土→金→水→木
  assertCond(NameFormula.isSangsaeng('木', '火'), '木→火 상생');
  assertCond(NameFormula.isSangsaeng('火', '土'), '火→土 상생');
  assertCond(NameFormula.isSangsaeng('水', '木'), '水→木 상생 (순환 wrap)');
  assertCond(NameFormula.isSangsaeng('火', '木'), '火→木 역방향도 상생 인정');
  assertCond(NameFormula.isSangsaeng('土', '土'), '土=土 비화(같은 기운) → 상생 간주');
  // 상극: 木↔土, 火↔金, 土↔水, 金↔木, 水↔火
  assertCond(!NameFormula.isSangsaeng('木', '土'), '木↔土 상극 (상생 아님)');
  assertCond(!NameFormula.isSangsaeng('水', '火'), '水↔火 상극 (상생 아님)');
  assertCond(!NameFormula.isSangsaeng('木', '金'), '木↔金 상극 (상생 아님)');
}

suite('[LOGIC] NameFormula.getYinYangFromJung — 중성 → 음양');
{
  // 양: ㅏㅑㅗㅛㅐㅒㅘㅙㅚ
  assertEq(NameFormula.getYinYangFromJung('가'), '양', "'가'(ㅏ) → 양");
  assertEq(NameFormula.getYinYangFromJung('교'), '양', "'교'(ㅛ) → 양");
  assertEq(NameFormula.getYinYangFromJung('과'), '양', "'과'(ㅘ) → 양");
  // 음: 그 외 (ㅓㅕㅜㅠㅡㅣ 등)
  assertEq(NameFormula.getYinYangFromJung('거'), '음', "'거'(ㅓ) → 음");
  assertEq(NameFormula.getYinYangFromJung('구'), '음', "'구'(ㅜ) → 음");
  assertEq(NameFormula.getYinYangFromJung('그'), '음', "'그'(ㅡ) → 음");
  assertEq(NameFormula.getYinYangFromJung('Z'),  '',   '한글 아님 → 빈 문자열');
}

suite('[LOGIC] NameFormula.gradePronunciation — 발음오행 등급');
{
  // '김서연': ㄱ(木)→ㅅ(金)→ㅇ(土)
  //   木↔金 상극(bad), 金↔土 상생(ok) → badCount=1, total=2 → 1*2<=2 → '좋음'
  const r1 = NameFormula.gradePronunciation('김서연');
  assertEq(r1.grade, '좋음', "'김서연' → 좋음 (badCount=1/total=2)");
  assertEq(r1.badCount, 1, "'김서연' badCount=1");
  assertEq(r1.total, 2, "'김서연' total=2");
  assertEq(r1.ohengs.join(''), '木金土', "'김서연' 오행 연쇄 = 木金土");

  // 전부 상생: '강하나' ㄱ(木)→ㅎ(土)?  木↔土 상극이므로 부적합. 상생 예: '나라' ㄴ(火)→ㄹ(火) 비화
  //   '도라지' ㄷ(火)→ㄹ(火)→ㅈ(金): 火=火 ok, 火↔金 상극 bad → badCount=1/total=2 → 좋음
  const r2 = NameFormula.gradePronunciation('나라');
  assertEq(r2.grade, '매우 좋음', "'나라'(火→火 비화) → 매우 좋음 (badCount=0)");
  assertEq(r2.badCount, 0, "'나라' badCount=0");

  // 단일 음절: total=0, badCount=0 → '매우 좋음'
  const r3 = NameFormula.gradePronunciation('김');
  assertEq(r3.grade, '매우 좋음', '단일 음절 → 매우 좋음 (연쇄 없음)');
  assertEq(r3.total, 0, '단일 음절 total=0');

  // 전부 상극: '강문' ㄱ(木)→ㅁ(水): 木↔水는 상생(水→木)! → 부적합
  //   '가미' ㄱ(木)→ㅁ(水) 동일 상생. 木↔土 상극 쌍 활용: '구해' ㄱ(木)→ㅎ(土) 상극
  //   '구해': badCount=1/total=1 → badCount===total → '매우 나쁨'
  const r4 = NameFormula.gradePronunciation('구해');
  assertEq(r4.grade, '매우 나쁨', "'구해'(木↔土 상극) → 매우 나쁨 (badCount===total)");
  assertEq(r4.badCount, 1, "'구해' badCount=1");
}
