/**
 * scripts/audit_hanja_db.js
 * 한자DB(HANJA_DB_FULL) 구조적 정합성 전수 검증.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console, JSON });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'data/hanja-db.js'), 'utf8'), ctx, { filename: 'hanja-db.js' });

const code = `(function(){
  var VALID_OHENG = {'木':1,'火':1,'土':1,'金':1,'水':1};
  var CJK_RANGES = [[0x3400,0x4DBF],[0x4E00,0x9FFF],[0xF900,0xFAFF],[0x20000,0x2A6DF]];
  function isCJK(cp){ return CJK_RANGES.some(function(r){return cp>=r[0]&&cp<=r[1];}); }
  function isPUA(cp){ return (cp>=0xE000&&cp<=0xF8FF)||(cp>=0xF0000&&cp<=0xFFFFD)||(cp>=0x100000&&cp<=0x10FFFD); }

  var totalEntries=0;
  var hanjaToReadings={};
  var issues={emptyMeaning:[],suspiciousMeaning:[],invalidStrokes:[],invalidOheng:[],nonHanjaChar:[],dupInSameReading:[],puaChars:[]};

  var readings = Object.keys(HANJA_DB_FULL);
  readings.forEach(function(kr){
    var list = HANJA_DB_FULL[kr];
    var seenInReading = {};
    list.forEach(function(entry){
      totalEntries++;
      var h=entry.h, m=entry.m, s=entry.s, o=entry.o;
      if(seenInReading[h]) issues.dupInSameReading.push({kr:kr,h:h});
      seenInReading[h]=1;
      if(!m || typeof m!=='string' || m.trim()==='') issues.emptyMeaning.push({kr:kr,h:h,m:m});
      else if(m.length>30 || /^[\\d\\s]+$/.test(m) || /undefined|null|NaN/i.test(m)) issues.suspiciousMeaning.push({kr:kr,h:h,m:m});
      if(typeof s!=='number' || s<=0 || s>40) issues.invalidStrokes.push({kr:kr,h:h,s:s});
      if(!VALID_OHENG[o]) issues.invalidOheng.push({kr:kr,h:h,o:o});
      var cp = h ? h.codePointAt(0) : 0;
      if(!h || !isCJK(cp)) issues.nonHanjaChar.push({kr:kr,h:h});
      if(isPUA(cp)) issues.puaChars.push({kr:kr,h:h});
      if(!hanjaToReadings[h]) hanjaToReadings[h]=[];
      hanjaToReadings[h].push({kr:kr,m:m,s:s,o:o});
    });
  });

  var inconsistentMultiReading=[];
  Object.keys(hanjaToReadings).forEach(function(h){
    var rs = hanjaToReadings[h];
    if(rs.length<2) return;
    var strokesSet={}, ohengSet={};
    rs.forEach(function(r){ strokesSet[r.s]=1; ohengSet[r.o]=1; });
    if(Object.keys(strokesSet).length>1 || Object.keys(ohengSet).length>1){
      inconsistentMultiReading.push({h:h, readings:rs});
    }
  });

  __RESULT__ = JSON.stringify({
    totalEntries: totalEntries,
    uniqueHanja: Object.keys(hanjaToReadings).length,
    issues: issues,
    inconsistentMultiReading: inconsistentMultiReading
  });
})();`;

vm.runInContext(code, ctx, { filename: 'audit' });
const result = JSON.parse(ctx.__RESULT__);

console.log('=== 한자DB 정합성 검증 결과 ===');
console.log('총 엔트리:', result.totalEntries, '/ 고유 한자:', result.uniqueHanja);
console.log('');
console.log('[1] 뜻(m) 필드 결측:', result.issues.emptyMeaning.length);
result.issues.emptyMeaning.slice(0,10).forEach(x => console.log('   ', JSON.stringify(x)));
console.log('[2] 뜻(m) 필드 의심스러움:', result.issues.suspiciousMeaning.length);
result.issues.suspiciousMeaning.slice(0,10).forEach(x => console.log('   ', JSON.stringify(x)));
console.log('[3] 획수(s) 이상치(<=0 or >40):', result.issues.invalidStrokes.length);
result.issues.invalidStrokes.slice(0,10).forEach(x => console.log('   ', JSON.stringify(x)));
console.log('[4] 오행(o) 값 이상:', result.issues.invalidOheng.length);
result.issues.invalidOheng.slice(0,10).forEach(x => console.log('   ', JSON.stringify(x)));
console.log('[5] 한자(h) CJK 범위 밖:', result.issues.nonHanjaChar.length);
result.issues.nonHanjaChar.slice(0,10).forEach(x => console.log('   ', JSON.stringify(x)));
console.log('[6] PUA 문자:', result.issues.puaChars.length);
result.issues.puaChars.slice(0,10).forEach(x => console.log('   ', JSON.stringify(x)));
console.log('[7] 같은 음 안 완전 중복:', result.issues.dupInSameReading.length);
result.issues.dupInSameReading.slice(0,10).forEach(x => console.log('   ', JSON.stringify(x)));
console.log('[8] 다음자인데 획수/오행이 음마다 다름:', result.inconsistentMultiReading.length);
result.inconsistentMultiReading.slice(0,30).forEach(x => console.log('   ', x.h, JSON.stringify(x.readings)));

fs.writeFileSync(path.join(__dirname, '..', '_audit_result.json'), JSON.stringify(result, null, 1));
console.log('\n전체 결과 저장: _audit_result.json');
