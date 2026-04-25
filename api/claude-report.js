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

async function generatePremiumReport(candidate, state) {
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
  // 부모 오행 정보 → 읽기 좋은 문자열로 변환
  const _ohengKr = {'木':'목(나무)','火':'화(불)','土':'토(흙)','金':'금(쇠)','水':'수(물)'};
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

  const systemPrompt =
`당신은 30년 경력의 최고 명리학 대가이자 작명 전문가입니다.
서버가 계산한 명리학적 팩트를 바탕으로, 부모님의 마음을 따뜻하게 울리는 품격 있는 작명 소견서를 작성합니다.
규칙:
- 중학생도 이해할 수 있는 쉬운 언어 사용
- 어려운 한자 용어는 반드시 () 안에 풀이
- 자원오행(字源五行)과 원획법(原劃法) 획수를 근거로 구체적으로 설명
- 수치 데이터(획수, 점수)를 자연스럽게 서술에 녹임
- 각 필드는 지정된 분량을 지켜 충분히 풍부하게 작성
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
${parentOhengStr ? `\n[부모 오행 분석]\n${parentOhengStr}` : ''}
${specialRequest ? `\n[부모 특별 요청사항]\n${specialRequest}` : ''}

[부모 희망 성향]
${traitStr}

아래 JSON 구조로 정확하게 반환해주세요 (각 필드의 분량 지침 준수):
{
  "tagline": "핵심 한 줄 시그니처 (따옴표로 감싼 시적 표현, 20~40자)",
  "sajuStory": "사주 원국 서사. 일주를 중심으로 아이의 타고난 기질, 사주 지형의 특징, 부족한 기운과 넘치는 기운의 의미를 3~4문장으로 풍부하게 서술. 부모가 읽으면 고개를 끄덕이게 되는 이야기여야 함.",
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
  "soundStory": "이름의 발음 오행(초성)과 음양(모음) 배합이 주는 소리의 에너지를 2~3문장으로 묘사. 소리가 귀에 닿을 때의 느낌을 감각적으로 표현.",
  "suriStory": "수리 기반 인생 흐름 서사. 초년→청년→장년→말년이 자연스럽게 이어지는 하나의 인생 이야기로 2~3문장.",
  "lifeFlow": {
    "early": "초년기(0~20대) — 이 이름의 기운이 아이의 성장기에 구체적으로 어떻게 발현되는지 1~2문장. 수리와 자원오행을 근거로.",
    "middle": "청중년기(20~50대) — 사회 진출 후 이름의 기운이 어떤 방향으로 꽃피는지 1~2문장. 직업·인간관계 관련.",
    "late": "말년기(50대~) — 평생 이 이름을 가진 사람이 맞이할 결실과 지혜의 시기 1~2문장."
  },
  "conclusionLetter": "작명가의 총평 편지. 왜 이 이름이 이 아이에게 최선인지, 이 이름과 함께할 아이의 미래에 대한 진심 어린 축원. 3~4문장. 부모가 읽고 감동받을 수 있도록.",
  "careerAdvice": "진로·직업 추천 1~2가지와 이유 (1~2문장)",
  "healthAdvice": "건강·생활 조언 1문장 (사주 오행 기반)"
}`;

  const PROXY_URL   = '/proxy/claude';
  const DIRECT_URL  = 'https://api.anthropic.com/v1/messages';
  const DIRECT_HEADERS = {
    'Content-Type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true'
  };

  const body = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system: systemPrompt,
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
    const text = data.content
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');

    const clean = text.replace(/```json\s*/g,'').replace(/```\s*/g,'').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.error('generatePremiumReport 오류:', err);
    return {
      tagline: `"${nameKr}, 맑고 깊은 기운으로 세상을 밝히다"`,
      sajuStory: `${_saju?.day?.gan||''}${_saju?.day?.ji||''}일주의 아이는 독특한 기질과 감수성을 타고났습니다. 사주 원국의 오행 분포를 살펴보면 특정 기운이 강하고 일부가 부족한 지형을 보이는데, 이것이 바로 이름으로 보완해야 할 핵심 과제입니다. 이 사주가 지닌 가능성을 이름이 어떻게 열어주는지 함께 살펴봅니다.`,
      jawonStory: `자원오행 ${h1.o}${h2?'+'+h2.o:''}의 기운이 사주의 필요를 정확히 보완합니다. 이 이름의 한자들이 부족한 기운을 채워 아이의 타고난 잠재력이 더욱 빛날 수 있도록 돕습니다.`,
      hanjaDetails: [
        { hanja:h1.h, kr:h1.kr, meaning:h1.m, strokes:h1.s, oheng:h1.o, synergyWithSaju:'이 한자의 기운이 사주와 조화를 이룹니다.' },
        ...(h2 ? [{ hanja:h2.h, kr:h2.kr, meaning:h2.m, strokes:h2.s, oheng:h2.o, synergyWithSaju:'이 한자가 사주의 균형을 완성합니다.' }] : [])
      ],
      hanjaStory: `이 이름을 풀어쓰면, ${h1.kr}(${h1.h})의 ${h1.m} 기운과${h2 ? ' '+h2.kr+'('+h2.h+')의 '+h2.m+' 기운이' : ''} 하나로 어우러져 아이의 이름이 됩니다. 부를 때마다 이 기운들이 아이를 감싸줄 것입니다.`,
      soundStory: '이름을 소리 내어 부를 때, 초성의 기운이 자연스럽게 이어지며 에너지의 흐름을 만들어냅니다. 모음의 음양 배합도 균형 잡혀 있어 귀에 닿는 소리가 부드럽고 편안합니다.',
      suriStory: '초년에 탄탄한 기초를 쌓고, 청·장년기에 사회에서 능력을 발휘하며, 말년에는 깊은 지혜와 풍요로운 결실을 거두는 인생의 흐름이 수리에 담겨 있습니다.',
      lifeFlow: {
        early:  '이름의 기운이 씨앗처럼 뿌리를 내리며, 밝고 건강한 성장의 토대를 만들어가는 시기입니다.',
        middle: '이름의 자원오행이 사회적 활동 무대에서 빛을 발하며 직업과 인간관계에 긍정적으로 작용합니다.',
        late:   '수십 년의 노력이 아름다운 결실로 맺히며, 이름이 품은 깊은 기운이 지혜와 인덕으로 꽃피는 시기입니다.'
      },
      conclusionLetter: `${nameKr}이라는 이름은 이 아이의 사주가 필요로 하는 기운을 정확히 담고 있습니다. 평생 불릴 이 이름이 아이에게 든든한 동반자가 되어, 어떤 어려움도 이겨낼 힘이 되어주길 바랍니다. 이 이름과 함께 아이가 건강하고 행복하게 자라나길 진심으로 축원합니다.`,
      careerAdvice: '다양한 분야에서 잠재력을 발휘할 수 있습니다.',
      healthAdvice: '규칙적인 생활로 타고난 기운을 보전하세요.'
    };
  }
}

async function generateAllReports(candidates, state) {
  const top = candidates.slice(0, 3);
  return Promise.all(top.map(c => generatePremiumReport(c, state)));
}
