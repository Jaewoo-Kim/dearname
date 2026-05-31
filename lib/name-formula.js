/**
 * lib/name-formula.js
 * 이름 발음(소리) 분석 순수 모듈 — 발음오행 / 발음음양 / 상생 판별.
 *
 * 단일 진실 공급원(single source of truth): index.html·worker 가 사용하던
 * 초성→오행, 중성→음양, 상생 판별, 발음오행 등급 로직을 한 곳으로 모은다.
 *
 * ⚠️ 충돌 방지: 전역에 `NameFormula` 네임스페이스 객체 하나만 노출한다.
 *    (index.html 에 이미 const CHOSUNG/OHENG_CYCLE 등이 있으므로 IIFE 내부 지역 상수 사용)
 *    브라우저에서는 window.NameFormula, Node(vm)에서는 var NameFormula 로 접근.
 */
var NameFormula = (function () {
  'use strict';

  const CHOSUNG  = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNGSUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const OHENG_CYCLE = ['木','火','土','金','水'];
  const YANG_JUNG = ['ㅏ','ㅑ','ㅗ','ㅛ','ㅐ','ㅒ','ㅘ','ㅙ','ㅚ'];

  // 한글 음절 → 초성
  function getCho(char) {
    const code = char.charCodeAt(0) - 44032;
    if (code < 0 || code > 11171) return '';
    return CHOSUNG[Math.floor(code / 588)];
  }

  // 초성 → 발음오행
  function getOhengFromCho(cho) {
    if (['ㄱ','ㅋ','ㄲ'].includes(cho)) return '木';
    if (['ㄴ','ㄷ','ㄹ','ㅌ','ㄸ'].includes(cho)) return '火';
    if (['ㅇ','ㅎ'].includes(cho)) return '土';
    if (['ㅅ','ㅈ','ㅊ','ㅆ','ㅉ'].includes(cho)) return '金';
    if (['ㅁ','ㅂ','ㅍ','ㅃ'].includes(cho)) return '水';
    return '';
  }

  // 음절 → 발음오행 (편의 결합)
  function getChoOheng(char) {
    return getOhengFromCho(getCho(char));
  }

  // 한글 음절 → 발음음양 (중성 기준)
  function getYinYangFromJung(char) {
    const code = char.charCodeAt(0) - 44032;
    if (code < 0 || code > 11171) return '';
    const jung = JUNGSUNG[Math.floor((code % 588) / 28)];
    return YANG_JUNG.includes(jung) ? '양' : '음';
  }

  // 두 오행이 상생(또는 비화)인가
  function isSangsaeng(e1, e2) {
    if (e1 === e2) return true; // 비화(같은 기운)는 상생으로 간주
    const ia = OHENG_CYCLE.indexOf(e1), ib = OHENG_CYCLE.indexOf(e2);
    return (ia + 1) % 5 === ib || (ib + 1) % 5 === ia; // 순방향·역방향 상생 모두 인정
  }

  /**
   * 발음오행 등급 — 이름 전체 음절의 초성 오행 연쇄 상생/상극 판별.
   * @param {string} nameStr  성+이름 전체 (예: '김서연')
   * @returns {{grade, desc, badCount, total, ohengs}}
   */
  function gradePronunciation(nameStr) {
    const ohengs = nameStr.split('').map(getChoOheng);
    let badCount = 0;
    for (let i = 0; i < ohengs.length - 1; i++) {
      if (!isSangsaeng(ohengs[i], ohengs[i + 1])) badCount++;
    }
    const total = ohengs.length - 1;
    let grade, desc;
    if (badCount === 0)            { grade = '매우 좋음'; desc = '초성 오행이 상생 관계로 이어져 부드럽고 막힘없는 흐름입니다.'; }
    else if (badCount * 2 <= total){ grade = '좋음';     desc = '상생과 상극이 혼재하나 상생이 우세해 전반적으로 좋은 흐름입니다.'; }
    else if (badCount === total)   { grade = '매우 나쁨'; desc = '초성 오행이 연이어 상극을 이루어 보완이 시급합니다.'; }
    else                          { grade = '나쁨';     desc = '상극이 상생보다 많아 기운의 충돌이 우려됩니다.'; }
    return { grade, desc, badCount, total, ohengs };
  }

  return {
    getCho, getOhengFromCho, getChoOheng,
    getYinYangFromJung, isSangsaeng, gradePronunciation
  };
})();

// 브라우저 전역 노출 (index.html / worker 의 window.getCho 계약 유지)
if (typeof window !== 'undefined') {
  window.NameFormula        = NameFormula;
  window.getCho             = window.getCho             || NameFormula.getCho;
  window.getOhengFromCho    = window.getOhengFromCho    || NameFormula.getOhengFromCho;
  window.getYinYangFromJung = window.getYinYangFromJung || NameFormula.getYinYangFromJung;
}
