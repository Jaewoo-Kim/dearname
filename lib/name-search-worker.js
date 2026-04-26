// lib/name-search-worker.js
// Web Worker: 이름 탐색 연산을 메인 스레드 밖에서 실행
// 메인 스레드 UI 블로킹 완전 제거

// ── Worker 내부 데이터 (postMessage로 수신) ──────────────
let HANJA_DB              = null;
let BULYONG               = null;
let SURI_DATA             = null;
let DAEUN                 = null;
let MODERN_SYLLABLE_SCORE = null;  // 현대 음절 인기 점수
let OLDFASHIONED_SET      = null;  // 구식 음절 Set

// ── 현대 작명가 금기 한자 (凶·死·鬼 계열 부정적 의미) ───────
// BULYONG_HANJA(획수 불용)와 별도로, 뜻이 불길하거나 부정적인 한자를 Pool에서 제거
const TABOO_HANJA = new Set([
  // 사망·귀신·재앙 계열
  '死','鬼','亡','殺','邪','禍','毒','凶','惡',
  // 비천함·죄·고통 계열
  '賤','奴','罪','貧','苦','怨','恨','悲','哭','泣',
  // 위험·쇠락 계열
  '危','破','敗','廢','末','窮','孤','暗',
  // 신체·정신 결함 계열 (이름에 부적합한 한자)
  '盲','啞','癡','狂','愚','劣','醜','陋','拙',
  // 모욕·착취 계열
  '辱','侮','欺','奸','賊','盜'
]);

// ── 운 중심 수리 맵 (81수리 설명 기반) ────────────────────
// 각 운 유형에 유리한 수리 번호 Set
const LUCK_SURI = {
  wealth:     new Set([6,15,16,21,24,25,29,39,41,47,52,57,61,65,67,70,72]),
  leadership: new Set([1,3,7,13,15,16,17,21,23,29,31,33,37,39,41,45,47,52,53,61,65,67]),
  wisdom:     new Set([3,11,13,21,35,38,41,45,48,53,57,61,65,68,72,73]),
  health:     new Set([1,5,6,8,11,15,16,21,24,25,31,35,37,39,41,45,48,52,65,70,73,75,78,80])
};

// ── 메시지 수신 핸들러 ────────────────────────────────────
self.onmessage = function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT':
      // 메인 스레드에서 데이터 전달받아 초기화
      HANJA_DB              = payload.hanjaDB;
      BULYONG               = payload.bulyong || [];
      SURI_DATA             = payload.suriData;
      DAEUN                 = payload.daeun || null;
      MODERN_SYLLABLE_SCORE = payload.modernSyllableScore || null;
      OLDFASHIONED_SET      = payload.oldfashionedSyllables
                                ? new Set(payload.oldfashionedSyllables)
                                : null;
      self.postMessage({ type: 'INIT_OK' });
      break;

    case 'SEARCH': {
      const searchState = { ...payload.state, daeun: payload.state.daeun || DAEUN };
      const results = _search(searchState);
      self.postMessage({ type: 'SEARCH_RESULT', payload: results });
      break;
    }

    case 'SEARCH_RELAXED': {
      const relaxedBase = { ...payload.state, daeun: payload.state.daeun || DAEUN };
      const relaxed = _getRelaxedState(relaxedBase);
      const results2 = _search(relaxed);
      self.postMessage({ type: 'SEARCH_RESULT', payload: results2, relaxedState: relaxed });
      break;
    }
  }
};

// ── 핵심 탐색 로직 (메인 스레드와 동일하나 Worker 내장 버전) ──
function _search(state) {
  const { nameSpec, familyName, constraints, searchControl } = state;
  if (!nameSpec || !familyName?.kr) return [];

  const pool = _buildPool(nameSpec);

  // 조기 종료: prefer 오행으로만 pool 구성해도 조합이 너무 많으면 샘플링
  const MAX_POOL = 1500;
  const pool1 = pool.length > MAX_POOL ? _samplePool(pool, nameSpec, MAX_POOL) : pool;

  const maxResults = searchControl.maxResults ?? 5;
  const threshold  = searchControl.qualityThreshold ?? 60;

  // 두 글자 / 외자 분기
  if (constraints.nameType === 1) {
    return _searchOija(pool1, familyName, nameSpec, constraints, state, maxResults, threshold);
  } else {
    return _searchTwoChar(pool1, familyName, nameSpec, constraints, state, maxResults, threshold);
  }
}

// ── Pool 생성 (Prefer 오행 우선 포함) ─────────────────────
function _buildPool(nameSpec) {
  if (!HANJA_DB) return [];
  const pool = [];
  const prefer = nameSpec.prefer || [];
  const avoid  = nameSpec.avoid  || [];

  const avoidKr = new Set(nameSpec.avoidKrSyllables || []);

  // 1패스: Prefer 오행만 (핵심 pool)
  for (const [kr, list] of Object.entries(HANJA_DB)) {
    for (const h of list) {
      if (!h.h || !h.o || h.s <= 0) continue;
      if (avoid.includes(h.o)) continue;
      if (BULYONG.includes(h.h)) continue;
      if (TABOO_HANJA.has(h.h)) continue;                  // 현대 금기 한자 제외
      if (avoidKr.size > 0 && avoidKr.has(kr)) continue;  // 친인척 동음 제외
      if (prefer.length === 0 || prefer.includes(h.o)) {
        pool.push({ kr, h:h.h, m:h.m, s:h.s, o:h.o });
      }
    }
  }

  // Prefer가 있는데 pool이 너무 작으면 2패스: Avoid만 제외
  if (prefer.length > 0 && pool.length < 200) {
    for (const [kr, list] of Object.entries(HANJA_DB)) {
      for (const h of list) {
        if (!h.h || !h.o || h.s <= 0) continue;
        if (avoid.includes(h.o)) continue;
        if (BULYONG.includes(h.h)) continue;
        if (TABOO_HANJA.has(h.h)) continue;                // 현대 금기 한자 제외
        if (avoidKr.size > 0 && avoidKr.has(kr)) continue;
        if (!prefer.includes(h.o)) {
          pool.push({ kr, h:h.h, m:h.m, s:h.s, o:h.o });
        }
      }
    }
  }

  return pool;
}

// ── Pool 샘플링 (너무 클 때 품질 우선 축소) ──────────────
function _samplePool(pool, nameSpec, maxSize) {
  const prefer = nameSpec.prefer || [];
  // prefer 오행 우선, 나머지는 균등 샘플
  const pref = pool.filter(h => prefer.includes(h.o));
  const rest = pool.filter(h => !prefer.includes(h.o));

  if (pref.length >= maxSize) return _shuffle(pref).slice(0, maxSize);

  const need = maxSize - pref.length;
  return [...pref, ..._shuffle(rest).slice(0, need)];
}

function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── 두 글자 탐색 (조기 종료 + 진행률 보고) ───────────────
function _searchTwoChar(pool, familyName, nameSpec, constraints, state, maxResults, threshold) {
  const { dolrim, hangryul } = constraints;
  const s0 = familyName.strokes || 0;

  const pool1 = dolrim?.hanja
    ? (dolrim.pos === 2 ? pool.filter(h => h.h === dolrim.hanja) : pool) : pool;
  const pool2 = dolrim?.hanja
    ? (dolrim.pos === 3 ? pool.filter(h => h.h === dolrim.hanja) : pool) : pool;
  const p1 = hangryul?.hanja
    ? (hangryul.pos === 2 ? pool1.filter(h => h.h === hangryul.hanja) : pool1) : pool1;
  const p2 = hangryul?.hanja
    ? (hangryul.pos === 3 ? pool2.filter(h => h.h === hangryul.hanja) : pool2) : pool2;

  const results = [];
  const total = p1.length * p2.length;
  let checked = 0;
  let lastProgress = 0;

  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      const h1 = p1[i], h2 = p2[j];
      if (h1.h === h2.h && h1.kr === h2.kr) { checked++; continue; }

      const combo = { h1, h2, s0, isOija: false,
        familyKr: familyName.kr, familyHanja: familyName.hanja };
      const score = _scoreCombo(combo, nameSpec, familyName, state);

      checked++;

      // 진행률 보고 (5%마다)
      const progress = Math.floor(checked / total * 100);
      if (progress >= lastProgress + 5) {
        lastProgress = progress;
        self.postMessage({ type: 'PROGRESS', payload: { progress, found: results.length } });
      }

      if (score < 0 || score < threshold) continue;
      results.push({ ...combo, score });

      // 조기 종료: 충분한 고품질 결과 확보
      if (results.length >= maxResults * 4) {
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, maxResults);
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

// ── 외자 탐색 ─────────────────────────────────────────────
function _searchOija(pool, familyName, nameSpec, constraints, state, maxResults, threshold) {
  const s0 = familyName.strokes || 0;
  const results = [];

  for (const h1 of pool) {
    const combo = { h1, h2: null, s0, isOija: true,
      familyKr: familyName.kr, familyHanja: familyName.hanja };
    const score = _scoreCombo(combo, nameSpec, familyName, state);
    if (score >= 0 && score >= threshold) results.push({ ...combo, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

// ── 점수 계산 (Worker 내장) ───────────────────────────────
const OHENG_CYCLE = ['木','火','土','金','水'];
const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const JUNGSUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const CHO_OHENG = {
  'ㄱ':'木','ㄲ':'木','ㅋ':'木',
  'ㄴ':'火','ㄷ':'火','ㄸ':'火','ㄹ':'火','ㅌ':'火',
  'ㅇ':'土','ㅎ':'土',
  'ㅅ':'金','ㅆ':'金','ㅈ':'金','ㅉ':'金','ㅊ':'金',
  'ㅁ':'水','ㅂ':'水','ㅃ':'水','ㅍ':'水'
};
const YANG_JUNG = new Set(['ㅏ','ㅑ','ㅗ','ㅛ','ㅐ','ㅒ','ㅘ','ㅙ','ㅚ']);

const TRAIT_MAP = {
  1:['金','火'], 2:['水','木'], 3:['土','木'],
  4:['金','水'], 5:['火','木'], 6:['金','土']
};

function _getCho(char) {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return '';
  return CHOSUNG[Math.floor(code / 588)];
}
function _getJung(char) {
  const code = char.charCodeAt(0) - 44032;
  if (code < 0 || code > 11171) return '';
  return JUNGSUNG[Math.floor((code % 588) / 28)];
}

function _scoreCombo(combo, nameSpec, familyName, state) {
  const { h1, h2, s0, isOija } = combo;
  const s1 = h1.s, s2 = h2 ? h2.s : 0;
  let score = 0;

  // [A] 자원오행 가점
  const ohengSet = [h1.o, h2?.o].filter(Boolean);
  for (const pref of (nameSpec.prefer || [])) {
    if (ohengSet.includes(pref)) score += 50;
  }
  if (nameSpec.prefer?.length > 0 && nameSpec.prefer.every(p => ohengSet.includes(p))) {
    score += 30;
  }

  // [B] 81수리 4격
  const g1 = isOija ? s1+1 : s1+s2;
  const g2 = s0+s1;
  const g3 = isOija ? s0+1 : s0+s2;
  const g4 = isOija ? s0+s1 : s0+s1+s2;

  const grades = [g1,g2,g3,g4].map(n => {
    let num = n > 81 ? n%81 : n;
    if (num === 0) num = 81;
    return SURI_DATA?.[num]?.grade || '평';
  });
  if (grades.some(g => g === '대흉')) return -999;
  score += grades.filter(g => g === '길').length * 5;

  // [C] 발음오행 상생
  const getO = (kr) => {
    if (!kr) return null;
    const cho = _getCho(kr);
    return CHO_OHENG[cho] || null;
  };
  const seq = [familyName.kr, h1.kr, h2?.kr].filter(Boolean).map(getO).filter(Boolean);
  for (let i = 0; i < seq.length - 1; i++) {
    const e1 = seq[i], e2 = seq[i+1];
    if (!e1 || !e2) continue;
    if (e1 === e2) { score += 5; continue; }
    const ia = OHENG_CYCLE.indexOf(e1), ib = OHENG_CYCLE.indexOf(e2);
    if ((ia+1)%5 === ib || (ib+1)%5 === ia) score += 10; // 순·역방향 상생 모두 인정
    else score -= 10;
  }

  // [D] 수리음양
  const strokes = [s0,s1,s2].filter(Boolean);
  if (strokes.length > 1) {
    const tags = strokes.map(s => s%2===0?'음':'양');
    if (!tags.every(t => t===tags[0])) score += 10;
  }

  // [E] 발음음양
  const chars = [familyName.kr, h1.kr, h2?.kr].filter(Boolean);
  if (chars.length > 1) {
    const yy = chars.map(c => { const j=_getJung(c); return YANG_JUNG.has(j)?'양':'음'; });
    if (!yy.every(t => t===yy[0])) score += 5;
  }

  // [F] 성향 보너스
  let bonus = 0;
  for (const t of (state.constraints?.traits || [])) {
    for (const o of (TRAIT_MAP[t] || [])) {
      if (ohengSet.includes(o)) bonus += 3;
    }
  }
  score += Math.min(bonus, 15);

  // [G] 대운 보완 가점 (중년/말년 약운을 이름이 보완하면)
  const daeun = state.daeun;
  if (daeun?.cycles?.length) {
    let daeunBonus = 0;
    for (const cycle of daeun.cycles) {
      let weight = 0;
      if (cycle.startAge >= 35 && cycle.startAge < 60) weight = 1;
      else if (cycle.startAge >= 60) weight = 2;
      if (!weight) continue;

      // 이름 오행이 약한 대운을 보완하면 보너스
      for (const o of ohengSet) {
        const daeunSc = cycle.ohengScores?.[o] || 0;
        if (daeunSc < 20) daeunBonus += weight * 3;
      }
      // 이름 오행이 강한 대운과 같으면 페널티 (과잉)
      for (const o of ohengSet) {
        const daeunSc = cycle.ohengScores?.[o] || 0;
        if (daeunSc > 50) daeunBonus -= weight * 2;
      }
    }
    score += Math.max(-20, Math.min(30, daeunBonus));
  }

  // [H] 운 중심 가점 — 4格 수리가 목표 운의 유리한 수리에 해당하면 보너스
  const luckFocus = state.constraints?.luckFocus;
  if (luckFocus && luckFocus !== 'balanced' && LUCK_SURI[luckFocus]) {
    const targetSet = LUCK_SURI[luckFocus];
    const suriNums  = [g1, g2, g3, g4].map(n => { let v = n > 81 ? n % 81 : n; return v === 0 ? 81 : v; });
    const hits      = suriNums.filter(n => targetSet.has(n)).length;
    score += hits * 8;  // 격당 최대 8점 × 4 = 32점 추가 가능
  }

  // [I] 부모 사주 조화 — 이름 오행이 부모의 지배 오행과 겹치면 소폭 패널티
  const parentOheng = state.parentOheng;
  if (parentOheng) {
    for (const p of ['father', 'mother']) {
      const dominant = parentOheng[p]?.dominant;   // e.g. '木'
      if (!dominant) continue;
      // 자녀 이름이 부모의 지배 오행을 더 증폭시키면 -5
      if (ohengSet.includes(dominant)) score -= 5;
      // 자녀 이름 오행이 부모의 결핍 오행을 보완하면 +5
      const weakest = parentOheng[p]?.weakest;
      if (weakest && ohengSet.includes(weakest)) score += 5;
    }
  }

  // [J] 현대 작명 금기 발음
  // ① 성씨와 이름 첫글자의 발음이 같으면 어색 (예: 박박민 → 박박X)
  if (h1.kr && familyName.kr && h1.kr === familyName.kr) score -= 30;
  // ② 이름 두 글자의 발음이 완전히 같으면 어색 (예: 민민 → X민민)
  if (!isOija && h2 && h1.kr && h2.kr && h1.kr === h2.kr) score -= 20;

  // [K] 현대성 보너스 (최대 +5점 / 최소 -5점)
  // 2020-2025 통계청 신생아 출생신고 기반 인기 음절 점수 적용
  if (MODERN_SYLLABLE_SCORE) {
    const s1Score = MODERN_SYLLABLE_SCORE[h1.kr] || 0;
    const s2Score = h2?.kr ? (MODERN_SYLLABLE_SCORE[h2.kr] || 0) : 0;
    const avgModern = h2?.kr ? (s1Score + s2Score) / 2 : s1Score;
    // 100점 → +5, 80점 → +4, 60점 → +3, 40점 → +2, 20점 → +1, 0점 → 0
    score += Math.round(avgModern / 20);
  }
  if (OLDFASHIONED_SET) {
    if (OLDFASHIONED_SET.has(h1.kr)) score -= 3;
    if (h2?.kr && OLDFASHIONED_SET.has(h2.kr)) score -= 3;
  }

  return Math.min(100, Math.max(0, score));
}

// ── 더보기: 조건 완화 ────────────────────────────────────
function _getRelaxedState(state) {
  return {
    ...state,
    searchControl: {
      ...state.searchControl,
      qualityThreshold: Math.max(0, (state.searchControl.qualityThreshold ?? 60) - 15),
      maxResults: (state.searchControl.maxResults ?? 5) + 5
    }
  };
}
