'use strict';
const vm=require('vm'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const ctx=vm.createContext({console,JSON,window:{}});
function load(r){vm.runInContext(fs.readFileSync(path.join(ROOT,r),'utf8'),ctx,{filename:r});}
['data/manjuryeok.js','data/suri-data.js','data/hanja-db.js','lib/saju-engine.js','lib/name-spec.js','lib/name-formula.js','lib/name-score.js','api/claude-report.js'].forEach(load);
// argv: k1 k2 h1 h2
const [k1,k2,H1,H2]=process.argv.slice(2);
const code=`(function(){
  var BD='2026-07-02',BT='08:50',famKr='최',famHanja='崔';
  var saju=calcSaju(BD,BT,{}),scores=calcOhengScores(saju),daeun=calcDaeun(saju,BD,BT,'F',{});
  var nameSpec=buildNameSpec(saju,scores,daeun);
  var fam=(HANJA_DB_FULL['최']||[]).find(function(x){return x.h===famHanja;});
  var a=(HANJA_DB_FULL['${k1}']||[]).find(function(x){return x.h==='${H1}';});
  var b=(HANJA_DB_FULL['${k2}']||[]).find(function(x){return x.h==='${H2}';});
  var combo={h1:{h:a.h,s:a.s,o:a.o,kr:'${k1}',m:a.m},h2:{h:b.h,s:b.s,o:b.o,kr:'${k2}',m:b.m},s0:fam.s,isOija:false,familyKr:famKr,familyHanja:famHanja};
  var guk=_calcGuk(combo);
  function sd(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v,grade:'평'};return v+' '+d.name+'('+d.grade+')';}
  var fields=_genFormulaFields(combo,{constraints:{},nameSpec:nameSpec,_saju:saju,_scores:scores});
  var pron=NameFormula.gradePronunciation(famKr+'${k1}'+'${k2}');
  var ng=calcSajuOhengGrade([a.o,b.o],BD,BT,{});
  __RESULT__=JSON.stringify({
    a:{h:a.h,m:a.m,s:a.s,o:a.o}, b:{h:b.h,m:b.m,s:b.s,o:b.o},
    guk:{g1:sd(guk.g1),g2:sd(guk.g2),g3:sd(guk.g3),g4:sd(guk.g4)},
    pron:{grade:pron.grade,ohengs:pron.ohengs},
    gunghap:ng, fields:fields
  },null,1);
})();`;
vm.runInContext(code,ctx,{filename:'one'});
process.stdout.write(ctx.__RESULT__);
