/**
 * scripts/find_options.js
 * 최하은 / 최지윤 (2026-07-02 08:50 여아, 최씨) — 전체 한자DB 전수 탐색으로
 * 표시점수(사주궁합+81수리+발음) 상위 한자 조합 옵션을 출력.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const ctx = vm.createContext({ console, JSON, window: {} });
function load(rel){ vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }
['data/manjuryeok.js','data/suri-data.js','data/hanja-db.js','lib/saju-engine.js','lib/name-spec.js','lib/name-formula.js','lib/name-score.js','api/claude-report.js'].forEach(load);

const compute = `
(function(){
  var BD='2026-07-02', BT='08:50', G='F', famKr='최', famHanja='崔';
  var saju=calcSaju(BD,BT,{}), scores=calcOhengScores(saju), daeun=calcDaeun(saju,BD,BT,G,{});
  var nameSpec=buildNameSpec(saju,scores,daeun);
  var fam=(HANJA_DB_FULL['최']||[]).find(function(x){return x.h===famHanja;})||{h:'崔',s:11,o:'土'};
  var s0=fam.s, AVOID=nameSpec.avoid||[];
  var GM={'대길':100,'길':80,'평':50,'흉':25,'대흉':0};
  var OF={'매우 좋음':100,'좋음':80,'보통':60,'나쁨':35,'매우 나쁨':15};
  function suriG(g){return [g.g1,g.g2,g.g3,g.g4].map(function(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v,grade:'평'};return{n:n,name:d.name,grade:d.grade};});}
  var BAN=['火','木']; // 火 기피 + 木(木生火로 火 조장) 제외 → 土/金/水만
  function pick(k1,k2){
    var c1=(HANJA_DB_FULL[k1]||[]).filter(function(x){return x.o&&BAN.indexOf(x.o)<0;});
    var c2=(HANJA_DB_FULL[k2]||[]).filter(function(x){return x.o&&BAN.indexOf(x.o)<0;});
    var famObj={kr:famKr,hanja:famHanja,strokes:s0};
    var st={constraints:{},daeun:daeun,parentOheng:null,_scores:scores};
    var pron=NameFormula.gradePronunciation(famKr+k1+k2);
    var pf=OF[pron.grade]||60;
    var all=[];
    for(var i=0;i<c1.length;i++)for(var j=0;j<c2.length;j++){
      var a=c1[i],b=c2[j];
      var combo={h1:{h:a.h,s:a.s,o:a.o,kr:k1,m:a.m},h2:{h:b.h,s:b.s,o:b.o,kr:k2,m:b.m},s0:s0,isOija:false,familyKr:famKr,familyHanja:famHanja};
      var raw=NameScore.scoreCombo(combo,nameSpec,famObj,st,{SURI_DATA:SURI_DATA});
      if(raw<=-999) continue;
      all.push({a:a,b:b,raw:raw,combo:combo});
    }
    all.sort(function(x,y){return y.raw-x.raw;});
    var top=all.slice(0,80).map(function(t){
      var gg=suriG(_calcGuk(t.combo));
      var sf=gg.reduce(function(s,g){return s+GM[g.grade];},0)/4;
      var ng=calcSajuOhengGrade([t.a.o,t.b.o],BD,BT,{});
      var of=OF[ng.grade]||60;
      var disp=Math.round(0.35*of+0.35*sf+0.20*pf+0.10*100);
      var daegil=gg.filter(function(g){return g.grade==='대길';}).length;
      var gil=gg.filter(function(g){return g.grade==='길';}).length;
      return {hanja:famHanja+t.a.h+t.b.h, m1:t.a.m,m2:t.b.m,o1:t.a.o,o2:t.b.o,s1:t.a.s,s2:t.b.s,
              raw:t.raw, disp:disp, gunghap:ng.grade, allGood:(daegil+gil===4), daegil:daegil,
              suri:gg.map(function(g){return g.n+g.grade;}).join(',')};
    });
    top.forEach(function(o){ o.tong=(o.o1==='土'||o.o2==='土'); o.struct=o.o1+'+'+o.o2; o.gumyong=(o.o1==='金'||o.o2==='金'); });
    // 통관(土 포함) 우선 → 용신(金 포함) → 표시점수 → raw
    top.sort(function(x,y){ return (y.tong-x.tong)||(y.gumyong-x.gumyong)||(y.disp-x.disp)||(y.raw-x.raw); });
    return top.slice(0,16);
  }
  __RESULT__=JSON.stringify({haeun:pick('하','은'), jiyun:pick('지','윤')});
})();
`;
vm.runInContext(compute, ctx, { filename:'find' });
const out = JSON.parse(ctx.__RESULT__);
function show(name, arr){
  console.log('\\n===== '+name+' (표시점수 상위) =====');
  arr.forEach(function(o,i){
    var tag = o.tong ? (o.gumyong?'[통관 土+金 ★]':'[통관 土포함]') : (o.gumyong?'[용신 金]':'[조후 등]');
    console.log((i+1)+'. '+o.hanja+'  '+tag+'  disp='+o.disp+' 궁합'+o.gunghap+' raw'+o.raw+'  '+o.struct+' '+o.s1+'+'+o.s2+'획  수리['+o.suri+']'+(o.allGood?' 전격길↑':'')+'  '+o.m1+'/'+o.m2);
  });
}
show('최하은 崔_하_은', out.haeun);
show('최지윤 崔_지_윤', out.jiyun);
