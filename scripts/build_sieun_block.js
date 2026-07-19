// scripts/build_sieun_block.js — 최시은 3옵션 JS 블록 생성 (_sieun.json + 손글 프로즈)
'use strict';
const fs = require('fs');
const path = require('path');
const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '_sieun.json'), 'utf8'));

const SAJU_CORE = '丙午년 甲午월 丁丑일 甲辰시 — 한여름 정오 무렵의 정화(丁火) 일간';
const SAJU_BASE = '넘치는 불(火 42.5)에 눌려 쇠(金 3.8)·물(水 6.0)이 메마른 신강(身强) 사주로, 이 사주를 살리는 용신은 쇠(金), 뒷받침하는 희신은 흙(土), 피해야 할 기신은 불(火)입니다.';

const PROSE = {
  opt1: {
    kr: '최시은', hanja: '崔溡殷', score: 62,
    tagline: '[요청하신 조합 평가] 자원오행·발음은 최상급이나, 정격(말년 총운)에 대흉이 있어 신중한 검토가 필요합니다.',
    sajuStory: `시은이의 사주는 ${SAJU_CORE}입니다. ${SAJU_BASE} 요청하신 溡(물이름 시)+殷(성할·클 은) 조합을 정직하게 평가해드립니다.\n\n※ 확인 결과 溡(물이름 시)는 DearName 한자DB(7,017자)에 등재되어 있지 않은 글자입니다. 획수(13획)는 말씀하신 원획법 수치를 그대로 반영했으며, 자원오행(水)은 부수(氵)를 근거로 판단한 값입니다 — 다른 옵션들처럼 자체 DB로 교차검증하지는 못했다는 점을 먼저 밝힙니다.`,
    jawonStory: '溡(시)는 물(水) 기운을 품어 사주에 메마른 물을 채우고, 殷(은)은 이 사주를 살리는 용신인 쇠(金)를 직접 채웁니다. 자원오행만 보면 이 사주에 이상적인 조합으로, 궁합이 "매우 좋음"으로 나옵니다.',
    hanjaDetails: (function(d){
      const arr = JSON.parse(JSON.stringify(d.fields.hanjaDetails));
      arr[0].meaning = '시(溡). "물이름"이라는 뜻으로 알려진 한자입니다. ⚠️ DearName 한자DB에는 등재되어 있지 않아, 획수·뜻은 말씀해주신 정보를 그대로 반영했습니다(자체 교차검증 불가). 부수(氵)를 근거로 물(水) 기운으로 분류했습니다.';
      return arr;
    })(DATA.opt1),
    hanjaStory: '溡(시)의 물 기운과 殷(은)의 성한 기운이 만나 "물처럼 흘러 크게 융성한다"는 뜻을 이룹니다. 다만 이 아름다운 뜻이 수리(획수)의 대흉을 넘어서지는 못한다는 점을 정직하게 말씀드립니다.',
    suriStoryOverride: '⚠️ 이 조합의 결정적 약점은 수리입니다. 원격(초년) 23수 혁신격, 형격(청년) 24수 입신격, 이격(장년) 21수 자립격은 모두 길(吉) 이상입니다. 그러나 평생의 총운을 나타내는 정격이 34수(변란격)로 대흉입니다. 이는 이전에 평가해드린 崔河銀(최하은)과 정확히 같은 유형의 결함입니다 — 崔(11)+溡(13)+殷(10)의 총획(34)이 정격 변란격을 이루는 구조로, 자원오행·발음이 아무리 좋아도 정격의 대흉은 전통 작명에서 가장 무겁게 보는 결함입니다.',
    conclusionLetter: '崔溡殷(최시은)을 요청하신 그대로 정직하게 평가한 결과를 말씀드립니다.\n\n먼저 밝혀드릴 점이 있습니다. 溡(물이름 시)는 DearName 한자DB 7,017자에 없는 글자로, 이번 평가의 획수(13획)·자원오행(水)은 말씀해주신 정보와 부수 분석을 근거로 했을 뿐 저희 DB로 교차검증하지는 못했습니다.\n\n그 전제 위에서 보면, 자원오행은 훌륭합니다 — 溡(水)가 메마른 물을, 殷(金)이 용신인 쇠를 채워 궁합이 "매우 좋음"입니다. 발음도 최→시→은으로 상생이 이어져 "매우 좋음"입니다.\n\n그러나 수리에서 심각한 결함이 있습니다. 정격(말년 총운)이 34수 변란격(대흉)입니다. 이는 崔(11)+溡(13)+殷(10)의 총획이 만드는 자리로, 앞서 평가해드린 崔河銀(최하은)의 형격·정격 대흉 문제와 같은 계열의 결함입니다.\n\n정직한 결론은 "권장하지 않음"입니다. "시은"이라는 소리를 유지하면서 수리까지 만족하는 대안을 아래 옵션2·3으로 함께 준비했으니 비교해 보시기 바랍니다.',
    careerAdvice: '자원오행상으로는 물(水)의 지혜와 쇠(金)의 결단력이 함께 요구되는 분야에 결이 맞습니다. 다만 앞서 평가한 수리의 대흉이 뒷받침되지 않으면 타고난 결이 온전히 발휘되기 어려우니, 수리를 보완한 옵션을 먼저 검토하시길 권합니다.',
    careerJobs: DATA.opt1.fields.careerJobs
  },
  opt2: {
    kr: '최시은', hanja: '崔詩溵', score: 92,
    tagline: '[대안①] "시은"의 소리를 지키면서 강물의 정취(溵)까지 담아낸, DB로 검증된 안정적 조합',
    sajuStory: `시은이의 사주는 ${SAJU_CORE}입니다. ${SAJU_BASE} 옵션1(崔溡殷)과 같은 "시은" 소리를 유지하면서, DearName 한자DB로 완전히 검증되는 詩(시)+溵(은) 조합으로 다시 찾았습니다. 溵은 "큰 강·물소리"라는 뜻으로, 애초에 원하셨던 강(江)의 정취를 그대로 담고 있습니다.`,
    jawonStory: '詩(시)는 "시·악장"이라는 뜻으로 이 사주를 살리는 용신인 쇠(金)를 직접 채우고, 溵(은)은 "큰 강·물소리"라는 뜻으로 메마른 물(水)을 채웁니다. 옵션1이 담으려 했던 "물"의 정취를 溵이 그대로 이어받으면서, 자원오행은 DB로 명확히 검증됩니다.',
    hanjaDetails: DATA.opt2.fields.hanjaDetails,
    hanjaStory: '詩(시)의 시적 정취와 溵(은)의 도도한 강물 소리가 만나 "시처럼 아름답고 강물처럼 깊게 울린다"는 뜻을 이룹니다. 옵션1이 지향했던 "물 이름"의 이미지를, 뜻이 분명하고 검증 가능한 한자로 고스란히 살렸습니다.',
    conclusionLetter: '최시은(崔詩溵)은 옵션1과 같은 소리를 유지하면서, 수리 결함을 해소한 첫 번째 대안입니다.\n\n詩(시)가 이 사주를 살리는 용신인 쇠(金)를 채우고, 溵(은)이 메마른 물(水)을 채워 궁합 "매우 좋음"은 옵션1과 동일합니다. 수리를 보면 원격(초년) 27수 대인격에 흉이 하나 있지만, 무겁게 보는 형격·이격·정격은 모두 길(吉) 이상 — 특히 정격 38수 문예격(대길)으로 평생의 노력이 아름다운 결실로 마무리됩니다. 옵션1의 정격 대흉이 완전히 해소된 것이 핵심 차이입니다.\n\n무엇보다 溵(큰 강·물소리)이 애초에 원하셨던 "물 이름"의 정취를 그대로 담으면서도, 저희 한자DB로 명확히 검증되는 실재하는 글자입니다. "시처럼 아름답고 강물처럼 깊이 울리는" 시은이의 삶을 응원합니다.',
    careerAdvice: '시은의 사주는 뜨거운 정화(丁火) 일간 위에, 이름이 채워준 쇠(金)의 명료함과 물(水)의 깊은 정취가 더해진 형상입니다. 표현력과 통찰력이 함께 요구되는 분야에서 특히 빛을 발할 것입니다.',
    careerJobs: DATA.opt2.fields.careerJobs
  },
  opt3: {
    kr: '최시은', hanja: '崔詩銀', score: 85,
    tagline: '[대안②] 시(詩)의 정취에 은(銀)의 귀함을 더한, 수리 구조는 대안①과 동일한 자매 조합',
    sajuStory: `시은이의 사주는 ${SAJU_CORE}입니다. ${SAJU_BASE} 대안①(崔詩溵)과 詩(시)는 같이 쓰되, 은(銀)의 한자만 다르게 바꾼 자매 옵션입니다. 銀(은,화폐)은 溵과 획수가 같아(14획) 수리 구조는 완전히 동일하고, 상징하는 이미지만 "강물"에서 "은/재물"로 달라집니다.`,
    jawonStory: '詩(시)는 이 사주의 용신인 쇠(金)를 직접 채우고, 銀(은) 역시 쇠(金) 기운입니다. 두 글자 모두 금(金)이라 용신을 두텁게 채우지만, 물(水)은 채우지 못해 궁합은 "매우 좋음"이 아닌 "좋음"에 머뭅니다 — 이 점이 대안①(詩溵)과의 유일한 차이입니다.',
    hanjaDetails: DATA.opt3.fields.hanjaDetails,
    hanjaStory: '詩(시)의 시적 정취와 銀(은)의 맑고 귀한 빛이 만나 "시처럼 아름답고 은처럼 귀하다"는 뜻을 이룹니다. 대안①과 수리는 완전히 같으면서, 강물 대신 은빛의 이미지를 담고 싶으실 때의 선택지입니다.',
    conclusionLetter: '최시은(崔詩銀)은 대안①(崔詩溵)과 수리 구조가 완전히 같은 자매 옵션입니다.\n\n詩(13획)에 銀(14획)을 더해도, 溵(14획)을 더한 것과 총획이 같아 원격 27수(대인격·흉 1곳)·형격 24수(입신격·대길)·이격 25수(안강격·길)·정격 38수(문예격·대길)로 수리는 동일합니다. 다만 銀은 溵과 달리 물(水)이 아닌 쇠(金) 기운이라, 자원오행 궁합이 "매우 좋음" 대신 "좋음"으로 한 단계 낮습니다.\n\n"강물"보다 "은빛"의 이미지를 더 원하신다면, 수리 손해 없이 銀을 선택하실 수 있습니다. 시처럼 아름답고 은처럼 귀하게 자라날 시은이를 응원합니다.',
    careerAdvice: '시은의 사주는 뜨거운 정화(丁火) 일간 위에, 이름이 두 글자 모두로 채워준 쇠(金)의 결단력이 짙게 더해진 형상입니다. 명료한 판단과 실행력이 요구되는 분야에서 뚜렷한 성과를 낼 것입니다.',
    careerJobs: DATA.opt3.fields.careerJobs
  }
};

const lines = [];
lines.push('        // ═══════════════════════════════════════════════════════════');
lines.push('        // 최시은 3옵션: 성씨 최(崔) · 2026-07-02 08:50 여아');
lines.push('        // 옵션1: 사용자 지정 조합(崔溡殷) 정직 평가 — 溡는 DB 미등재(사용자 제공값)');
lines.push('        // 옵션2·3: DB 검증된 대안(崔詩溵/崔詩銀) — scripts/calc_sieun.js 산출');
lines.push('        // ═══════════════════════════════════════════════════════════');

['opt1','opt2','opt3'].forEach((key, i) => {
  const n = i + 1;
  const p = PROSE[key];
  const d = DATA[key];
  const hj1 = `{ h: ${JSON.stringify(d.h1.h)}, kr: ${JSON.stringify(d.h1.kr)}, m: ${JSON.stringify(d.h1.m)}, s: ${d.h1.s}, o: ${JSON.stringify(d.h1.o)} }`;
  const hj2 = `{ h: ${JSON.stringify(d.h2.h)}, kr: ${JSON.stringify(d.h2.kr)}, m: ${JSON.stringify(d.h2.m)}, s: ${d.h2.s}, o: ${JSON.stringify(d.h2.o)} }`;

  lines.push(`        // ── 이름 ${n}: ${p.kr} (${p.hanja}) ─────────────────────────`);
  lines.push(`        const _demo${n} = {`);
  lines.push(`            familyKr: '최', familyHanja: '崔',`);
  lines.push(`            h1: ${hj1},`);
  lines.push(`            h2: ${hj2},`);
  lines.push(`            s0: 11, isOija: false, score: ${p.score}`);
  lines.push('        };');
  lines.push(`        const _report${n} = {`);
  lines.push(`            tagline: ${JSON.stringify(p.tagline)},`);
  lines.push(`            sajuStory: ${JSON.stringify(p.sajuStory)},`);
  lines.push(`            jawonStory: ${JSON.stringify(p.jawonStory)},`);
  lines.push(`            hanjaDetails: ${JSON.stringify(p.hanjaDetails)},`);
  lines.push(`            hanjaStory: ${JSON.stringify(p.hanjaStory)},`);
  lines.push(`            soundStory: ${JSON.stringify(d.fields.soundStory)},`);
  lines.push(`            suriStory: ${JSON.stringify(p.suriStoryOverride || d.fields.suriStory)},`);
  lines.push(`            conclusionLetter: ${JSON.stringify(p.conclusionLetter)},`);
  lines.push(`            lifeFlow: ${JSON.stringify(d.fields.lifeFlow)},`);
  lines.push(`            careerAdvice: ${JSON.stringify(p.careerAdvice)},`);
  lines.push(`            careerJobs: ${JSON.stringify(p.careerJobs)},`);
  lines.push(`            healthAdvice: ${JSON.stringify(d.fields.healthAdvice)}`);
  lines.push('        };');
});

lines.push('        _currentState = {');
lines.push(`            nameSpec: { prefer: ['水', '土'], avoid: ['火'], strategy: 'balance', gridType: 'general' },`);
lines.push(`            familyName: { kr: '최', hanja: '崔', strokes: 11 },`);
lines.push(`            constraints: { gender: 'F', dolrim: null, hangryul: null, traits: [], nameType: 2 },`);
lines.push(`            searchControl: { maxResults: 3, qualityThreshold: 70 },`);
lines.push(`            _inputRaw: { birthDate: '2026-07-02', birthTime: '08:50', calType: 'solar', gender: 'F', city: '' },`);
lines.push(`            _sajuOpts: {},`);
lines.push(`            _saju: _demoSaju,`);
lines.push(`            _scores: _demoScores`);
lines.push('        };');
lines.push(`        _allCandidates = [_demo1, _demo2, _demo3];`);
lines.push(`        _allReports    = [_report1, _report2, _report3];`);
lines.push('        _chatDemoMode  = true;');
lines.push('');
lines.push(`        _renderReportTabs([_demo1, _demo2, _demo3]);`);
lines.push('        _renderReportContent(_demo1, _report1, 0);');

fs.writeFileSync(path.join(__dirname, '..', '_sieun_block.txt'), lines.join('\n'), 'utf8');
console.log('생성 완료:', lines.length, '줄');
