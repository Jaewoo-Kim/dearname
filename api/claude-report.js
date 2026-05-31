// api/claude-report.js
// Claude API 소견서 생성 — 서버가 계산한 팩트 → Claude가 스토리텔링
// v2.1: 공식 생성 필드 분리 → Claude 비용 ~27% 절감 + 프롬프트 캐싱 적용

const TRAIT_LABELS = {
  1:'리더십·카리스마', 2:'지혜·총명함', 3:'따뜻함·포용력',
  4:'건강·활력',       5:'예술성·창의력', 6:'재물·풍요로움'
};

const SEORYEOK_KR = {
  'extreme_weak':'극약', 'weak':'부족', 'balanced':'적정',
  'strong':'과다', 'extreme_strong':'태과'
};

// ── 시스템 프롬프트 (정적 — 프롬프트 캐싱 적용) ────────────────────────
const SYSTEM_PROMPT =
`당신은 30년 경력의 최고 명리학 대가이자 작명 전문가입니다.
서버가 계산한 명리학적 팩트를 바탕으로, 부모님의 마음을 따뜻하게 울리는 품격 있는 작명 소견서를 작성합니다.
규칙:
- 중학생도 이해할 수 있는 쉬운 언어 사용
- 어려운 한자 용어는 반드시 () 안에 풀이
- 자원오행(字源五行)과 원획법(原劃法) 획수를 근거로 구체적으로 설명
- 수치 데이터(획수, 점수)를 자연스럽게 서술에 녹임
- 각 필드는 지정된 분량을 지켜 충분히 풍부하게 작성
- JSON만 반환. 마크다운 코드블록 절대 없이.`;

// ── 공식 생성 함수 (Claude 없이 JS로 확정 생성) ───────────────────────

function _genSoundStory(candidate) {
  const { h1, h2, familyKr } = candidate;
  const fullName = `${familyKr}${h1.kr}${h2?.kr||''}`;

  const OHENG_CYCLE = ['木','火','土','金','水'];
  const getCho  = window.getCho  || (() => '');
  const getOheng = window.getOhengFromCho || (() => '');
  const getYY   = window.getYinYangFromJung || (() => '');

  const pronOhengs = fullName.split('').map(c => getOheng(getCho(c)));
  let badCount = 0;
  for (let i = 0; i < pronOhengs.length - 1; i++) {
    const e1 = pronOhengs[i], e2 = pronOhengs[i+1];
    if (e1 === e2) continue; // 비화 → 상생
    const ia = OHENG_CYCLE.indexOf(e1), ib = OHENG_CYCLE.indexOf(e2);
    if (!((ia+1)%5===ib || (ib+1)%5===ia)) badCount++;
  }
  const total = pronOhengs.length - 1;
  let pronGrade;
  if (badCount === 0)               pronGrade = '매우 좋음';
  else if (badCount * 2 <= total)   pronGrade = '좋음';
  else if (badCount === total)      pronGrade = '매우 나쁨';
  else                              pronGrade = '나쁨';

  const yinYangs = fullName.split('').map(c => getYY(c));
  const allYang = yinYangs.every(y => y === '양');
  const allYin  = yinYangs.every(y => y === '음');
  const pyHarmonious = !(allYang || allYin);

  const ONAME = {'木':'목(木)','火':'화(火)','土':'토(土)','金':'금(金)','水':'수(水)'};
  const flowStr = pronOhengs.map(o => ONAME[o]||o).join(' → ');

  let story = `이름의 초성 오행 흐름은 ${flowStr}으로 이어집니다. `;
  if (pronGrade === '매우 좋음') {
    story += '초성의 기운이 막힘없이 상생(相生)으로 연결되어, 이름을 부를 때마다 밝고 부드러운 에너지가 자연스럽게 흐릅니다. ';
  } else if (pronGrade === '좋음') {
    story += '상생의 흐름이 우세하여 이름에서 따뜻한 에너지가 전해집니다. ';
  } else {
    story += '소리의 흐름에 기운의 충돌이 일부 있으나, 다른 길한 요소들이 이를 보완해줍니다. ';
  }
  story += pyHarmonious
    ? '모음의 음양 배합도 고르게 어우러져 귀에 닿는 소리가 안정적이고 편안합니다.'
    : '모음의 음양 배합은 한쪽으로 쏠려 있으나, 이름의 자원오행과 수리가 균형을 잡아줍니다.';
  return story;
}

function _getSuriData(n) {
  let num = n > 81 ? n % 81 : n;
  if (num === 0) num = 81;
  return (typeof SURI_DATA !== 'undefined' && SURI_DATA[num])
    ? SURI_DATA[num]
    : { name: `${num}수격`, grade: '평', desc: '' };
}

function _calcGuk(candidate) {
  const { h1, h2, s0 } = candidate;
  const isOija = !h2;
  const s1 = h1.s, s2 = h2 ? h2.s : 0;
  return {
    g1: isOija ? s1+1   : s1+s2,   // 원격 (초년)
    g2: s0 + s1,                    // 형격 (청년)
    g3: isOija ? s0+1   : s0+s2,   // 이격 (장년)
    g4: isOija ? s0+s1  : s0+s1+s2 // 정격 (말년)
  };
}

function _genSuriStory(candidate) {
  const { g1, g2, g3, g4 } = _calcGuk(candidate);
  const d1 = _getSuriData(g1), d2 = _getSuriData(g2);
  const d3 = _getSuriData(g3), d4 = _getSuriData(g4);
  const endWord = d4.grade === '길' ? '풍요로운' : d4.grade === '흉' ? '단단히 다져야 할' : '안정적인';
  return `원격(초년) ${g1}수 ${d1.name}의 기운으로 성장하고, `
    + `형격(청년) ${g2}수 ${d2.name}의 에너지로 사회에 첫발을 내딛습니다. `
    + `이격(장년) ${g3}수 ${d3.name}이 중년의 활동기를 힘차게 뒷받침하고, `
    + `정격(말년) ${g4}수 ${d4.name}이 평생의 노력을 ${endWord} 결실로 마무리합니다.`;
}

function _genLifeFlow(candidate) {
  const { h1, h2 } = candidate;
  const { g1, g2, g3, g4 } = _calcGuk(candidate);
  const d1 = _getSuriData(g1), d2 = _getSuriData(g2);
  const d3 = _getSuriData(g3), d4 = _getSuriData(g4);
  const ONAME = {'木':'목(木)','火':'화(火)','土':'토(土)','金':'금(金)','水':'수(水)'};
  const o1 = ONAME[h1.o]||h1.o;
  const o2 = h2 ? (ONAME[h2.o]||h2.o) : '';
  return {
    early:  `원격 ${g1}수 ${d1.name}의 영향 아래, ${o1} 기운이 씨앗처럼 뿌리를 내리며 밝고 건강한 성장의 토대를 만들어갑니다.`,
    middle: `형격 ${g2}수 ${d2.name}과 이격 ${g3}수 ${d3.name}이 사회 진출기를 뒷받침합니다. ${o2 ? o1+'과 '+o2 : o1}의 자원오행이 직업과 인간관계에 긍정적으로 작용하며 잠재력이 꽃피는 시기입니다.`,
    late:   `정격 ${g4}수 ${d4.name}이 수십 년의 노력을 아름답게 거두어들입니다. 이름이 품은 깊은 기운이 지혜와 인덕으로 빛나는 풍요로운 시기를 열어줍니다.`
  };
}

function _genCareerJobs(candidate) {
  const { h1, h2 } = candidate;
  const OHENG_CAREERS = {
    '木': ['교육자·교사', '기획·전략가', '의사·한의사', '사회복지사'],
    '火': ['예술가·디자이너', '미디어·방송인', '마케터·홍보전문가', '심리상담사'],
    '土': ['행정공무원', '부동산전문가', '경영관리자', '철학·상담전문가'],
    '金': ['법조인·판사', '금융·투자전문가', 'IT개발·엔지니어', '군인·경찰'],
    '水': ['외교관·국제전문가', '무역·유통전문가', '연구원·과학자', '여행·관광전문가']
  };
  const ohengs = [h1.o, h2?.o].filter(Boolean);
  const pool = [];
  ohengs.forEach(o => { (OHENG_CAREERS[o]||[]).forEach(c => { if (!pool.includes(c)) pool.push(c); }); });
  return pool.slice(0, 4);
}

function _genHealthAdvice(state) {
  const { _scores } = state;
  if (!_scores) return '규칙적인 생활 습관으로 타고난 기운을 온전히 보전하세요.';
  const entries = Object.entries(_scores).sort((a,b) => a[1]-b[1]);
  if (!entries.length) return '규칙적인 생활 습관으로 타고난 기운을 온전히 보전하세요.';
  const weakest = entries[0][0];
  const HEALTH = {
    '木': '간·담·눈이 허약할 수 있으니 충분한 수면과 녹색 채소 섭취로 목(木) 기운을 보충하세요.',
    '火': '심장·혈액 순환에 유의하고, 충분한 휴식과 명상으로 화(火) 기운의 과부하를 예방하세요.',
    '土': '소화기·위장이 민감할 수 있으니 규칙적인 식사와 과식을 피하는 습관을 들이세요.',
    '金': '폐·피부·호흡기를 위해 맑은 공기와 적절한 유산소 운동으로 금(金) 기운을 키우세요.',
    '水': '신장·방광 관리에 유의하고, 충분한 수분 섭취와 규칙적인 휴식으로 수(水) 기운을 보강하세요.'
  };
  return HEALTH[weakest] || '규칙적인 생활 습관으로 타고난 기운을 온전히 보전하세요.';
}

/** 5개 공식 필드 한 번에 생성 */
function _genFormulaFields(candidate, state) {
  return {
    soundStory:  _genSoundStory(candidate),
    suriStory:   _genSuriStory(candidate),
    lifeFlow:    _genLifeFlow(candidate),
    careerJobs:  _genCareerJobs(candidate),
    healthAdvice: _genHealthAdvice(state)
  };
}

// ── 프롬프트 조립 + Claude API 호출 (8개 서술 필드) ──────────────────

/**
 * buildUserPrompt — Claude 에게 보낼 userPrompt 문자열을 결정적으로 조립.
 * LLM 호출 없이 순수 계산만 수행하므로 단위 테스트(프롬프트 계약) 대상이 된다.
 */
function buildUserPrompt(candidate, state) {
  const { h1, h2, s0, score, familyKr, familyHanja } = candidate;
  const { nameSpec, constraints, _saju, _scores } = state;
  const isOija = !h2;

  const s1 = h1.s, s2 = h2 ? h2.s : 0;
  const g1 = isOija ? s1+1    : s1+s2;
  const g2 = s0 + s1;
  const g3 = isOija ? s0+1    : s0+s2;
  const g4 = isOija ? s0+s1   : s0+s1+s2;

  const getSuriInfo = (n) => {
    let num = n > 81 ? n%81 : n;
    if (num === 0) num = 81;
    const d = (typeof SURI_DATA !== 'undefined' && SURI_DATA[num])
      ? SURI_DATA[num] : { name:'', grade:'평', desc:'' };
    return `${n}수(${d.name}, ${d.grade})`;
  };

  const nameKr    = `${familyKr}${h1.kr}${h2?.kr||''}`;
  const nameHanja = `${familyHanja}${h1.h}${h2?.h||''}`;
  const monthStr  = _saju?.month ? `${_saju.month.gan}${_saju.month.ji}月` : '';
  const traitStr  = (constraints?.traits||[]).map(t=>TRAIT_LABELS[t]).join(', ') || '없음';
  const ohengStr  = Object.entries(_scores||{})
    .map(([o,s])=>`${o}:${s.toFixed(1)}점(${SEORYEOK_KR[getSeoryeokStatus(s)]||''})`)
    .join(' ');
  const _ohengKr = {'木':'목(나무)','火':'화(불)','土':'토(흙)','金':'금(쇠)','水':'수(물)'};

  // 8자 단순 카운트로 사주 분류 (셀프작명 뱃지와 동일 기준)
  const _CG8 = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  const _JJ8 = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
  const _cnt8 = {'木':0,'火':0,'土':0,'金':0,'水':0};
  ['year','month','day','time'].forEach(k => {
    const p = _saju?.[k]; if (!p) return;
    [_CG8[p.gan], _JJ8[p.ji]].filter(Boolean).forEach(o => { if (_cnt8[o]!==undefined) _cnt8[o]++; });
  });
  const _max8   = Math.max(...Object.values(_cnt8));
  const _has08  = Object.values(_cnt8).some(v => v === 0);
  const _dom8   = Object.entries(_cnt8).filter(([,v]) => v===_max8).map(([k]) => k).join('·');
  const _zero8  = Object.entries(_cnt8).filter(([,v]) => v===0).map(([k]) => k).join('·');
  let _class8;
  if (_has08)        _class8 = `불균형 — ${_zero8} 기운 결핍`;
  else if (_max8>=4) _class8 = `강세 — ${_dom8} 기운 매우 강함 (종격/전왕격 가능성)`;
  else if (_max8===3) _class8 = `편중형 — ${_dom8} 기운 우세`;
  else               _class8 = '균형형';
  // 지장간 가중 점수와 표면 분류가 다를 때 메모 생성
  const _avgScore8 = Object.values(_scores||{}).reduce((a,b) => a+b, 0) / 5;
  const _weightedBalanced = !Object.values(_scores||{}).some(s => s < _avgScore8*0.5 || s > _avgScore8*2.2);
  const _class8Note = (!_has08 && _max8>=3 && _weightedBalanced)
    ? `※ 지장간 가중치 기준으로는 오행 점수가 비교적 균형에 가깝습니다 (단순 카운트와 다름).`
    : '';
  const _cnt8Str = `木${_cnt8['木']} 火${_cnt8['火']} 土${_cnt8['土']} 金${_cnt8['金']} 水${_cnt8['水']}`;

  // 종격 판정 결과 (buildNameSpec의 strategy:'reinforce'와 동일 조건)
  const _isReinforce  = nameSpec?.strategy === 'reinforce';
  const _jongDomOheng = nameSpec?.prefer?.[0];
  const _SPECIAL_GUK  = {'木':'종왕/종강격','火':'종아격','土':'전왕격','金':'종재격','水':'종살격'};
  const _jongTypeName = (typeof SPECIAL_GUK_NAMES !== 'undefined' && SPECIAL_GUK_NAMES?.[_jongDomOheng])
    || _SPECIAL_GUK[_jongDomOheng] || '종격';
  const _jongAvoidOheng = nameSpec?.avoid?.[0];
  const _ohengKr2 = {'木':'목(나무)','火':'화(불)','土':'토(흙)','金':'금(쇠)','水':'수(물)'};

  // 조후(調候) 판정
  const _johuDiag   = nameSpec?.diagnosis?.find(d => d.type === '조후');
  const _isHotJi    = ['巳','午','未'].includes(_saju?.month?.ji || '');
  const _isColdJi   = ['亥','子','丑'].includes(_saju?.month?.ji || '');
  const _johuStr    = _johuDiag
    ? `긴급 — ${_johuDiag.msg}`
    : (_isHotJi
        ? `여름 월지(${_saju?.month?.ji||''}) — 水:${(_scores?.['水']||0).toFixed(1)}pt (충분, 긴급 없음)`
        : _isColdJi
          ? `겨울 월지(${_saju?.month?.ji||''}) — 火:${(_scores?.['火']||0).toFixed(1)}pt (충분, 긴급 없음)`
          : `봄·가을 월지(${_saju?.month?.ji||''}) — 조후 긴급 없음`);

  // 억부법(抑扶法) 용신
  const _ys    = nameSpec?.yongsin;
  const _ysStr = _ys
    ? (`${_ys.desc}\n`
     + `일간: ${_ys.dayGan}(${_ohengKr2[_ys.dayOheng]||_ys.dayOheng}) / `
     + `인비: ${_ys.inbiScore.toFixed(1)}pt(${_ohengKr2[_ys.inOheng]||_ys.inOheng}+${_ohengKr2[_ys.bikOheng]||_ys.bikOheng}) / `
     + `식재관: ${_ys.sjgScore.toFixed(1)}pt\n`
     + `용신: ${_ys.yongsinOheng ? (_ohengKr2[_ys.yongsinOheng]||_ys.yongsinOheng) : '중화(없음)'} / `
     + `희신: ${_ys.heesinOheng ? (_ohengKr2[_ys.heesinOheng]||_ys.heesinOheng) : '-'} / `
     + `기신: ${_ys.gisinOheng  ? (_ohengKr2[_ys.gisinOheng ]||_ys.gisinOheng ) : '-'}`)
    : '일간 정보 없음';

  const parentOheng = state.parentOheng;
  const parentOhengStr = parentOheng
    ? ['father','mother'].map(p => {
        const d = parentOheng[p];
        if (!d?.dominant) return null;
        const who = p === 'father' ? '아버지' : '어머니';
        const dom  = _ohengKr[d.dominant] || d.dominant;
        const weak = _ohengKr[d.weakest]  || d.weakest || '미상';
        return `${who}: 지배오행 ${dom} / 결핍오행 ${weak}`;
      }).filter(Boolean).join(' | ')
    : '';
  const specialRequest = state.specialRequest || '';

  // ── 사용자 프롬프트 (8개 서술 필드만 요청) ───────────────────────
  const userPrompt =
`"${nameKr}(${nameHanja})" 이름의 프리미엄 작명 소견서를 작성해주세요.

[사주 원국]
연주: ${_saju?.year?.gan||''}${_saju?.year?.ji||''} / 월주: ${_saju?.month?.gan||''}${_saju?.month?.ji||''}(${monthStr}) / 일주: ${_saju?.day?.gan||''}${_saju?.day?.ji||''} (아이의 본질) / 시주: ${_saju?.time?.gan||''}${_saju?.time?.ji||''}

[오행 분석]
${ohengStr}
NameSpec Prefer: [${nameSpec?.prefer?.join(', ')||''}] / Avoid: [${nameSpec?.avoid?.join(', ')||''}]
전략: ${nameSpec?.strategy||''} (${nameSpec?.gridType||''})

[사주 오행 분류 — 8자 단순 카운트]
${_cnt8Str} → ${_class8}
${_class8Note}
${_isReinforce ? `
[종격(從格) 판정]
유형: ${_jongTypeName} — ${_jongDomOheng}(${_ohengKr2[_jongDomOheng]||_jongDomOheng}) 기운이 압도적 (지장간 가중 60점 이상)
종격 원칙: 강한 기운에 순응(從) → ${_jongDomOheng} 기운 강화 이름이 최적 (일반 보완 원칙 역전)
피해야 할 기운: ${_jongAvoidOheng||''}(${_ohengKr2[_jongAvoidOheng]||''}) — 극오행 포함 이름은 나쁨
` : ''}
[조후(調候) 판정]
${_johuStr}

[용신(用神) 분석 — 억부법]
${_ysStr}

[이름 분석]
한자: ${familyHanja}(${familyKr}) · ${h1.h}(${h1.kr}) · ${h2?h2.h+'('+h2.kr+')':''}
자원오행: ${h1.o}${h2?'+'+h2.o:''} / 원획법: ${familyHanja} ${s0}획 · ${h1.h} ${s1}획${h2?' · '+h2.h+' '+s2+'획':''}
한자 뜻: ${h1.kr}(${h1.h}) = ${h1.m}${h2?' / '+h2.kr+'('+h2.h+') = '+h2.m:''}
사격수리: 원격 ${getSuriInfo(g1)} / 형격 ${getSuriInfo(g2)} / 이격 ${getSuriInfo(g3)} / 정격 ${getSuriInfo(g4)}
종합 점수: ${score}/100점
${parentOhengStr ? `\n[부모 오행 분석]\n${parentOhengStr}` : ''}
${specialRequest ? `\n[부모 특별 요청사항]\n${specialRequest}` : ''}

[부모 희망 성향]
${traitStr}

아래 JSON 구조로 정확하게 반환해주세요 (각 필드의 분량 지침 준수):
{
  "tagline": "핵심 한 줄 시그니처 (따옴표로 감싼 시적 표현, 20~40자)",
  "sajuStory": "사주 원국 서사. 일주를 중심으로 아이의 타고난 기질, 사주 지형의 특징, 부족한 기운과 넘치는 기운의 의미를 3~4문장으로 풍부하게 서술. 부모가 읽으면 고개를 끄덕이게 되는 이야기여야 함. 【필수】위 [사주 오행 분류]가 불균형·편중형·강세인 경우 결핍/강한 기운을 반드시 언급할 것. 8자 분류와 지장간 점수가 불일치하는 경우(※ 메모가 있을 때)에는 '표면상 ○ 기운이 강해 보이지만, 지장간의 실질 에너지까지 고려하면 균형에 가깝습니다'처럼 한 문장으로 명시할 것. 【종격 필수】[종격 판정] 섹션이 있으면: ①이 사주가 종격임을 밝히고, ②일반 사주와 달리 강한 기운에 순응(따라가야)해야 하는 원리를 쉽게 설명하며, ③강한 기운을 억제하는 것이 오히려 역효과임을 언급할 것. 【억부 참고】[용신 분석] 섹션의 신강/신약 정보를 자연스럽게 녹여 '이 아이의 사주는 ○○ 기운이 강한 신강(身强) 체질' 또는 '신약(身弱)하여 ○○ 기운의 도움이 필요한 체질'임을 한 문장으로 언급할 것 (용신이 있는 경우에만).",
  "jawonStory": "자원오행 보완 서사. 선택된 이름의 한자들이 어떻게 사주의 빈자리를 채우는지, 구체적인 오행 흐름과 함께 2~3문장으로 설명.",
  "hanjaDetails": [
    {
      "hanja": "한자 글자",
      "kr": "한글 음",
      "meaning": "뜻 풀이 — 한자의 어원이나 시적 의미를 포함해 2~3문장으로 풍부하게",
      "strokes": 획수,
      "oheng": "자원오행",
      "synergyWithSaju": "이 한자가 이 아이의 사주에 미치는 구체적 시너지 1~2문장"
    }
  ],
  "hanjaStory": "세 글자(성+이름)가 하나의 이름으로 합쳐졌을 때의 종합적 의미. '이 이름을 풀어쓰면...' 형태로 시적이고 감성적으로 2~3문장.",
  "conclusionLetter": "부모님께 보내는 따뜻한 편지. 【필수 규칙】사주·오행·자원오행·수리·원격·형격·이격·정격·간지·자원획수 같은 전문 용어는 절대 쓰지 말 것. 대신 일상 언어로 풀어서 표현할 것(예: '오행이 보완된다' → '이름이 부족한 기운을 채워준다' / '일간의 기질' → '이 아이가 태어날 때부터 가진 성품'). 구성: ①이 아이가 타고난 성품과 가능성을 동네 어른도 바로 이해할 수 있는 말로 한 문장. ②이 이름의 각 글자가 품고 있는 뜻이 아이의 삶에 어떤 이야기를 만들어주는지 쉽고 따뜻하게 2문장. ③평생 이 이름을 불러줄 부모님을 향한 진심 어린 응원과 따뜻한 축원으로 1~2문장 마무리. 총 4~5문장. 중학생이 읽어도 뜻이 바로 통하는 편지 말투.",
  "careerAdvice": "이름의 역할 서사 (반드시 4문장 이상). ①이 아이의 사주 원국에서 드러나는 일간의 타고난 기질과 강한 오행 기운을 1문장으로 설명. ②사주에서 부족했던 오행과 그로 인한 인생의 과제를 1문장으로 설명. ③이 이름이 그 빈자리를 어떻게 채우고, 그 결과 아이의 인생이 어떤 방향으로 펼쳐지는지를 1~2문장으로 서술. ④이 이름과 함께할 아이의 미래에 대한 따뜻한 축원 1문장으로 마무리. 오행·수리 근거를 자연스럽게 녹여 이야기 형식으로."
}`;

  return userPrompt;
}

// ── Claude API 호출 (8개 서술 필드) ──────────────────────────────────
async function generatePremiumReport(candidate, state) {
  const { h1, h2, familyKr, familyHanja } = candidate;
  const { _saju } = state;
  const nameKr = `${familyKr}${h1.kr}${h2?.kr||''}`;
  const userPrompt = buildUserPrompt(candidate, state);

  const PROXY_URL   = '/proxy/claude';
  const DIRECT_URL  = 'https://api.anthropic.com/v1/messages';
  const DIRECT_HEADERS = {
    'Content-Type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true',
    'anthropic-beta': 'prompt-caching-2024-07-31'
  };

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1800,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }
      }
    ],
    messages: [{ role: 'user', content: userPrompt }]
  });

  try {
    let response;
    try {
      response = await fetch(PROXY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      });
      if (!response.ok && response.status === 404) throw new Error('proxy_not_found');
    } catch (proxyErr) {
      console.info('[DearName] 프록시 미사용 → 직접 API 호출');
      response = await fetch(DIRECT_URL, {
        method: 'POST', headers: DIRECT_HEADERS, body
      });
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    // 캐시 히트 여부 로깅 (개발용)
    if (data.usage) {
      const u = data.usage;
      console.info(`[DearName] 토큰 — 입력:${u.input_tokens} 캐시읽기:${u.cache_read_input_tokens||0} 캐시쓰기:${u.cache_creation_input_tokens||0} 출력:${u.output_tokens}`);
    }

    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    const clean = text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.error('generatePremiumReport 오류:', err);
    // 오류 시 8개 Claude 필드 폴백 (공식 필드는 generateAllReports에서 병합)
    return {
      tagline: `"${nameKr}, 맑고 깊은 기운으로 세상을 밝히다"`,
      sajuStory: `${_saju?.day?.gan||''}${_saju?.day?.ji||''}일주의 아이는 독특한 기질과 감수성을 타고났습니다. 사주 원국의 오행 분포를 살펴보면 특정 기운이 강하고 일부가 부족한 지형을 보이는데, 이것이 바로 이름으로 보완해야 할 핵심 과제입니다.`,
      jawonStory: `자원오행 ${h1.o}${h2?'+'+h2.o:''}의 기운이 사주의 필요를 정확히 보완합니다. 이 이름의 한자들이 부족한 기운을 채워 아이의 타고난 잠재력이 더욱 빛날 수 있도록 돕습니다.`,
      hanjaDetails: [
        { hanja:h1.h, kr:h1.kr, meaning:h1.m, strokes:h1.s, oheng:h1.o, synergyWithSaju:'이 한자의 기운이 사주와 조화를 이룹니다.' },
        ...(h2 ? [{ hanja:h2.h, kr:h2.kr, meaning:h2.m, strokes:h2.s, oheng:h2.o, synergyWithSaju:'이 한자가 사주의 균형을 완성합니다.' }] : [])
      ],
      hanjaStory: `이 이름을 풀어쓰면, ${h1.kr}(${h1.h})의 ${h1.m} 기운과${h2 ? ' '+h2.kr+'('+h2.h+')의 '+h2.m+' 기운이' : ''} 하나로 어우러져 아이의 이름이 됩니다.`,
      conclusionLetter: `${nameKr}이라는 이름은 이 아이가 가진 타고난 성품과 꼭 맞게 지어진 이름입니다. 이름 한 글자 한 글자에 담긴 뜻이 아이의 삶 속에서 조금씩 빛을 발하며 좋은 길잡이가 되어줄 거예요. 이 이름을 불러줄 때마다 아이에게 따뜻한 기운이 전해지길 바라며, 건강하고 행복하게 자라나길 진심으로 응원합니다.`,
      careerAdvice: `${nameKr}이라는 이름을 가진 아이는 타고난 기질과 이름의 오행이 어우러져 다양한 분야에서 잠재력을 발휘합니다. 이름이 보완해주는 오행 기운이 아이의 인생 여정을 더욱 풍요롭게 만들어줄 것입니다.`
    };
  }
}

// ── 전체 보고서 생성 (순차 호출 → 캐시 적중 극대화) ─────────────────

async function generateAllReports(candidates, state) {
  const top = candidates.slice(0, 3);
  const results = [];
  for (const c of top) {
    const formulaFields = _genFormulaFields(c, state);
    const claudeFields  = await generatePremiumReport(c, state);
    // 공식 필드 + Claude 서술 필드 병합 (Claude 필드 우선)
    results.push(Object.assign({}, formulaFields, claudeFields));
  }
  return results;
}
