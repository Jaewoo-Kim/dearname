// lib/name-search-worker.js
// Web Worker: 이름 탐색 연산을 메인 스레드 밖에서 실행
// 메인 스레드 UI 블로킹 완전 제거

// ── Worker 내부 데이터 (postMessage로 수신) ──────────────
let HANJA_DB   = null;
let BULYONG    = null;
let SURI_DATA  = null;
let DAEUN      = null;

// ── 메시지 수신 핸들러 ────────────────────────────────────
self.onmessage = function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT':
      // 메인 스레드에서 데이터 전달받아 초기화
      HANJA_DB  = payload.hanjaDB;
      BULYONG   = payload.bulyong || [];
      SURI_DATA = payload.suriData;
      DAEUN     = payload.daeun || null;
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

  // 1패스: Prefer 오행만 (핵심 pool)
  for (const [kr, list] of Object.entries(HANJA_DB)) {
    for (const h of list) {
      if (!h.h || !h.o || h.s <= 0) continue;
      if (avoid.includes(h.o)) continue;
      if (BULYONG.includes(h.h)) continue;
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
