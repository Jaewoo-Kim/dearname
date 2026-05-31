/**
 * lib/name-score.js
 * 이름 후보 채점 순수 모듈 — _scoreCombo 의 단일 진실 공급원(single source of truth).
 *
 * name-search-worker.js 가 내장하던 채점 로직(컴포넌트 A~K + 하드필터)을
 * side-effect 없는 순수 함수로 추출한다. 모듈 레벨 가변 상태(SURI_DATA 등)는
 * 호출 시 `deps` 인자로 주입받아 결정적(deterministic)으로 동작 → 유닛 테스트 가능.
 *
 * ⚠️ 충돌 방지: 전역에 `NameScore` 네임스페이스 하나만 노출.
 *    내부 상수(OHENG_CYCLE/CHOSUNG/CHO_OHENG 등)는 IIFE 지역 상수라
 *    index.html·worker·saju-engine 의 동명 전역과 충돌하지 않는다.
 *    - 브라우저/Worker: var NameScore (importScripts 후 전역 접근)
 *    - Node(vm): var NameScore 로 context 프로퍼티 노출
 */
var NameScore = (function () {
  'use strict';

  // ── 분파(分破) 한자 — 성+이름 전체가 분파 구조면 하드 탈락 ──
  const BUNPA_HANJA = new Set([
    // 좌우분파: 木旁
    '朴','材','柳','林','杜','棟','楠','根','柱','格','梗',
    '桃','梨','楊','楓','椿','栢','楚','桂','桐','楷','樣',
    '樹','標','模','橡','橙','檀','欄','梅','梓','桑','植',
    '樟','橘','槐','槿','柔','梔','梢','枝','棍','棒','棋',
    '棗','椎','榆','槽','棱','楮','桓','柄','楫','楸','楣',
    '栮','椏','梁','桁','楁','梑','楺','枰','栩','梟','桀',
    '棲','梱','楯','槫','樺','橈','檉','欖','欒','樵','橄',
    // 좌우분파: 氵旁
    '洪','汎','洙','泓','洵','洛','洺','沅','洣','浩','浚',
    '浦','泰','淳','淵','湧','涵','漪','瀅','瀞','灝','渾',
    '瀛','淡','淝','淞','浤','沛','汪','泳','洋','滿','漢',
    '源','溪','海','澤','湖','瀚','涓','沼','淸','溫','漠',
    '澄','濬','瀍','淮','渭','漳','滎','潁','汭','沔','汾',
    // 좌우분파: 金旁
    '銀','鐘','鎭','鎬','錦','錫','鍾','鑑','銳','銅','鋒',
    '鎔','錄','鍊','鍛','鋼','鑄','鑰','銓','鎧',
    // 좌우분파: 言旁
    '誠','謙','諄','譽','謹','詩','訓','誌','諺','謄',
    '讚','諾','議','詢','誥','諭','謨',
    // 좌우분파: 女旁
    '姜','妍','娜','婉','娟','婷','姸','媛','姬','嫻','娥',
    '婕','媚','嬋','嫣','嬌','媜','婧','妮',
    // 좌우분파: 亻旁
    '仁','佳','俊','修','倫','健','億','儀','偉','侃','儒',
    '伸','佑','伯','仲','仙','倡','俐','傑','偲','佶',
    '儁','儷','僖','儼',
    // 좌우분파: 扌旁
    '振','承','揚','揮','摯','擇','拓','撥','摩',
    // 좌우분파: 土旁
    '均','坦','坤','垣','培','堅','堯','堉','塤','墉',
    '埈','堰','埠',
    // 좌우분파: 火旁
    '炯','炳','煥','燦','煒','燁','燮','熙','炫',
    // 좌우분파: 糸旁
    '綠','絹','緯','綺','絲','紋','紀','維','緣','繼','綸',
    '緞','緻','繡','綵','紳','紹','絃','絡',
    // 좌우분파: 기타 좌우 구조
    '張','許','趙','韓','陳','明','時','晉','晨','晶',
    '暎','昊','昱','昌','旻','晃','晟','晔','曄','昀','晤',
    '旭','晄','昺','昶','晅','旼',
    // 상하분파: 艹头
    '英','花','芸','芳','華','菊','芝','若','苑','莉','蓮',
    '葉','蒼','蘇','蕙','薰','薇','蘭','芙','芮','莫','藍',
    '蓀','蓁','葳','蔓','蔚','薔','藤','蕾','萼','蓓','蕊',
    '荷','茹','茗','荊','莊','茱','菁','菱','菲','菩','菴',
    '蒲','蓋','薛','薜','藕','苔','芹','荳','菽','蓼',
    // 상하분파: 宀头
    '安','宇','宙','宣','宰','容','富','宜','宏','守','完',
    '宛','宮','寬','寧','寰','寶','宗','宥','宴','寂','審',
    '憲',
    // 상하분파: 山 구조
    '崔','崑','嶺','嶽','崇','崗','峰','巖','峻','崢','嵐',
    '峯','嵇','嶸','巑',
    // 상하분파: 竹头
    '筠','籌','筮','篤','節','築','篇','籃',
    // 상하분파: 기타 상하 구조
    '香','字','孝','孟','孔','學','存','季','孫','孰',
  ]);

  // ── 운 중심 수리 맵 (81수리 설명 기반) ──
  const LUCK_SURI = {
    wealth:     new Set([6,15,16,21,24,25,29,39,41,47,52,57,61,65,67,70,72]),
    leadership: new Set([1,3,7,13,15,16,17,21,23,29,31,33,37,39,41,45,47,52,53,61,65,67]),
    wisdom:     new Set([3,11,13,21,35,38,41,45,48,53,57,61,65,68,72,73]),
    health:     new Set([1,5,6,8,11,15,16,21,24,25,31,35,37,39,41,45,48,52,65,70,73,75,78,80])
  };

  // ── 발음 분석 상수 ──
  const OHENG_CYCLE = ['木','火','土','金','水'];
  const CHOSUNG  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
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

  /**
   * 이름 후보 채점 — 컴포넌트 A~K + 하드필터(분파·대흉·정격).
   * @param {Object} combo      { h1, h2, s0, isOija }
   * @param {Object} nameSpec   { prefer, avoid, ... }
   * @param {Object} familyName { kr, hanja, strokes }
   * @param {Object} state      { constraints, daeun, parentOheng }
   * @param {Object} deps       { SURI_DATA, MODERN_SYLLABLE_SCORE, OLDFASHIONED_SET }
   * @returns {number}          점수 (하드 탈락 시 -999, 최대 200)
   */
  function scoreCombo(combo, nameSpec, familyName, state, deps) {
    deps = deps || {};
    const SURI_DATA             = deps.SURI_DATA || null;
    const MODERN_SYLLABLE_SCORE = deps.MODERN_SYLLABLE_SCORE || null;
    const OLDFASHIONED_SET      = deps.OLDFASHIONED_SET || null;

    const { h1, h2, s0, isOija } = combo;
    const s1 = h1.s, s2 = h2 ? h2.s : 0;
    let score = 0;

    // [분파 하드 필터] 성+이름 전체가 분파 구조면 절대 탈락
    const _fullHanja = [familyName.hanja, h1.h, h2?.h].filter(Boolean);
    if (_fullHanja.length >= 2 && _fullHanja.every(h => BUNPA_HANJA.has(h))) return -999;

    // [A] 자원오행 가점
    const ohengSet = [h1.o, h2?.o].filter(Boolean);
    for (const pref of (nameSpec.prefer || [])) {
      if (ohengSet.includes(pref)) score += 50;
    }
    if (nameSpec.prefer?.length > 0 && nameSpec.prefer.every(p => ohengSet.includes(p))) {
      score += 30;
    }

    // [B] 81수리 4격 — 엄격 필터
    const g1 = isOija ? s1+1 : s1+s2;
    const g2 = s0+s1;
    const g3 = isOija ? s0+1 : s0+s2;
    const g4 = isOija ? s0+s1 : s0+s1+s2;

    const _sg = (n) => { let v = n > 81 ? n%81 : n; if (v===0) v=81; return SURI_DATA?.[v]?.grade || '평'; };
    const grades = [_sg(g1), _sg(g2), _sg(g3), _sg(g4)];

    // ① 대흉은 어디든 절대 탈락
    if (grades.some(g => g === '대흉')) return -999;
    // ② 말년(정격)은 길 이상 필수
    if (grades[3] === '평' || grades[3] === '흉') return -999;

    // ③ 격별 차등 점수
    const _suriScore = (g, pos) => {
      if (g === '대길') return pos === 3 ? 35 : 25;
      if (g === '길')   return pos === 3 ? 20 : 15;
      if (g === '평')   return pos === 0 ? -15 : -45;
      if (g === '흉')   return pos === 0 ? -35 : -90;
      return 0;
    };
    for (let i = 0; i < 4; i++) score += _suriScore(grades[i], i);

    // ④ 4格 전부 대길 올클 보너스
    if (grades.every(g => g === '대길')) score += 30;
    // ⑤ 말년·장년 모두 대길이면 추가 보너스
    else if (grades[3] === '대길' && grades[2] === '대길') score += 10;

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
      if ((ia+1)%5 === ib || (ib+1)%5 === ia) score += 10;
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

    // [G] 대운 보완 가점
    const daeun = state.daeun;
    if (daeun?.cycles?.length) {
      let daeunBonus = 0;
      for (const cycle of daeun.cycles) {
        let weight = 0;
        if (cycle.startAge >= 35 && cycle.startAge < 60) weight = 1;
        else if (cycle.startAge >= 60) weight = 2;
        if (!weight) continue;

        for (const o of ohengSet) {
          const daeunSc = cycle.ohengScores?.[o] || 0;
          if (daeunSc < 20) daeunBonus += weight * 3;
        }
        for (const o of ohengSet) {
          const daeunSc = cycle.ohengScores?.[o] || 0;
          if (daeunSc > 50) daeunBonus -= weight * 2;
        }
      }
      score += Math.max(-20, Math.min(30, daeunBonus));
    }

    // [H] 운 중심 가점
    const luckFocus = state.constraints?.luckFocus;
    if (luckFocus && luckFocus !== 'balanced' && LUCK_SURI[luckFocus]) {
      const targetSet = LUCK_SURI[luckFocus];
      const suriNums  = [g1, g2, g3, g4].map(n => { let v = n > 81 ? n % 81 : n; return v === 0 ? 81 : v; });
      const hits      = suriNums.filter(n => targetSet.has(n)).length;
      score += hits * 8;
    }

    // [I] 부모 사주 조화
    const parentOheng = state.parentOheng;
    if (parentOheng) {
      for (const p of ['father', 'mother']) {
        const dominant = parentOheng[p]?.dominant;
        if (!dominant) continue;
        if (ohengSet.includes(dominant)) score -= 5;
        const weakest = parentOheng[p]?.weakest;
        if (weakest && ohengSet.includes(weakest)) score += 5;
      }
    }

    // [J] 현대 작명 금기 발음
    if (h1.kr && familyName.kr && h1.kr === familyName.kr) score -= 30;
    if (!isOija && h2 && h1.kr && h2.kr && h1.kr === h2.kr) score -= 20;

    // [K] 현대성 보너스
    if (MODERN_SYLLABLE_SCORE) {
      const s1Score = MODERN_SYLLABLE_SCORE[h1.kr] || 0;
      const s2Score = h2?.kr ? (MODERN_SYLLABLE_SCORE[h2.kr] || 0) : 0;
      const avgModern = h2?.kr ? (s1Score + s2Score) / 2 : s1Score;
      score += Math.round(avgModern / 20);
    }
    if (OLDFASHIONED_SET) {
      if (OLDFASHIONED_SET.has(h1.kr)) score -= 3;
      if (h2?.kr && OLDFASHIONED_SET.has(h2.kr)) score -= 3;
    }

    return Math.min(200, score);
  }

  return { scoreCombo, BUNPA_HANJA, LUCK_SURI };
})();

// 브라우저/Worker 전역 노출
if (typeof window !== 'undefined') {
  window.NameScore = NameScore;
}
