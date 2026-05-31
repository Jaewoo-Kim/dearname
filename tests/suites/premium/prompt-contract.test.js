/**
 * suites/premium/prompt-contract.test.js
 * [프리미엄] buildUserPrompt — 프롬프트 계약(contract) 검증.
 *   LLM 산출물(서술)은 단언하지 않는다. 대신 Claude 에게 전달되는 userPrompt 에
 *   '필수 팩트'와 'JSON 응답 스키마'가 빠짐없이 들어있는지를 검증한다.
 *   프롬프트가 요청하는 필드 ↔ 폴백(catch) 반환 키가 일치해야 계약이 성립한다.
 */

suite('[LOGIC] buildUserPrompt — 프롬프트 계약(필수 팩트)');
{
  // 엔진으로 실제 사주/점수/NameSpec 생성 (결정적)
  const raw      = calcSaju('1990-02-16','16:20',{});
  const scores   = calcOhengScores(raw);
  const nameSpec = buildNameSpec(raw, scores);

  const candidate = {
    h1: { s: 8, kr: '서', h: '瑞', m: '상서로움', o: '金' },
    h2: { s: 9, kr: '연', h: '娟', m: '아름다움', o: '土' },
    s0: 3, score: 88, familyKr: '김', familyHanja: '金'
  };
  const state = {
    nameSpec, constraints: { traits: [1, 2] },
    _saju: raw, _scores: scores
  };

  const p = buildUserPrompt(candidate, state);

  // 이름(한글/한자)
  assert(p.includes('김서연'), '한글 이름(김서연) 포함');
  assert(p.includes('金瑞娟'), '한자 이름(金瑞娟) 포함');

  // 사주 원국 — 일주
  assert(p.includes(`${raw.day.gan}${raw.day.ji}`), `일주(${raw.day.gan}${raw.day.ji}) 포함`);

  // 핵심 섹션 헤더
  assert(p.includes('[오행 분석]'), '[오행 분석] 섹션 포함');
  assert(p.includes('[이름 분석]'), '[이름 분석] 섹션 포함');
  assert(p.includes('[조후(調候) 판정]'), '[조후] 섹션 포함');
  assert(p.includes('[용신(用神) 분석'), '[용신] 섹션 포함');

  // NameSpec prefer/avoid 노출
  assert(p.includes('Prefer') && p.includes('Avoid'), 'NameSpec Prefer/Avoid 포함');

  // 자원오행 (h1.o + h2.o)
  assert(p.includes('金+土'), '자원오행(金+土) 포함');

  // 사격 수리 4격
  assert(p.includes('원격') && p.includes('형격') && p.includes('이격') && p.includes('정격'),
    '사격 수리(원/형/이/정) 포함');

  // 종합 점수
  assert(p.includes('88/100'), '종합 점수(88/100) 포함');

  // 부모 희망 성향 — TRAIT_LABELS 매핑 (1=리더십, 2=지혜)
  assert(p.includes('리더십') && p.includes('지혜'), '희망 성향(traits) 매핑 포함');
}

suite('[LOGIC] buildUserPrompt — JSON 응답 스키마 계약');
{
  const raw      = calcSaju('1990-02-16','16:20',{});
  const scores   = calcOhengScores(raw);
  const nameSpec = buildNameSpec(raw, scores);
  const candidate = {
    h1: { s: 8, kr: '서', h: '瑞', m: '상서로움', o: '金' },
    h2: { s: 9, kr: '연', h: '娟', m: '아름다움', o: '土' },
    s0: 3, score: 88, familyKr: '김', familyHanja: '金'
  };
  const p = buildUserPrompt(candidate, { nameSpec, constraints: {}, _saju: raw, _scores: scores });

  // 프롬프트가 요청하는 8개 서술 필드 = 폴백(catch) 반환 키와 일치해야 함
  ['tagline','sajuStory','jawonStory','hanjaDetails','hanjaStory','conclusionLetter','careerAdvice']
    .forEach(k => assert(p.includes(`"${k}"`), `JSON 스키마에 "${k}" 필드 요청 포함`));
}

suite('[LOGIC] buildUserPrompt — 외자(1글자) 이름 처리');
{
  const raw      = calcSaju('1990-02-16','16:20',{});
  const scores   = calcOhengScores(raw);
  const nameSpec = buildNameSpec(raw, scores);
  // h2 없음 (외자)
  const candidate = {
    h1: { s: 12, kr: '훈', h: '勳', m: '공로', o: '火' },
    h2: null, s0: 3, score: 77, familyKr: '이', familyHanja: '李'
  };
  const p = buildUserPrompt(candidate, { nameSpec, constraints: {}, _saju: raw, _scores: scores });
  assert(typeof p === 'string' && p.length > 100, '외자 이름도 프롬프트 정상 생성');
  assert(p.includes('이훈'), '외자 한글 이름(이훈) 포함');
  assert(p.includes('77/100'), '외자 종합 점수(77/100) 포함');
}
