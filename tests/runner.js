/**
 * tests/runner.js  (로더)
 * DearName 유닛 테스트 — 제품 경계별 suite 파일을 로드해 실행한다.
 *
 * 실행: npm test  (또는 node tests/runner.js)
 * 브라우저 실행: tests/test.html
 *
 * ──────────────────────────────────────────────
 * 구조
 *   framework.js   수집 모델 프레임워크 (suite/assert/assertEq/assertCond)
 *   helpers.js     공용 헬퍼 (saju, count8, CG/JJ)
 *   suites/shared/   두 제품 공통 (calcSaju 만세력 엔진)
 *   suites/self/     셀프 분석 (8자 단순 카운트, default 등급)
 *   suites/premium/  프리미엄 작명 (지장간 가중, 통관, 종격, 용신)
 *
 * 테스트 등급
 *   [GOLD]  외부 만세력·현장 검증된 케이스
 *   [LOGIC] 보정 수식으로 직접 계산·검증된 케이스
 *   [SNAP]  현재 엔진 출력을 기준선 고정 (회귀 방지)
 */

'use strict';

const vm   = require('vm');
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadScript(relPath, ctx) {
  const fullPath = path.join(ROOT, relPath);
  const code = fs.readFileSync(fullPath, 'utf8');
  try {
    vm.runInContext(code, ctx, { filename: relPath });
  } catch (e) {
    console.error(`\n스크립트 로드 실패: ${relPath}\n${e.message}`);
    process.exit(1);
  }
}

// ── 1. 엔진 로드 ──────────────────────────────────────────────────
const ctx = vm.createContext({ console });
loadScript('data/manjuryeok.js', ctx);
loadScript('lib/saju-engine.js', ctx);
loadScript('lib/name-spec.js',   ctx);
loadScript('api/claude-report.js', ctx);   // 프리미엄 공식 필드(_calcGuk 등) — top-level window 참조 없음

['calcSaju', 'calcOhengScores', 'calcDaeun', 'calcSajuOhengGrade', 'buildNameSpec', 'calcYongsin',
 '_calcGuk', '_getSuriData', '_genCareerJobs', '_genHealthAdvice', 'buildUserPrompt'].forEach(name => {
  if (!ctx[name]) {
    console.error(`엔진 로드 오류: ${name} 를 찾을 수 없습니다.`);
    process.exit(1);
  }
});

// ── 2. 테스트 프레임워크 + 헬퍼 로드 ──────────────────────────────
loadScript('tests/framework.js', ctx);
loadScript('tests/helpers.js',   ctx);

// ── 3. suite 파일 로드 (제품 경계별) ──────────────────────────────
const SUITE_FILES = [
  'tests/suites/shared/saju.test.js',
  'tests/suites/self/oheng-count.test.js',
  'tests/suites/self/saju-grade.test.js',
  'tests/suites/premium/oheng-weighted.test.js',
  'tests/suites/premium/saju-grade-prem.test.js',
  'tests/suites/premium/namespec.test.js',
  'tests/suites/premium/formula-fields.test.js',
  'tests/suites/premium/prompt-contract.test.js',
];
SUITE_FILES.forEach(f => loadScript(f, ctx));

// ── 4. 결과 집계 및 출력 ──────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];

(ctx.__TEST_SUITES__ || []).forEach(s => {
  console.log(`\n  ── ${s.name}`);
  s.cases.forEach(c => {
    if (c.ok) {
      passed++;
      console.log('    ✓ ' + c.msg);
    } else {
      failed++;
      failures.push(`${s.name} › ${c.msg}${c.detail ? '  (' + c.detail + ')' : ''}`);
      console.log('    ✗ ' + c.msg + (c.detail ? '  ' + c.detail : ''));
    }
  });
});

const total = passed + failed;
console.log('\n' + '─'.repeat(52));
console.log(`  총 ${total}개:  ✓ ${passed}개 통과  ${failed > 0 ? '/ ✗ ' + failed + '개 실패' : '/ 전체 통과 🎉'}`);
if (failures.length) {
  console.log('\n  실패 목록:');
  failures.forEach(f => console.log('    • ' + f));
}
console.log('─'.repeat(52) + '\n');
process.exit(failed > 0 ? 1 : 0);
