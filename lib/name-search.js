// lib/name-search.js
// 이름 탐색 엔진 — Web Worker 어댑터
// 무거운 연산은 name-search-worker.js(Worker)에서 실행
// 메인 스레드 UI 블로킹 없음

class NameSearchEngine {
  constructor() {
    this._worker   = null;
    this._ready    = false;
    this._initPromise = null;
    this._pendingResolve = null;
    this._onProgress = null;
  }

  // ── Worker 초기화 (최초 1회) ─────────────────────────────
  _ensureWorker() {
    if (this._initPromise) return this._initPromise;

    this._initPromise = new Promise((resolve, reject) => {
      try {
        this._worker = new Worker('lib/name-search-worker.js');
      } catch(e) {
        // Worker 생성 실패 시 메인 스레드 fallback으로 처리
        console.warn('[NameSearchEngine] Worker 생성 실패 → 메인스레드 fallback:', e);
        this._ready = false;
        resolve(false);
        return;
      }

      this._worker.onmessage = (e) => {
        const { type, payload, relaxedState } = e.data;

        if (type === 'INIT_OK') {
          this._ready = true;
          resolve(true);
        } else if (type === 'SEARCH_RESULT') {
          if (this._pendingResolve) {
            this._pendingResolve({ results: payload, relaxedState });
            this._pendingResolve = null;
          }
        } else if (type === 'PROGRESS') {
          if (this._onProgress) this._onProgress(payload);
        }
      };

      this._worker.onerror = (err) => {
        console.error('[NameSearchEngine] Worker 오류:', err);
        if (this._pendingResolve) {
          this._pendingResolve({ results: [], relaxedState: null });
          this._pendingResolve = null;
        }
      };

      // Worker에 데이터 전달
      this._worker.postMessage({
        type: 'INIT',
        payload: {
          hanjaDB:              typeof HANJA_DB_FULL !== 'undefined' ? HANJA_DB_FULL : {},
          bulyong:              typeof BULYONG_HANJA !== 'undefined' ? BULYONG_HANJA : [],
          // 어드민이 관리하는 금기 한자 목록(index.html이 /api/taboo-hanja로 미리 받아둠).
          // 없으면 undefined로 전달 → Worker가 자체 하드코딩 기본값을 그대로 사용.
          taboo:                (typeof TABOO_HANJA_OVERRIDE !== 'undefined' && Array.isArray(TABOO_HANJA_OVERRIDE))
                                  ? TABOO_HANJA_OVERRIDE
                                  : undefined,
          suriData:             typeof SURI_DATA !== 'undefined' ? SURI_DATA : [],
          modernSyllableScore:  typeof MODERN_SYLLABLE_SCORE !== 'undefined' ? MODERN_SYLLABLE_SCORE : null,
          oldfashionedSyllables: typeof OLDFASHIONED_SYLLABLES !== 'undefined' ? [...OLDFASHIONED_SYLLABLES] : []
        }
      });
    });

    return this._initPromise;
  }

  // ── 메인 탐색 (비동기, Worker) ──────────────────────────
  async search(state, onProgress) {
    this._onProgress = onProgress || null;

    const workerReady = await this._ensureWorker();

    // Worker 사용 불가 → 동기 fallback (메인 스레드)
    if (!workerReady || !this._worker) {
      console.warn('[NameSearchEngine] Worker 미사용 → 동기 실행');
      return this._searchSync(state);
    }

    return new Promise((resolve) => {
      this._pendingResolve = ({ results }) => resolve(results);
      this._worker.postMessage({ type: 'SEARCH', payload: { state } });
    });
  }

  // ── 더보기 (조건 완화 후 재탐색) ────────────────────────
  getRelaxedState(state) {
    return {
      ...state,
      searchControl: {
        ...state.searchControl,
        qualityThreshold: Math.max(0, (state.searchControl.qualityThreshold ?? 60) - 15),
        maxResults: (state.searchControl.maxResults ?? 5) + 5
      }
    };
  }

  async searchRelaxed(state, onProgress) {
    const relaxed = this.getRelaxedState(state);
    const results = await this.search(relaxed, onProgress);
    return { results, relaxedState: relaxed };
  }

  // ── 동기 fallback (Worker 불가 시) ──────────────────────
  _searchSync(state) {
    const { nameSpec, familyName, constraints, searchControl } = state;
    if (!nameSpec || !familyName?.kr || typeof HANJA_DB_FULL === 'undefined') return [];

    const prefer   = nameSpec.prefer || [];
    const avoid    = nameSpec.avoid  || [];
    const avoidKr  = new Set(nameSpec.avoidKrSyllables || []);
    const bulyong  = typeof BULYONG_HANJA !== 'undefined' ? BULYONG_HANJA : [];
    // 어드민이 관리하는 금기 한자 목록이 있으면 그걸 쓰고, 없으면 하드코딩 기본값 42자.
    const TABOO_HANJA_SYNC = (typeof TABOO_HANJA_OVERRIDE !== 'undefined' && Array.isArray(TABOO_HANJA_OVERRIDE) && TABOO_HANJA_OVERRIDE.length)
      ? new Set(TABOO_HANJA_OVERRIDE)
      : new Set([
        '死','鬼','亡','殺','邪','禍','毒','凶','惡',
        '賤','奴','罪','貧','苦','怨','恨','悲','哭','泣',
        '危','破','敗','廢','末','窮','孤','暗',
        '盲','啞','癡','狂','愚','劣','醜','陋','拙',
        '辱','侮','欺','奸','賊','盜'
      ]);
    const pool = [];

    for (const [kr, list] of Object.entries(HANJA_DB_FULL)) {
      for (const h of list) {
        if (!h.h || !h.o || h.s <= 0) continue;
        if (avoid.includes(h.o)) continue;
        if (bulyong.includes(h.h)) continue;
        if (TABOO_HANJA_SYNC.has(h.h)) continue;
        if (avoidKr.size > 0 && avoidKr.has(kr)) continue;
        if (prefer.length === 0 || prefer.includes(h.o)) {
          pool.push({ kr, h:h.h, m:h.m, s:h.s, o:h.o });
        }
      }
    }

    // Pool 크기 제한 (메인스레드 안전)
    const MAX_SYNC = 600;
    const safePool = pool.length > MAX_SYNC
      ? pool.sort(() => Math.random() - 0.5).slice(0, MAX_SYNC)
      : pool;

    const s0 = familyName.strokes || 0;
    const threshold = searchControl.qualityThreshold ?? 60;
    const results = [];
    const CYCLE = ['木','火','土','金','水'];
    const CHO_O = {'ㄱ':'木','ㄲ':'木','ㅋ':'木','ㄴ':'火','ㄷ':'火','ㄸ':'火','ㄹ':'火','ㅌ':'火','ㅇ':'土','ㅎ':'土','ㅅ':'金','ㅆ':'金','ㅈ':'金','ㅉ':'金','ㅊ':'金','ㅁ':'水','ㅂ':'水','ㅃ':'水','ㅍ':'水'};
    const CHOSUNG = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    const getCho = (c) => { const code=c.charCodeAt(0)-44032; return code<0||code>11171?'':CHOSUNG[Math.floor(code/588)]; };
    const getO   = (kr) => CHO_O[getCho(kr)] || null;

    for (let i = 0; i < safePool.length; i++) {
      for (let j = 0; j < safePool.length; j++) {
        const h1 = safePool[i], h2 = safePool[j];
        if (h1.h === h2.h) continue;

        const ohengSet = [h1.o, h2.o];
        let score = 0;
        for (const p of prefer) if (ohengSet.includes(p)) score += 50;
        if (prefer.length > 0 && prefer.every(p => ohengSet.includes(p))) score += 30;

        // 수리
        const g2 = s0+h1.s, g4 = s0+h1.s+h2.s;
        const getSuriGrade = (n) => {
          let num = n>81?n%81:n; if(num===0) num=81;
          return (typeof SURI_DATA!=='undefined' && SURI_DATA[num]?.grade) || '평';
        };
        const grades = [h1.s+h2.s, g2, s0+h2.s, g4].map(getSuriGrade);
        if (grades.some(g=>g==='대흉')) continue;
        score += grades.filter(g=>g==='길').length * 5;

        // 발음오행
        const seq = [familyName.kr, h1.kr, h2.kr].map(getO).filter(Boolean);
        for (let k=0;k<seq.length-1;k++) {
          const e1=seq[k],e2=seq[k+1];
          if(e1===e2){score+=5;continue;}
          if((CYCLE.indexOf(e1)+1)%5===CYCLE.indexOf(e2))score+=10;
          else score-=10;
        }

        score = Math.min(100, Math.max(0, score));
        if (score >= threshold) {
          results.push({ h1, h2, s0, isOija:false, score,
            familyKr: familyName.kr, familyHanja: familyName.hanja });
          if (results.length >= (searchControl.maxResults??5)*4) {
            results.sort((a,b)=>b.score-a.score);
            return results.slice(0, searchControl.maxResults??5);
          }
        }
      }
    }
    results.sort((a,b)=>b.score-a.score);
    return results.slice(0, searchControl.maxResults??5);
  }
}

// 전역 헬퍼 (HTML에서 사용)
function getHanjaStrokes(hanja) {
  if (!hanja || typeof HANJA_DB_FULL === 'undefined') return 10;
  for (const list of Object.values(HANJA_DB_FULL)) {
    const found = list.find(item => item.h === hanja);
    if (found) return found.s;
  }
  return 10;
}
