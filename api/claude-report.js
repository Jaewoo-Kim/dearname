// api/claude-report.js
// Claude API 소견서 생성 — 서버가 계산한 팩트 → Claude가 스토리텔링

const TRAIT_LABELS = {
  1:'리더십·카리스마', 2:'지혜·총명함', 3:'따뜻함·포용력',
  4:'건강·활력',       5:'예술성·창의력', 6:'재물·풍요로움'
};

const SEORYEOK_KR = {
  'extreme_weak':'극약', 'weak':'부족', 'balanced':'적정',
  'strong':'과다', 'extreme_strong':'태과'
};

/**
 * 단일 이름 후보 → Claude 소견서 JSON
 * @param {Object} candidate  { h1, h2, s0, score, familyKr, familyHanja, isOija }
 * @param {Object} state      SearchState (_saju, _scores, nameSpec, constraints)
 * @returns {Object} report JSON
 */
async function generatePremiumReport(candidate, state) {
  const { h1, h2, s0, score, familyKr, familyHanja } = candidate;
  const { nameSpec, constraints, _saju, _scores } = state;
  const isOija = !h2;

  // 수리 계산 (소견서 팩트용)
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

  const systemPrompt =
`당신은 30년 경력의 최고 명리학 대가이자 작명 전문가입니다.
서버가 계산한 명리학적 팩트를 바탕으로, 부모님의 마음을 따뜻하게 울리는 품격 있는 작명 소견서를 작성합니다.
규칙:
- 중학생도 이해할 수 있는 쉬운 언어 사용
- 어려운 한자 용어는 반드시 () 안에 풀이
- 자원오행(字源五行)과 원획법(原劃法) 획수를 근거로 구체적으로 설명
- 수치 데이터(획수, 점수)를 자연스럽게 서술에 녹임
- JSON만 반환. 마크다운 코드블록 절대 없이.`;

  const userPrompt =
`"${nameKr}(${nameHanja})" 이름의 프리미엄 작명 소견서를 작성해주세요.

[사주 원국]
연주: ${_saju?.year?.gan||''}${_saju?.year?.ji||''} / 월주: ${_saju?.month?.gan||''}${_saju?.month?.ji||''}(${monthStr}) / 일주: ${_saju?.day?.gan||''}${_saju?.day?.ji||''} (아이의 본질) / 시주: ${_saju?.time?.gan||''}${_saju?.time?.ji||''}

[오행 분석]
${ohengStr}
NameSpec Prefer: [${nameSpec?.prefer?.join(', ')||''}] / Avoid: [${nameSpec?.avoid?.join(', ')||''}]
전략: ${nameSpec?.strategy||''} (${nameSpec?.gridType||''})

[이름 분석]
한자: ${familyHanja}(${familyKr}) · ${h1.h}(${h1.kr}) · ${h2?h2.h+'('+h2.kr+')':''}
자원오행: ${h1.o}${h2?'+'+h2.o:''} / 원획법: ${familyHanja} ${s0}획 · ${h1.h} ${s1}획${h2?' · '+h2.h+' '+s2+'획':''}
한자 뜻: ${h1.kr}(${h1.h}) = ${h1.m}${h2?' / '+h2.kr+'('+h2.h+') = '+h2.m:''}
사격수리: 원격 ${getSuriInfo(g1)} / 형격 ${getSuriInfo(g2)} / 이격 ${getSuriInfo(g3)} / 정격 ${getSuriInfo(g4)}
종합 점수: ${score}/100점

[부모 희망 성향]
${traitStr}

아래 JSON 구조로 정확하게 반환해주세요:
{
  "tagline": "핵심 한 줄 서사 (따옴표로 감싼 시적 표현, 20~40자)",
  "sajuAnalysis": "사주 분석 2~3문장. 일주를 중심으로 아이의 타고난 기질과 사주 지형 설명",
  "namingLogic": "왜 이 이름이어야 하는지 2~3문장. 사주 보완 + 자원오행 처방 논리",
  "hanjaDetails": [
    {
      "hanja": "한자 글자",
      "kr": "한글 음",
      "meaning": "뜻 풀이 (2~3문장)",
      "strokes": 획수,
      "oheng": "자원오행",
      "synergyWithSaju": "사주와의 시너지 1~2문장"
    }
  ],
  "lifeFlow": {
    "early": "초년(원격) 흐름 1문장",
    "middle": "청중년(형격·이격) 흐름 1문장",
    "late": "말년(정격) 흐름 1문장"
  },
  "careerAdvice": "진로·직업 추천 1~2가지와 이유",
  "healthAdvice": "건강·생활 조언 1문장 (사주 오행 기반)"
}`;

  // 프록시 서버 우선 → 없으면 브라우저 직접 호출 (개발용)
  const PROXY_URL   = '/proxy/claude';
  const DIRECT_URL  = 'https://api.anthropic.com/v1/messages';
  const DIRECT_HEADERS = {
    'Content-Type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  });

  try {
    // 1차: 프록시 시도
    let response;
    try {
      response = await fetch(PROXY_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body
      });
      if (!response.ok && response.status === 404) throw new Error('proxy_not_found');
    } catch (proxyErr) {
      // 프록시 없음 → 직접 호출 (브라우저 CORS 헤더 필요)
      console.info('[DearName] 프록시 미사용 → 직접 API 호출');
      response = await fetch(DIRECT_URL, {
        method: 'POST', headers: DIRECT_HEADERS, body
      });
    }

    if (!response.ok) throw new Error(`API ${response.status}`);

    const data = await response.json();
    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    const clean = text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.error('generatePremiumReport 오류:', err);
    // 파싱 실패 시 기본 소견서 반환
    return {
      tagline: `"${nameKr}, 맑고 깊은 기운으로 세상을 밝히다"`,
      sajuAnalysis: `${_saju?.day?.gan||''}${_saju?.day?.ji||''}일주의 기질을 바탕으로, 사주의 균형을 완성하는 이름입니다.`,
      namingLogic: `자원오행 ${h1.o}${h2?'+'+h2.o:''}의 기운이 사주의 필요를 정확히 보완합니다.`,
      hanjaDetails: [
        { hanja:h1.h, kr:h1.kr, meaning:h1.m, strokes:h1.s, oheng:h1.o, synergyWithSaju:'' },
        ...(h2 ? [{ hanja:h2.h, kr:h2.kr, meaning:h2.m, strokes:h2.s, oheng:h2.o, synergyWithSaju:'' }] : [])
      ],
      lifeFlow: { early:'탄탄한 기초를 쌓는 시기', middle:'사회에서 능력을 발휘하는 시기', late:'결실을 거두는 시기' },
      careerAdvice: '다양한 분야에서 잠재력을 발휘할 수 있습니다.',
      healthAdvice: '규칙적인 생활로 타고난 기운을 보전하세요.'
    };
  }
}

/**
 * 여러 후보를 병렬로 처리 (최대 3개)
 */
async function generateAllReports(candidates, state) {
  const top = candidates.slice(0, 3);
  return Promise.all(top.map(c => generatePremiumReport(c, state)));
}
