// lib/name-search-worker.js
// Web Worker: 이름 탐색 연산을 메인 스레드 밖에서 실행
// 메인 스레드 UI 블로킹 완전 제거

// ── 채점 순수 모듈 로드 (단일 진실 공급원) ────────────────
// NameScore.scoreCombo 로 컴포넌트 A~K 채점 로직을 위임.
// (importScripts 는 worker 스크립트 위치 기준 → lib/name-score.js)
importScripts('name-score.js');

// ── Worker 내부 데이터 (postMessage로 수신) ──────────────
let HANJA_DB              = null;
let BULYONG               = null;
let SURI_DATA             = null;
let DAEUN                 = null;
let MODERN_SYLLABLE_SCORE = null;  // 현대 음절 인기 점수
let OLDFASHIONED_SET      = null;  // 구식 음절 Set

// ── 현대 작명가 금기 한자 (凶·死·鬼 계열 부정적 의미) ───────
// BULYONG_HANJA(획수 불용)와 별도로, 뜻이 불길하거나 부정적인 한자를 Pool에서 제거.
// 기본값(하드코딩)이며, 메인 스레드가 INIT 시 payload.taboo를 함께 보내주면
// 어드민에서 관리하는 최신 목록(GET /api/taboo-hanja)으로 교체된다.
let TABOO_HANJA = new Set([
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

// ── 분파(分破) 한자 / 운 중심 수리 맵은 채점 로직 전용 →
//    lib/name-score.js(NameScore) 로 이전됨 (단일 진실 공급원).

// ── 메시지 수신 핸들러 ────────────────────────────────────
self.onmessage = function(e) {
  const { type, payload } = e.data;

  switch (type) {
    case 'INIT':
      // 메인 스레드에서 데이터 전달받아 초기화
      HANJA_DB              = payload.hanjaDB;
      BULYONG               = payload.bulyong || [];
      if (Array.isArray(payload.taboo) && payload.taboo.length) {
        TABOO_HANJA = new Set(payload.taboo);
      }
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

// ── 핵심 탐색 로직 ───────────────────────────────────────────
function _search(state) {
  const { nameSpec, familyName, constraints, searchControl } = state;
  if (!nameSpec || !familyName?.kr) return [];

  const pool = _buildPool(nameSpec);
  const MAX_POOL = 1500;
  const pool1 = pool.length > MAX_POOL ? _samplePool(pool, nameSpec, MAX_POOL) : pool;

  const maxResults      = searchControl.maxResults ?? 5;
  const baseThreshold   = searchControl.qualityThreshold ?? 60;
  const isOija          = constraints.nameType === 1;
  const _run = (thr) => isOija
    ? _searchOija(pool1, familyName, nameSpec, constraints, state, maxResults, thr)
    : _searchTwoChar(pool1, familyName, nameSpec, constraints, state, maxResults, thr);

  // 단계적 threshold 완화 — 항상 결과 보장
  // (엄격한 조건부터 시작해 조건을 낮춰가며 결과가 나올 때까지 재탐색)
  for (const thr of [baseThreshold, 40, 20, 0, -50, -200]) {
    const results = _run(thr);
    if (results.length > 0) return results;
  }
  return [];
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

      if (score < threshold) continue;
      results.push({ ...combo, score });

      // 조기 종료: 충분한 고품질 결과 확보.
      // 예전에는 maxResults*4(=20)에서 멈췄는데, 그 정도로는 상위 5개가 전부 동점이 되는
      // 경우가 많아 사실상 먼저 발견된 순서로 뽑혔다. 후보를 더 모아야 점수가 변별력을 갖는다.
      if (results.length >= maxResults * 12) {
        return _pickBest(results, familyName, maxResults);
      }
    }
  }

  return _pickBest(results, familyName, maxResults);
}

// ── 최종 선별 ─────────────────────────────────────────────
// 구조 지표(사격수리·발음오행·수리오행·발음음양·수리음양)에 '나쁨'이 없는 후보를 먼저 채우고,
// 모자랄 때만 나머지를 점수순으로 채운다. 추천된 이름에 나쁨 배지가 붙는 일을 없애기 위함이다.
function _pickBest(results, familyName, maxResults) {
  const deps = { SURI_DATA };
  const clean = [], rest = [];
  for (const r of results) {
    const bucket = NameScore.hasBadIndicator(r, familyName, deps) ? rest : clean;
    bucket.push(r);
  }
  clean.sort((a, b) => b.score - a.score);
  rest.sort((a, b) => b.score - a.score);
  return [...clean, ...rest].slice(0, maxResults);
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

  return _pickBest(results, familyName, maxResults);
}

// ── 점수 계산 — lib/name-score.js(NameScore) 위임 ─────────
// 채점 로직(컴포넌트 A~K + 하드필터)의 단일 진실 공급원은 NameScore.scoreCombo.
// Worker 의 모듈 레벨 데이터(SURI_DATA 등)를 deps 로 주입해 호출.
function _scoreCombo(combo, nameSpec, familyName, state) {
  return NameScore.scoreCombo(combo, nameSpec, familyName, state, {
    SURI_DATA,
    MODERN_SYLLABLE_SCORE,
    OLDFASHIONED_SET: OLDFASHIONED_SET
  });
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
