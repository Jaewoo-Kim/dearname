// scripts/find_10_options.js — 프리미엄 예시 10옵션 탐색
// 崔(11획) + 사주(2026-07-02 08:50 여아) 조건에서, 현대적 인기 음절 조합 x
// 실제 작명에 흔히 쓰이는 한자만으로 자원오행/수리/발음을 전수 계산.
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
  var AVOID=nameSpec.avoid||[];
  function sd(n){var v=n>81?n%81:n;if(v===0)v=81;var d=SURI_DATA[v]||{name:v+'',grade:'평'};return {n:n,name:d.name,grade:d.grade};}

  // ── 실제 작명에서 흔히 쓰는 한자 화이트리스트 (음절별) ──
  // 도메인 지식 기반 큐레이션: 뜻이 좋고 대중적으로 익숙한 인명용 한자만.
  var WL = {
    '서':['瑞','序','舒','徐'],
    '윤':['尹','潤','玧','允'],
    '아':['雅','娥','兒','亞'],
    '이':['怡','利','伊'],
    '지':['智','志','芝','池','知','誌'],
    '하':['夏','河','賀','嘏'],
    '채':['彩','采','菜','蔡'],
    '소':['昭','素','沼','韶'],
    '린':['潾','璘'],
    '연':['妍','姸','然','延','演','淵','娟'],
    '예':['藝','睿','禮','芮','譽'],
    '안':['安','岸'],
    '율':['律','聿'],
    '은':['恩','銀','誾','垠'],
    '수':['秀','洙','水','琇'],
    '유':['柔','有','裕','侑'],
    '온':['溫'],
    '나':['娜','那'],
    '라':['羅'],
    '리':['理','璃','俐'],
    '루':['樓']
  };
  var syllables = Object.keys(WL);

  // 자연스러운 이름 쌍 후보 (실제 인기 이름 패턴 기반, 양쪽 다 화이트리스트 음절)
  var pairs = [
    ['서','윤'],['서','아'],['서','연'],['서','율'],['서','은'],['서','린'],
    ['이','서'],['이','안'],['이','린'],
    ['아','린'],['아','율'],['아','윤'],['아','라'],
    ['소','율'],['소','연'],['소','은'],['소','이'],['소','윤'],
    ['채','연'],['채','린'],
    ['예','린'],['예','서'],['예','은'],
    ['나','윤'],['나','린'],
    ['라','윤'],
    ['유','나'],['유','린'],
    ['하','율'],['하','린'],['하','윤'],
    ['온','유'],['온','서'],
    ['지','안'],['지','율'],['지','윤'],['지','은'],
    ['수','린'],['수','아'],
    ['리','안'],['리','나'],
    ['루','아'],['루','나']
  ];

  var famObj={kr:famKr,hanja:famHanja,strokes:fam.s};
  var st={constraints:{},daeun:daeun,parentOheng:null,_scores:scores};

  var all=[];
  pairs.forEach(function(pair){
    var k1=pair[0], k2=pair[1];
    var wl1=WL[k1]||[], wl2=WL[k2]||[];
    var c1=(HANJA_DB_FULL[k1]||[]).filter(function(x){return wl1.indexOf(x.h)>=0 && AVOID.indexOf(x.o)<0;});
    var c2=(HANJA_DB_FULL[k2]||[]).filter(function(x){return wl2.indexOf(x.h)>=0 && AVOID.indexOf(x.o)<0;});
    var pron=NameFormula.gradePronunciation(famKr+k1+k2);
    var pf=OF[pron.grade]||60;
    var modernBonus = calcModernBonus(k1,k2);
    c1.forEach(function(a){ c2.forEach(function(b){
      var combo={h1:{h:a.h,s:a.s,o:a.o,kr:k1,m:a.m},h2:{h:b.h,s:b.s,o:b.o,kr:k2,m:b.m},s0:fam.s,isOija:false,familyKr:famKr,familyHanja:famHanja};
      var guk=_calcGuk(combo);
      var g=[sd(guk.g1),sd(guk.g2),sd(guk.g3),sd(guk.g4)];
      var daehyung=g.some(function(x){return x.grade==='대흉';});
      if(daehyung) return;
      var hasHyung=g.some(function(x){return x.grade==='흉';});
      var raw=NameScore.scoreCombo(combo,nameSpec,famObj,st,{SURI_DATA:SURI_DATA,MODERN_SYLLABLE_SCORE:MODERN_SYLLABLE_SCORE,OLDFASHIONED_SET:(typeof OLDFASHIONED_SYLLABLES!=='undefined'?OLDFASHIONED_SYLLABLES:null)});
      if(raw<=-999) return;
      var ng=calcSajuOhengGrade([a.o,b.o],BD,BT,{});
      var of=OF[ng.grade]||60;
      var sf=g.reduce(function(s,x){return s+GM[x.grade];},0)/4;
      var disp=Math.round(0.35*of+0.35*sf+0.20*pf+0.10*100);
      all.push({
        kr:famKr+k1+k2, hanja:famHanja+a.h+b.h, k1:k1,k2:k2,
        m1:a.m,m2:b.m,o1:a.o,o2:b.o,s1:a.s,s2:b.s,
        raw:raw, disp:disp, gunghap:ng.grade, pron:pron.grade, hasHyung:hasHyung, modernBonus:modernBonus,
        suri:g.map(function(x){return x.n+x.grade;}).join(',')
      });
    }); });
  });
  all.sort(function(x,y){
    var xa=(x.gunghap==='매우 좋음'?2:x.gunghap==='좋음'?1:0), ya=(y.gunghap==='매우 좋음'?2:y.gunghap==='좋음'?1:0);
    return (ya-xa)||(y.disp-x.disp)||(y.raw-x.raw);
  });
  // kr당 최고점 1개만 남기기(같은 이름 중복 방지), 상위 60개
  var seenKr={}; var uniq=[];
  all.forEach(function(r){ if(!seenKr[r.kr]){ seenKr[r.kr]=1; uniq.push(r); } });
  __RESULT__=JSON.stringify({total:all.length, uniqTotal:uniq.length, top:uniq.slice(0,60)});
})();`;
vm.runInContext(code,ctx,{filename:'find10'});
const result = JSON.parse(ctx.__RESULT__);
console.log('total combos(no-대흉):', result.total, '/ unique names:', result.uniqTotal);
result.top.forEach((r,i) => {
  console.log(`${i+1}. ${r.hanja} (${r.kr})  disp=${r.disp} raw=${r.raw} 궁합=${r.gunghap} 발음=${r.pron}${r.hasHyung?' [흉1곳]':' [흉0]'}  ${r.o1}+${r.o2} ${r.s1}+${r.s2}획  수리[${r.suri}]  ${r.m1}/${r.m2}`);
});
fs.writeFileSync(path.join(__dirname,'..','_10opt_result.json'), JSON.stringify(result,null,1));
