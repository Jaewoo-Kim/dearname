// scripts/find_best_names.js — 세련된 신규 이름 옵션 탐색
// 崔(11획) + 사주(丁火 일간, 火태과, 金水극약, 용신金 희신土 기신火)
// MODERN_SYLLABLE_SCORE(여아 인기 음절)에서 두 음절 쌍을 골라
// 자원오행 매우좋음(prefer 채움) + 수리 대흉없음 + 상용한자만 남기고 랭킹.
'use strict';
const vm=require('vm'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const ctx=vm.createContext({console,JSON,window:{}});
function load(r){vm.runInContext(fs.readFileSync(path.join(ROOT,r),'utf8'),ctx,{filename:r});}
['data/manjuryeok.js','data/suri-data.js','data/hanja-db.js','data/modern-name-db.js','lib/saju-engine.js','lib/name-spec.js','lib/name-formula.js','lib/name-score.js','api/claude-report.js'].forEach(load);

const code=`(function(){
  var BD='2026-07-02',BT='08:50',famKr='최',famHanja='崔';
  var saju=calcSaju(BD,BT,{}),scores=calcOhengScores(saju),daeun=calcDaeun(saju,BD,BT,'F',{});
  var nameSpec=buildNameSpec(saju,scores,daeun);
  var fam=(HANJA_DB_FULL['최']||[]).find(function(x){return x.h===famHanja;});
  var GM={'대길':100,'길':80,'평':50,'흉':25,'대흉':0};
  var OF={'매우 좋음':100,'좋음':80,'보통':60,'나쁨':35,'매우 나쁨':15};
  function sd(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v+'',grade:'평'};return {n:n,name:d.name,grade:d.grade};}
  var AVOID=nameSpec.avoid||[]; // 火 제외

  // 여아 인기 음절 (통합음절 제외, 단일 음절만)
  var femaleSyl = ['서','윤','아','이','지','하','채','소','린','연','예','안','율','은','수','유','온','나','루','리','라','슬','솔','달','별'];
  // 세련된 조합 후보 (두 음절 모두 인기 음절, 실제 자연스러운 이름 쌍)
  var pairs = [
    ['서','윤'],['서','아'],['서','연'],['서','율'],['이','서'],['아','린'],['아','율'],
    ['소','율'],['소','연'],['채','연'],['채','린'],['예','린'],['예','서'],['나','윤'],
    ['라','윤'],['유','나'],['하','율'],['안','나'],['온','유'],['지','안'],['지','율'],
    ['수','린'],['리','안'],['루','아']
  ];

  var famObj={kr:famKr,hanja:famHanja,strokes:fam.s};
  var st={constraints:{},daeun:daeun,parentOheng:null,_scores:scores};

  var allResults=[];
  pairs.forEach(function(pair){
    var k1=pair[0], k2=pair[1];
    var c1=(HANJA_DB_FULL[k1]||[]).filter(function(x){return x.o && AVOID.indexOf(x.o)<0;});
    var c2=(HANJA_DB_FULL[k2]||[]).filter(function(x){return x.o && AVOID.indexOf(x.o)<0;});
    var pron=NameFormula.gradePronunciation(famKr+k1+k2);
    var pf=OF[pron.grade]||60;
    var modernBonus = calcModernBonus(k1,k2);
    for(var i=0;i<c1.length;i++)for(var j=0;j<c2.length;j++){
      var a=c1[i], b=c2[j];
      // 상용한자 필터: 유니코드 기본 한자 영역(U+4E00~U+9FFF)만, 획수 3~18
      var cpA=a.h.codePointAt(0), cpB=b.h.codePointAt(0);
      if(cpA<0x4E00||cpA>0x9FFF||cpB<0x4E00||cpB>0x9FFF) continue;
      if(a.s<3||a.s>18||b.s<3||b.s>18) continue;
      var combo={h1:{h:a.h,s:a.s,o:a.o,kr:k1,m:a.m},h2:{h:b.h,s:b.s,o:b.o,kr:k2,m:b.m},s0:fam.s,isOija:false,familyKr:famKr,familyHanja:famHanja};
      var guk=_calcGuk(combo);
      var g=[sd(guk.g1),sd(guk.g2),sd(guk.g3),sd(guk.g4)];
      var daehyung=g.some(function(x){return x.grade==='대흉';});
      if(daehyung) continue; // 대흉 하드 제외
      var hasHyung=g.some(function(x){return x.grade==='흉';});
      var raw=NameScore.scoreCombo(combo,nameSpec,famObj,st,{SURI_DATA:SURI_DATA,MODERN_SYLLABLE_SCORE:MODERN_SYLLABLE_SCORE,OLDFASHIONED_SET:(typeof OLDFASHIONED_SYLLABLES!=='undefined'?OLDFASHIONED_SYLLABLES:null)});
      if(raw<=-999) continue;
      var ng=calcSajuOhengGrade([a.o,b.o],BD,BT,{});
      var of=OF[ng.grade]||60;
      var sf=g.reduce(function(s,x){return s+GM[x.grade];},0)/4;
      var disp=Math.round(0.35*of+0.35*sf+0.20*pf+0.10*100);
      allResults.push({
        kr:famKr+k1+k2, hanja:famHanja+a.h+b.h, k1:k1,k2:k2,
        a:{h:a.h,m:a.m,s:a.s,o:a.o}, b:{h:b.h,m:b.m,s:b.s,o:b.o},
        raw:raw, disp:disp, gunghap:ng.grade, pron:pron.grade, hasHyung:hasHyung, modernBonus:modernBonus,
        suri:g.map(function(x){return x.n+x.grade;}).join(','), allGoodPlus: !hasHyung
      });
    }
  });
  // 매우좋음 궁합 + 흉없음(allGoodPlus) 우선, 그 다음 disp, 그 다음 raw
  allResults.sort(function(x,y){
    var xa=(x.gunghap==='매우 좋음'?2:x.gunghap==='좋음'?1:0), ya=(y.gunghap==='매우 좋음'?2:y.gunghap==='좋음'?1:0);
    var xg=x.allGoodPlus?1:0, yg=y.allGoodPlus?1:0;
    return (ya-xa)||(yg-xg)||(y.disp-x.disp)||(y.raw-x.raw);
  });
  __RESULT__=JSON.stringify({total:allResults.length, top:allResults.slice(0,40)},null,1);
})();`;
vm.runInContext(code,ctx,{filename:'find_best'});
process.stdout.write(ctx.__RESULT__);
