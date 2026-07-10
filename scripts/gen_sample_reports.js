/**
 * scripts/gen_sample_reports.js
 * 최하은 / 최지윤 (여아, 2026-07-02 08:50) 프리미엄 심층 보고서 데이터 생성.
 * 실제 DearName 엔진(만세력·용신·한자DB·81수리·발음오행)을 vm 컨텍스트에서 그대로 구동.
 * 결과 JSON 을 stdout 으로 출력.
 */
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const ctx = vm.createContext({ console, JSON, window: {} });
function load(rel){ vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel }); }

load('data/manjuryeok.js');
load('data/suri-data.js');
load('data/hanja-db.js');
load('lib/saju-engine.js');
load('lib/name-spec.js');
load('lib/name-formula.js');
load('lib/name-score.js');
load('api/claude-report.js');

const compute = `
(function(){
  var BIRTH_DATE='2026-07-02', BIRTH_TIME='08:50', GENDER='F';
  var famKr='최', famHanja='崔';

  var saju = calcSaju(BIRTH_DATE, BIRTH_TIME, {});
  var scores = calcOhengScores(saju);
  var daeun = calcDaeun(saju, BIRTH_DATE, BIRTH_TIME, GENDER, {});
  var nameSpec = buildNameSpec(saju, scores, daeun);

  // 성씨 한자
  var famList = HANJA_DB_FULL['최'] || [];
  var famEntry = famList.find(function(x){return x.h===famHanja;}) || {h:'崔',m:'높을',s:11,o:'土'};
  var s0 = famEntry.s;

  var ONAME = {'木':'목(木)','火':'화(火)','土':'토(土)','金':'금(金)','水':'수(水)'};
  var OKO   = {'木':'나무','火':'불','土':'흙','金':'쇠','水':'물'};

  function suriGrades(g){
    return [g.g1,g.g2,g.g3,g.g4].map(function(n){
      var num=n>81?n%81:n; if(num===0)num=81;
      var d=(typeof SURI_DATA!=='undefined'&&SURI_DATA[num])?SURI_DATA[num]:{name:num+'수격',grade:'평',desc:''};
      return {suri:n, name:d.name, grade:d.grade, desc:d.desc};
    });
  }

  // 흔하고 예쁜 인명용 한자로 후보 제한 (자원오행·획수는 DB 값을 그대로 사용)
  var ALLOW = {
    '하': ['河','昰','荷','賀','嘏','厦','抲','煆'],
    '은': ['恩','垠','銀','誾','殷','慇','听','蒑','嫊'],
    '지': ['池','沚','址','坁','阯','芝','祉','智','知','枝','漬','泜','汥','墀'],
    '윤': ['潤','允','玧','胤','阭','奫','鈗','昀','尹','荺']
  };
  var AVOID = nameSpec.avoid || []; // 기피 오행(火) 자원은 후보에서 제외 → 보고서 논리 일관성

  // 이름 한 개(두 음절)에 대해 후보 조합 채점 → 상위 N 반환
  function pickName(k1,k2){
    var a1=ALLOW[k1], a2=ALLOW[k2];
    var c1=(HANJA_DB_FULL[k1]||[]).filter(function(x){return (!a1 || a1.indexOf(x.h)>=0) && AVOID.indexOf(x.o)<0;});
    var c2=(HANJA_DB_FULL[k2]||[]).filter(function(x){return (!a2 || a2.indexOf(x.h)>=0) && AVOID.indexOf(x.o)<0;});
    var fam={kr:famKr,hanja:famHanja,strokes:s0};
    var state={constraints:{},daeun:daeun,parentOheng:null,_scores:scores};
    var all=[];
    for(var i=0;i<c1.length;i++){
      for(var j=0;j<c2.length;j++){
        var a=c1[i], b=c2[j];
        if(!a.o||!b.o) continue;
        var combo={h1:{h:a.h,s:a.s,o:a.o,kr:k1,m:a.m}, h2:{h:b.h,s:b.s,o:b.o,kr:k2,m:b.m}, s0:s0, isOija:false, familyKr:famKr, familyHanja:famHanja};
        var sc=NameScore.scoreCombo(combo, nameSpec, fam, state, {SURI_DATA:(typeof SURI_DATA!=='undefined'?SURI_DATA:null)});
        if(sc<=-999) continue;
        all.push({score:sc, combo:combo, a:a, b:b});
      }
    }
    all.sort(function(x,y){return y.score-x.score;});
    var top = all.slice(0,6).map(function(t){
      var gg=suriGrades(_calcGuk(t.combo));
      return {hanja:famHanja+t.a.h+t.b.h, score:t.score, o1:t.a.o, o2:t.b.o, m1:t.a.m, m2:t.b.m,
              s1:t.a.s, s2:t.b.s, suri:gg.map(function(g){return g.suri+g.grade;}).join(',')};
    });
    var best=all[0];
    if(!best) return null;
    best.top = top;
    var combo=best.combo;
    var guk=_calcGuk(combo);
    var grades=suriGrades(guk);
    var fields=_genFormulaFields(combo, {constraints:{}, nameSpec:nameSpec, _saju:saju, _scores:scores});
    var pron=NameFormula.gradePronunciation(famKr+k1+k2);
    var nameGrade=calcSajuOhengGrade([best.a.o,best.b.o], BIRTH_DATE, BIRTH_TIME, {});
    return {
      kr: famKr+k1+k2,
      hanja: famHanja+best.a.h+best.b.h,
      syllables:[
        {kr:famKr, h:famEntry.h, m:famEntry.m, s:famEntry.s, o:famEntry.o},
        {kr:k1, h:best.a.h, m:best.a.m, s:best.a.s, o:best.a.o},
        {kr:k2, h:best.b.h, m:best.b.m, s:best.b.s, o:best.b.o}
      ],
      rawScore: best.score,
      top: best.top,
      guk: guk,
      grades: grades,
      pron: pron,
      nameGrade: nameGrade,
      fields: fields
    };
  }

  var out={
    birth:{date:BIRTH_DATE, time:BIRTH_TIME, gender:GENDER, fam:famKr},
    saju:{
      year: saju.year.gan+saju.year.ji,
      month: saju.month.gan+saju.month.ji,
      day: saju.day.gan+saju.day.ji,
      time: saju.time.gan+saju.time.ji,
      raw: saju
    },
    scores: scores,
    nameSpec: nameSpec,
    daeun: daeun,
    fam: famEntry,
    ONAME: ONAME, OKO: OKO,
    reports: {
      haeun: pickName('하','은'),
      jiyun: pickName('지','윤')
    }
  };
  __RESULT__ = JSON.stringify(out);
})();
`;
vm.runInContext(compute, ctx, { filename: 'compute' });
const outPath = process.argv[2];
if (outPath) { fs.writeFileSync(outPath, ctx.__RESULT__, 'utf8'); console.log('wrote ' + outPath); }
else process.stdout.write(ctx.__RESULT__);
