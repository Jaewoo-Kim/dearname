/**
 * tests/framework.js
 * 수집(collection) 모델 테스트 프레임워크 — Node(vm.runInContext) + 브라우저 양쪽 호환
 *
 * ⚠️ var / function 선언만 사용한다.
 *    Node vm.runInContext 에서 top-level const/let 은 context 객체의 프로퍼티로
 *    노출되지 않아 다른 스크립트(suite 파일)에서 접근할 수 없다.
 *    var/function 은 context 전역 프로퍼티가 되어 cross-file 접근이 가능하다.
 *    브라우저에서는 <script> 태그 간 양쪽 모두 전역이 되므로 문제없다.
 */

var __TEST_SUITES__ = [];
var __TEST_CUR__ = null;

function suite(name) {
  __TEST_CUR__ = { name: name, cases: [] };
  __TEST_SUITES__.push(__TEST_CUR__);
}

function assert(cond, msg, detail) {
  if (!__TEST_CUR__) suite('(default)');
  __TEST_CUR__.cases.push({ ok: !!cond, msg: msg, detail: detail || '' });
}

function assertEq(got, expected, msg) {
  assert(got === expected, msg,
    got !== expected ? 'got "' + got + '"  expected "' + expected + '"' : '');
}

// 의미상 별칭 — 단순 불리언 조건 검증
function assertCond(cond, msg) {
  assert(cond, msg);
}
