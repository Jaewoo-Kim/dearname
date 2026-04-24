// lib/name-spec.js
// 사주 오행 점수 → NameSpec(이름 설계도) 생성
// 기획서 3단계 우선순위: 긴급진단 → 특수격 → 일반격 중화

const CONTROLLERS = {'木':'金','火':'水','土':'木','金':'火','水':'土'};
const SUPPORTERS  = {'木':'水','火':'木','土':'火','金':'土','水':'金'};
const MEDIATORS   = {
  '木土':'火','土木':'火','火金':'土','金火':'土',
  '土水':'金','水土':'金','金木':'水','木金':'水','水火':'木','火水':'木'
};
const SPECIAL_GUK_NAMES = {
  '木':'종왕/종강격','火':'종아격','土':'전왕격','金':'종재격','水':'종살격'
};

/**
 * 사주 + 오행 점수 → NameSpec
 * @param {Object} saju  { year, month, day, time } 각 { gan, ji }
 * @param {Object} scores { '木':n, '火':n, '土':n, '金':n, '水':n }
 * @param {Object} [daeun] calcDaeun() 결과 (선택)
 * @returns {Object} { prefer:[], avoid:[], minCount:{}, strategy, gridType, diagnosis:[] }
 */
function buildNameSpec(saju, scores, daeun) {
  const prefer = [];
  const avoid  = [];
  const diagnosis = []; // 긴급진단 결과 메모

  // ══════════════════════════════════════════
  // 1순위: 긴급진단
  // ══════════════════════════════════════════

  // 조후(調候): 월지 기준 온도 긴급
  const monthJi = saju?.month?.ji || '';
  const HOT  = ['巳','午','未'];
  const COLD = ['亥','子','丑'];
  if (HOT.includes(monthJi) && scores['水'] < 5) {
    if (!prefer.includes('水')) prefer.push('水');
    diagnosis.push({ type:'조후', msg:'여름 태생 + 水 극약 → 水 최우선 배치' });
  }
  if (COLD.includes(monthJi) && scores['火'] < 5) {
    if (!prefer.includes('火')) prefer.push('火');
    diagnosis.push({ type:'조후', msg:'겨울 태생 + 火 극약 → 火 최우선 배치' });
  }

  // 통관(通關): 상극 두 오행이 각 25점 이상 대립
  const PAIRS = [['木','土'],['火','金'],['土','水'],['金','木'],['水','火']];
  for (const [e1,e2] of PAIRS) {
    if (scores[e1] >= 25 && scores[e2] >= 25) {
      const med = MEDIATORS[e1+e2];
      if (med && !prefer.includes(med)) {
        prefer.push(med);
        diagnosis.push({ type:'통관', msg:`${e1}↔${e2} 전쟁 → ${med}으로 중재` });
      }
    }
  }

  // 고립(孤立): 오행 점수 5점 미만이고 극하는 오행이 40점 이상
  for (const [oheng, score] of Object.entries(scores)) {
    if (score < 5) {
      const ctrl = CONTROLLERS[oheng];
      if (scores[ctrl] >= 40) {
        const sup = SUPPORTERS[oheng];
        if (sup && !prefer.includes(sup)) {
          prefer.push(sup);
          diagnosis.push({ type:'고립', msg:`${oheng} 고립 + ${ctrl} 압도 → ${sup} 긴급 수혈` });
        }
      }
    }
  }

  // ══════════════════════════════════════════
  // 2순위: 특수격(종격) — 60점 이상 + 극오행 5점 미만
  // ══════════════════════════════════════════
  for (const [oheng, score] of Object.entries(scores)) {
    if (score < 60) continue;
    const ctrl = CONTROLLERS[oheng];
    if (scores[ctrl] < 5) {
      const sup = SUPPORTERS[oheng];
      return {
        prefer:   [oheng, sup].filter(Boolean),
        avoid:    [ctrl],
        minCount: { [oheng]: 1 },
        strategy: 'reinforce',
        gridType: SPECIAL_GUK_NAMES[oheng] || '특수격',
        diagnosis
      };
    }
  }

  // ══════════════════════════════════════════
  // 2.5순위: 대운 흐름 보완 (중년/말년 약운 보강)
  // ══════════════════════════════════════════
  if (daeun?.cycles?.length) {
    // 중년(35~60): 가중치 1, 말년(60~): 가중치 2
    const weakInLate = {};
    for (const cycle of daeun.cycles) {
      let weight = 0;
      if (cycle.startAge >= 35 && cycle.startAge < 60) weight = 1;
      else if (cycle.startAge >= 60) weight = 2;
      if (!weight) continue;

      // 이 대운 기간의 오행이 약한지 판단
      for (const [o, s] of Object.entries(cycle.ohengScores)) {
        if (s < 20) weakInLate[o] = (weakInLate[o] || 0) + weight;
      }
    }
    // 가중합 3 이상인 오행을 prefer에 추가 (이미 있으면 제외)
    for (const [o, w] of Object.entries(weakInLate).sort((a,b)=>b[1]-a[1])) {
      if (w >= 3 && !prefer.includes(o) && !avoid.includes(o)) {
        prefer.push(o);
      }
    }
  }

  // ══════════════════════════════════════════
  // 3순위: 일반격 중화 — 부족 보완, 과다 배제
  // ══════════════════════════════════════════
  const sorted = Object.entries(scores).sort((a,b) => a[1]-b[1]);
  for (const [oheng, score] of sorted) {
    const st = getSeoryeokStatus(score);
    if ((st==='extreme_weak'||st==='weak')      && !prefer.includes(oheng)) prefer.push(oheng);
    if ((st==='strong'||st==='extreme_strong')  && !avoid.includes(oheng))  avoid.push(oheng);
  }

  const fp = prefer.slice(0, 2);
  return {
    prefer:   fp,
    avoid:    avoid.slice(0, 2),
    minCount: fp.reduce((a,o)=>({...a,[o]:1}),{}),
    strategy: 'balance',
    gridType: 'general',
    diagnosis
  };
}
