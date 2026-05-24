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
 * 억부법(抑扶法) 용신 계산
 * 일간 강약(신강/신약/중화)을 판단하고 용신·희신·기신을 반환
 * @param {Object} saju   { year, month, day, time } 각 { gan, ji }
 * @param {Object} scores { '木':n, '火':n, '土':n, '金':n, '水':n }
 * @returns {Object|null} 용신 분석 결과, 일간 불명 시 null
 */
function calcYongsin(saju, scores) {
  const _CGAN_OHG = {
    '甲':'木','乙':'木','丙':'火','丁':'火','戊':'土',
    '己':'土','庚':'金','辛':'金','壬':'水','癸':'水'
  };
  const dayGan   = saju?.day?.gan || '';
  const dayOheng = _CGAN_OHG[dayGan];
  if (!dayOheng) return null;

  // 식상(食傷): 일간이 생하는 오행
  const _SIK = {'木':'火','火':'土','土':'金','金':'水','水':'木'};
  // 재성(財星): 일간이 극하는 오행
  const _JAE = {'木':'土','火':'金','土':'水','金':'木','水':'火'};

  const inOheng   = SUPPORTERS[dayOheng];   // 인성: 일간을 生하는
  const bikOheng  = dayOheng;               // 비겁: 일간과 같은
  const sikOheng  = _SIK[dayOheng];         // 식상: 일간이 生하는
  const jaeOheng  = _JAE[dayOheng];         // 재성: 일간이 克하는
  const gwanOheng = CONTROLLERS[dayOheng];  // 관살: 일간을 克하는

  const inbiScore = (scores[inOheng]   || 0) + (scores[bikOheng]  || 0);
  const sjgScore  = (scores[sikOheng]  || 0) + (scores[jaeOheng]  || 0)
                  + (scores[gwanOheng] || 0);

  const isGangShin = inbiScore > sjgScore  * 1.2;
  const isYakShin  = sjgScore  > inbiScore * 1.2;

  let yongsinOheng = null;
  let heesinOheng  = null;
  let gisinOheng   = null;
  let desc;

  if (isGangShin) {
    // 신강: 식재관 중 가장 약한 오행이 용신
    const cands = [
      [sikOheng,  scores[sikOheng]  || 0],
      [jaeOheng,  scores[jaeOheng]  || 0],
      [gwanOheng, scores[gwanOheng] || 0]
    ];
    cands.sort((a, b) => a[1] - b[1]);
    yongsinOheng = cands[0][0];
    desc = `신강(인비 ${inbiScore.toFixed(1)}pt > 식재관 ${sjgScore.toFixed(1)}pt) — ${yongsinOheng} 용신`;
  } else if (isYakShin) {
    // 신약: 인비 중 가장 약한 오행이 용신 (인성 우선 배열)
    const cands = [
      [inOheng,  scores[inOheng]  || 0],
      [bikOheng, scores[bikOheng] || 0]
    ];
    cands.sort((a, b) => a[1] - b[1]);
    yongsinOheng = cands[0][0];
    desc = `신약(식재관 ${sjgScore.toFixed(1)}pt > 인비 ${inbiScore.toFixed(1)}pt) — ${yongsinOheng} 용신`;
  } else {
    // 중화(中和): 용신 불필요
    desc = `중화(인비 ${inbiScore.toFixed(1)}pt ≈ 식재관 ${sjgScore.toFixed(1)}pt) — 균형 유지`;
  }

  if (yongsinOheng) {
    heesinOheng = SUPPORTERS[yongsinOheng];   // 희신: 용신을 生하는
    gisinOheng  = CONTROLLERS[yongsinOheng];  // 기신: 용신을 克하는
  }

  return {
    dayGan, dayOheng,
    inOheng, bikOheng, sikOheng, jaeOheng, gwanOheng,
    inbiScore, sjgScore,
    isGangShin, isYakShin,
    yongsinOheng,
    heesinOheng,
    gisinOheng,
    desc
  };
}

/**
 * 사주 + 오행 점수 → NameSpec
 * @param {Object} saju  { year, month, day, time } 각 { gan, ji }
 * @param {Object} scores { '木':n, '火':n, '土':n, '金':n, '水':n }
 * @param {Object} [daeun] calcDaeun() 결과 (선택)
 * @returns {Object} { prefer:[], avoid:[], minCount:{}, strategy, gridType, diagnosis:[], yongsin }
 */
function buildNameSpec(saju, scores, daeun) {
  const prefer = [];
  const avoid  = [];
  const diagnosis = []; // 긴급진단 결과 메모

  // ══════════════════════════════════════════
  // 1순위: 긴급진단
  // ══════════════════════════════════════════

  // 조후(調候): 월지 기준 온도 긴급 (임계값 15점)
  const monthJi = saju?.month?.ji || '';
  const HOT  = ['巳','午','未'];
  const COLD = ['亥','子','丑'];
  if (HOT.includes(monthJi) && scores['水'] < 15) {
    if (!prefer.includes('水')) prefer.push('水');
    diagnosis.push({ type:'조후', msg:'여름 태생 + 水 부족 → 水 최우선 배치' });
  }
  if (COLD.includes(monthJi) && scores['火'] < 15) {
    if (!prefer.includes('火')) prefer.push('火');
    diagnosis.push({ type:'조후', msg:'겨울 태생 + 火 부족 → 火 최우선 배치' });
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
  // 1.5순위: 억부법(抑扶法) 용신 계산
  // ══════════════════════════════════════════
  const _yongsinResult = calcYongsin(saju, scores);
  if (_yongsinResult && _yongsinResult.yongsinOheng) {
    diagnosis.push({
      type: '억부',
      msg:  `${_yongsinResult.desc} / 희신:${_yongsinResult.heesinOheng||'-'} 기신:${_yongsinResult.gisinOheng||'-'}`
    });
    // 긴급진단이 prefer를 채우지 않았을 때만 용신·희신 추가
    if (prefer.length === 0) {
      if (!prefer.includes(_yongsinResult.yongsinOheng)) prefer.push(_yongsinResult.yongsinOheng);
      if (_yongsinResult.heesinOheng && !prefer.includes(_yongsinResult.heesinOheng))
        prefer.push(_yongsinResult.heesinOheng);
      if (_yongsinResult.gisinOheng && !avoid.includes(_yongsinResult.gisinOheng))
        avoid.push(_yongsinResult.gisinOheng);
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
        diagnosis,
        yongsin: _yongsinResult
      };
    }
  }

  // ══════════════════════════════════════════
  // 2.5순위: 대운 흐름 보완 (중년/말년 약운 보강)
  // ══════════════════════════════════════════
  if (daeun?.cycles?.length) {
    const weakInLate = {};
    for (const cycle of daeun.cycles) {
      let weight = 0;
      if (cycle.startAge >= 35 && cycle.startAge < 60) weight = 1;
      else if (cycle.startAge >= 60) weight = 2;
      if (!weight) continue;
      for (const [o, s] of Object.entries(cycle.ohengScores)) {
        if (s < 20) weakInLate[o] = (weakInLate[o] || 0) + weight;
      }
    }
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
    diagnosis,
    yongsin: _yongsinResult
  };
}
