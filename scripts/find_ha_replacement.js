// scripts/find_ha_replacement.js — 崔__銀 형태로 '하' 한자만 교체 탐색
// 銀(金,14획) 고정, 崔(11획) 고정 → 이격은 11+14=25(안강격) 고정.
// '하' 한자를 바꿔가며 원격·형격·정격 모두 길(吉) 이상인 조합을 찾는다.
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
  var eun=(HANJA_DB_FULL['은']||[]).find(function(x){return x.h==='銀';}); // 고정
  var GM={'대길':100,'길':80,'평':50,'흉':25,'대흉':0};
  var OF={'매우 좋음':100,'좋음':80,'보통':60,'나쁨':35,'매우 나쁨':15};
  function sd(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v+'',grade:'평'};return {n:n,name:d.name,grade:d.grade};}

  var haCands=HANJA_DB_FULL['하']||[];
  var famObj={kr:famKr,hanja:famHanja,strokes:fam.s};
  var st={constraints:{},daeun:daeun,parentOheng:null,_scores:scores};
  var pron=NameFormula.gradePronunciation(famKr+'하'+'은');
  var pf=OF[pron.grade]||60;

  var results=[];
  haCands.forEach(function(a){
    if(!a.o) return;
    var combo={h1:{h:a.h,s:a.s,o:a.o,kr:'하',m:a.m},h2:{h:eun.h,s:eun.s,o:eun.o,kr:'은',m:eun.m},s0:fam.s,isOija:false,familyKr:famKr,familyHanja:famHanja};
    var guk=_calcGuk(combo);
    var g=[sd(guk.g1),sd(guk.g2),sd(guk.g3),sd(guk.g4)];
    var daehyung = g.some(function(x){return x.grade==='대흉';});
    var raw=NameScore.scoreCombo(combo,nameSpec,famObj,st,{SURI_DATA:SURI_DATA});
    var ng=calcSajuOhengGrade([a.o,eun.o],BD,BT,{});
    var of=OF[ng.grade]||60;
    var sf=g.reduce(function(s,x){return s+GM[x.grade];},0)/4;
    var disp=Math.round(0.35*of+0.35*sf+0.20*pf+0.10*100);
    var allGoodPlus=g.every(function(x){return x.grade==='길'||x.grade==='대길';});
    results.push({h:a.h,m:a.m,s:a.s,o:a.o,daehyung:daehyung,allGoodPlus:allGoodPlus,raw:raw,disp:disp,gunghap:ng.grade,
      suri:g.map(function(x){return x.n+x.grade;}).join(','), guk:{g1:g[0],g2:g[1],g3:g[2],g4:g[3]}});
  });
  // 대흉 없는 것만, disp desc, raw desc
  var clean=results.filter(function(r){return !r.daehyung;});
  clean.sort(function(x,y){return (y.disp-x.disp)||(y.raw-x.raw);});
  __RESULT__=JSON.stringify({eun:{h:eun.h,m:eun.m,s:eun.s,o:eun.o}, iGyeok25:sd(25), total:results.length, cleanCount:clean.length, top:clean.slice(0,25)},null,1);
})();`;
vm.runInContext(code,ctx,{filename:'find_ha'});
process.stdout.write(ctx.__RESULT__);
