// scripts/eval_user_names.js — 사용자가 고른 특정 한자 이름 평가
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
  var fam=(HANJA_DB_FULL['최']||[]).find(function(x){return x.h===famHanja;});
  var GM={'대길':100,'길':80,'평':50,'흉':25,'대흉':0};
  var OF={'매우 좋음':100,'좋음':80,'보통':60,'나쁨':35,'매우 나쁨':15};

  function sd(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v+'',grade:'평'};return {n:n,name:d.name,grade:d.grade};}
  function evalName(k1,k2,H1,H2){
    var a=(HANJA_DB_FULL[k1]||[]).find(function(x){return x.h===H1;});
    var b=(HANJA_DB_FULL[k2]||[]).find(function(x){return x.h===H2;});
    if(!a||!b) return {error:'한자 없음 '+H1+' '+H2, aFound:!!a, bFound:!!b};
    var combo={h1:{h:a.h,s:a.s,o:a.o,kr:k1,m:a.m},h2:{h:b.h,s:b.s,o:b.o,kr:k2,m:b.m},s0:fam.s,isOija:false,familyKr:famKr,familyHanja:famHanja};
    var guk=_calcGuk(combo);
    var g=[sd(guk.g1),sd(guk.g2),sd(guk.g3),sd(guk.g4)];
    var pron=NameFormula.gradePronunciation(famKr+k1+k2);
    var ng=calcSajuOhengGrade([a.o,b.o],BD,BT,{});
    var raw=NameScore.scoreCombo(combo,nameSpec,{kr:famKr,hanja:famHanja,strokes:fam.s},{constraints:{},daeun:daeun,parentOheng:null,_scores:scores},{SURI_DATA:SURI_DATA});
    var sf=g.reduce(function(s,x){return s+GM[x.grade];},0)/4;
    var of=OF[ng.grade]||60, pf=OF[pron.grade]||60;
    var disp=Math.round(0.35*of+0.35*sf+0.20*pf+0.10*100);
    var bad=g.filter(function(x){return x.grade==='대흉'||x.grade==='흉';});
    var jeonggyeokBad=(g[3].grade==='흉'||g[3].grade==='대흉');
    var daehyung=g.some(function(x){return x.grade==='대흉';});
    return {
      name:famKr+k1+k2, hanja:famHanja+a.h+b.h,
      a:{h:a.h,m:a.m,s:a.s,o:a.o}, b:{h:b.h,m:b.m,s:b.s,o:b.o},
      suri:{원격:g[0],형격:g[1],이격:g[2],정격:g[3]},
      pron:{grade:pron.grade,ohengs:pron.ohengs},
      gunghap:ng, raw:raw, disp:disp,
      flags:{ daehyung:daehyung, jeonggyeokBad:jeonggyeokBad, badCount:bad.length, hardFail:(raw<=-999) }
    };
  }

  // '은은' 은 후보 찾기
  var eunCands=(HANJA_DB_FULL['은']||[]).filter(function(x){return /은은|온화|향기|삼가/.test(x.m);}).map(function(x){return x.h+'('+x.m+','+x.o+','+x.s+'획)';});

  __RESULT__=JSON.stringify({
    saju:{y:saju.year.gan+saju.year.ji,m:saju.month.gan+saju.month.ji,d:saju.day.gan+saju.day.ji,t:saju.time.gan+saju.time.ji},
    prefer:nameSpec.prefer, avoid:nameSpec.avoid, yongsin:nameSpec.yongsin.yongsinOheng,
    eunCandidates:eunCands,
    ha_e_銀: evalName('하','은','河','銀'),
    ji_yun: evalName('지','윤','池','潤')
  },null,1);
})();`;
vm.runInContext(code,ctx,{filename:'eval'});
process.stdout.write(ctx.__RESULT__);
