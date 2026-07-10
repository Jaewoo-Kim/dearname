'use strict';
const vm=require('vm'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const ctx=vm.createContext({console,JSON,window:{}});
function load(r){vm.runInContext(fs.readFileSync(path.join(ROOT,r),'utf8'),ctx,{filename:r});}
['data/manjuryeok.js','data/suri-data.js','data/hanja-db.js','lib/saju-engine.js','lib/name-spec.js','lib/name-formula.js','lib/name-score.js','api/claude-report.js'].forEach(load);
const code=`(function(){
  var BD='2026-07-02',BT='08:50';
  var saju=calcSaju(BD,BT,{});
  var CG={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  var JJ={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
  var cnt={'木':0,'火':0,'土':0,'金':0,'水':0};
  [saju.year,saju.month,saju.day,saju.time].forEach(function(p){ if(CG[p.gan])cnt[CG[p.gan]]++; if(JJ[p.ji])cnt[JJ[p.ji]]++; });
  var O=['木','火','土','金','水'];
  var pairs=[];
  for(var i=0;i<5;i++)for(var j=i;j<5;j++){ var g=calcSajuOhengGrade([O[i],O[j]],BD,BT,{}); pairs.push({p:O[i]+'+'+O[j],grade:g.grade}); }
  // 흔한 한자들의 자원오행
  function jaone(k,h){ var e=(HANJA_DB_FULL[k]||[]).find(function(x){return x.h===h;}); return e?e.o:'?'; }
  var commons=[
    ['지','智'],['지','志'],['지','芝'],['지','池'],['지','誌'],['지','知'],
    ['윤','允'],['윤','潤'],['윤','尹'],['윤','昀'],['윤','胤'],
    ['은','恩'],['은','銀'],['은','誾'],['은','垠'],
    ['하','河'],['하','夏'],['하','昰'],['하','荷']
  ].map(function(x){return x[1]+'('+x[0]+')='+jaone(x[0],x[1]);});
  __RESULT__=JSON.stringify({saju:saju.year.gan+saju.year.ji+' '+saju.month.gan+saju.month.ji+' '+saju.day.gan+saju.day.ji+' '+saju.time.gan+saju.time.ji, cnt:cnt, pairs:pairs, commons:commons},null,1);
})();`;
vm.runInContext(code,ctx,{filename:'gm'});
process.stdout.write(ctx.__RESULT__);
