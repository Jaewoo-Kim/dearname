'use strict';
const vm=require('vm'), fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
const ctx=vm.createContext({console,JSON,window:{}});
function load(r){vm.runInContext(fs.readFileSync(path.join(ROOT,r),'utf8'),ctx,{filename:r});}
['data/hanja-db.js'].forEach(load);
const syls = process.argv.slice(2);
const code = `(function(){
  var out={};
  ${JSON.stringify(syls)}.forEach(function(k){
    out[k] = (HANJA_DB_FULL[k]||[]).map(function(x){return x.h+'('+x.o+','+x.s+','+x.m+')';});
  });
  __RESULT__=JSON.stringify(out,null,1);
})();`;
vm.runInContext(code,ctx,{filename:'dump'});
process.stdout.write(ctx.__RESULT__);
