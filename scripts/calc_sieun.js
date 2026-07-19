// scripts/calc_sieun.js — 최시은 3옵션 정밀 계산
// 溡(시,13획,水,물이름)는 DB에 없어 사용자 제공값(원획법 13획, 水, 물이름)을 그대로 사용.
// 殷/詩/濦/銀은 DB 확정값.
'use strict';
const vm=require('vm'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const ctx=vm.createContext({console,JSON,window:{}});
function load(r){vm.runInContext(fs.readFileSync(path.join(ROOT,r),'utf8'),ctx,{filename:r});}
['data/manjuryeok.js','data/suri-data.js','data/hanja-db.js','lib/saju-engine.js','lib/name-spec.js','lib/name-formula.js','lib/name-score.js','api/claude-report.js'].forEach(load);

const code=`(function(){
  var BD='2026-07-02',BT='08:50',famKr='최',famHanja='崔';
  var saju=calcSaju(BD,BT,{}),scores=calcOhengScores(saju),daeun=calcDaeun(saju,BD,BT,'F',{});
  var nameSpec=buildNameSpec(saju,scores,daeun);
  var fam=(HANJA_DB_FULL['최']||[]).find(function(x){return x.h==='崔';});
  var s0=fam.s;
  function sd(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v+'',grade:'평'};return {n:n,name:d.name,grade:d.grade};}
  function DBlook(kr,h){ return (HANJA_DB_FULL[kr]||[]).find(function(x){return x.h===h;}); }

  function evalCombo(k1,h1_h,m1,s1,o1,k2,h2_h,m2,s2,o2,fromDB1,fromDB2){
    var combo={h1:{h:h1_h,s:s1,o:o1,kr:k1,m:m1},h2:{h:h2_h,s:s2,o:o2,kr:k2,m:m2},s0:s0,isOija:false,familyKr:famKr,familyHanja:famHanja};
    var guk=_calcGuk(combo);
    var g=[sd(guk.g1),sd(guk.g2),sd(guk.g3),sd(guk.g4)];
    var pron=NameFormula.gradePronunciation(famKr+k1+k2);
    var ng=calcSajuOhengGrade([o1,o2],BD,BT,{});
    var fields=_genFormulaFields(combo,{constraints:{},nameSpec:nameSpec,_saju:saju,_scores:scores});
    return {kr:famKr+k1+k2, hanja:famHanja+h1_h+h2_h, h1:combo.h1,h2:combo.h2,s0:s0,
            guk:guk, suri:g, pron:pron, gunghap:ng, fields:fields,
            note:(fromDB1?'':'h1 DB미등재-사용자제공값') + (fromDB2?'':' h2 DB미등재-사용자제공값')};
  }

  var out = {};
  // 옵션1: 崔溡殷 — 溡 DB 없음(사용자 제공: 13획,水,물이름), 殷 DB확정
  var eun_DB = DBlook('은','殷');
  out.opt1 = evalCombo('시','溡','물이름',13,'水', '은','殷',eun_DB.m,eun_DB.s,eun_DB.o, false, true);

  // 옵션2: 崔詩溵 — 둘 다 DB확정 (金+水, 시=詩(시.악장) 은=溵(큰강.물소리) — '강' 테마 유지)
  var si_詩 = DBlook('시','詩'), eun_溵 = DBlook('은','溵');
  out.opt2 = evalCombo('시','詩',si_詩.m,si_詩.s,si_詩.o, '은','溵',eun_溵.m,eun_溵.s,eun_溵.o, true, true);

  // 옵션3: 崔詩銀 — 둘 다 DB확정 (金+金)
  var eun_銀 = DBlook('은','銀');
  out.opt3 = evalCombo('시','詩',si_詩.m,si_詩.s,si_詩.o, '은','銀',eun_銀.m,eun_銀.s,eun_銀.o, true, true);

  __RESULT__ = JSON.stringify(out);
})();`;
vm.runInContext(code, ctx, {filename:'sieun'});
const r = JSON.parse(ctx.__RESULT__);
fs.writeFileSync(path.join(__dirname,'..','_sieun.json'), JSON.stringify(r,null,1));
['opt1','opt2','opt3'].forEach(k => {
  const d = r[k];
  console.log(`\n### ${k}: ${d.kr} ${d.hanja}  ${d.note}`);
  console.log('  h1:', d.h1, ' h2:', d.h2);
  console.log('  guk:', d.guk);
  console.log('  suri:', d.suri.map(s=>s.n+s.name+'('+s.grade+')').join(' / '));
  console.log('  발음:', d.pron.grade, ' 궁합:', d.gunghap.grade, '-', d.gunghap.desc);
});
