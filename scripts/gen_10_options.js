// scripts/gen_10_options.js — 확정된 10개 후보의 엔진 서술 필드 일괄 계산
'use strict';
const vm=require('vm'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const ctx=vm.createContext({console,JSON,window:{}});
function load(r){vm.runInContext(fs.readFileSync(path.join(ROOT,r),'utf8'),ctx,{filename:r});}
['data/manjuryeok.js','data/suri-data.js','data/hanja-db.js','lib/saju-engine.js','lib/name-spec.js','lib/name-formula.js','lib/name-score.js','api/claude-report.js'].forEach(load);

const FINAL_10 = [
  ['지','은','池','銀'],
  ['서','윤','瑞','尹'],
  ['지','윤','誌','尹'],
  ['지','안','池','安'],
  ['이','안','利','安'],
  ['서','아','瑞','娥'],
  ['예','서','芮','瑞'],
  ['소','은','素','銀'],
  ['소','이','韶','利'],
  ['라','윤','羅','尹']
];

const code = `(function(){
  var BD='2026-07-02',BT='08:50',famKr='최',famHanja='崔';
  var saju=calcSaju(BD,BT,{}),scores=calcOhengScores(saju),daeun=calcDaeun(saju,BD,BT,'F',{});
  var nameSpec=buildNameSpec(saju,scores,daeun);
  var fam=(HANJA_DB_FULL['최']||[]).find(function(x){return x.h===famHanja;});
  var s0=fam.s;
  function sd(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v+'',grade:'평'};return {n:n,name:d.name,grade:d.grade};}

  var list = ${JSON.stringify(FINAL_10)};
  var out = list.map(function(row){
    var k1=row[0],k2=row[1],H1=row[2],H2=row[3];
    var a=(HANJA_DB_FULL[k1]||[]).find(function(x){return x.h===H1;});
    var b=(HANJA_DB_FULL[k2]||[]).find(function(x){return x.h===H2;});
    var combo={h1:{h:a.h,s:a.s,o:a.o,kr:k1,m:a.m},h2:{h:b.h,s:b.s,o:b.o,kr:k2,m:b.m},s0:s0,isOija:false,familyKr:famKr,familyHanja:famHanja};
    var guk=_calcGuk(combo);
    var g=[sd(guk.g1),sd(guk.g2),sd(guk.g3),sd(guk.g4)];
    var pron=NameFormula.gradePronunciation(famKr+k1+k2);
    var ng=calcSajuOhengGrade([a.o,b.o],BD,BT,{});
    var fields=_genFormulaFields(combo,{constraints:{},nameSpec:nameSpec,_saju:saju,_scores:scores});
    var GM={'대길':100,'길':80,'평':50,'흉':25,'대흉':0};
    var OF={'매우 좋음':100,'좋음':80,'보통':60,'나쁨':35,'매우 나쁨':15};
    var sf=g.reduce(function(s,x){return s+GM[x.grade];},0)/4;
    var disp=Math.round(0.35*(OF[ng.grade]||60)+0.35*sf+0.20*(OF[pron.grade]||60)+0.10*100);
    return {
      kr: famKr+k1+k2, hanja: famHanja+a.h+b.h,
      h1:{h:a.h,kr:k1,m:a.m,s:a.s,o:a.o}, h2:{h:b.h,kr:k2,m:b.m,s:b.s,o:b.o}, s0:s0,
      guk: {g1:guk.g1,g2:guk.g2,g3:guk.g3,g4:guk.g4},
      suri: g, pron: pron, gunghap: ng, disp: disp,
      fields: fields
    };
  });
  __RESULT__ = JSON.stringify(out);
})();`;
vm.runInContext(code, ctx, {filename:'gen10'});
const result = JSON.parse(ctx.__RESULT__);
fs.writeFileSync(path.join(__dirname,'..','_10opt_full.json'), JSON.stringify(result, null, 1));
result.forEach(r => {
  console.log(`\n### ${r.kr} ${r.hanja}  disp=${r.disp}  궁합=${r.gunghap.grade}  발음=${r.pron.grade}`);
  console.log('  guk:', r.guk, ' suri:', r.suri.map(s=>s.n+s.name+'('+s.grade+')').join(' / '));
  console.log('  h1:', r.h1, ' h2:', r.h2);
});
