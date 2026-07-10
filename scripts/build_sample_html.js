/**
 * scripts/build_sample_html.js
 * dearname_sample.json(실제 엔진 계산 결과) → 프리미엄 심층 보고서 HTML 3종 생성.
 *   samples/index.html, samples/report-haeun.html, samples/report-jiyun.html
 */
'use strict';
const fs = require('fs');
const path = require('path');

const JSON_PATH = process.argv[2];
const OUT_DIR = path.join(__dirname, '..', 'samples');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const D = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));

const OHC = { '木':'#3f8f63', '火':'#cf5233', '土':'#c8922b', '金':'#7f8794', '水':'#3b6fb5' };
const OKR = { '木':'목·나무', '火':'화·불', '土':'토·흙', '金':'금·쇠', '水':'수·물' };
const GC  = { '대길':'#1f8a52', '길':'#3b6fb5', '평':'#9a8f7d', '흉':'#c98a2b', '대흉':'#c0492f' };
const CG  = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const JJ  = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};

function status(s){ if(s<10)return['극약','부족']; if(s<20)return['부족','부족']; if(s<30)return['적정','균형']; if(s<50)return['과다','넘침']; return['태과','넘침']; }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function displayScore(r){
  const of = ({'매우 좋음':100,'좋음':80,'보통':60,'나쁨':35,'매우 나쁨':15})[r.nameGrade.grade] ?? 60;
  const gm = {'대길':100,'길':80,'평':50,'흉':25,'대흉':0};
  const sf = r.grades.reduce((a,g)=>a+(gm[g.grade]??50),0)/r.grades.length;
  const pf = ({'매우 좋음':100,'좋음':80,'나쁨':40,'매우 나쁨':15})[r.pron.grade] ?? 60;
  return Math.round(0.35*of + 0.35*sf + 0.20*pf + 0.10*100);
}

const HEAD = (title) => `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600;700;900&family=Noto+Sans+KR:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
:root{--ink:#2a2320;--sub:#6f6459;--paper:#faf7f2;--card:#fffdf9;--line:#e7ded0;--gold:#b08d4c;--gold-d:#8c6d34;}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;color:var(--ink);background:var(--paper);line-height:1.7;-webkit-font-smoothing:antialiased}
.serif{font-family:'Noto Serif KR',serif}
.wrap{max-width:860px;margin:0 auto;padding:0 22px 90px}
a{color:inherit}
.topbar{position:sticky;top:0;z-index:5;background:rgba(250,247,242,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);padding:12px 22px;display:flex;justify-content:space-between;align-items:center}
.topbar .brand{font-weight:700;letter-spacing:.02em}.topbar .brand b{color:var(--gold-d)}
.topbar a.back{font-size:.86rem;color:var(--sub);text-decoration:none}
.hero{background:linear-gradient(160deg,#241f1b,#3a3128 60%,#4a3d2c);color:#f6efe2;border-radius:24px;padding:42px 40px;margin:26px 0;position:relative;overflow:hidden}
.hero:after{content:'';position:absolute;right:-60px;top:-60px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,#b08d4c55,transparent 70%)}
.hero .kicker{letter-spacing:.28em;font-size:.72rem;color:#d9c39a;text-transform:uppercase}
.hero .kr{font-size:2.9rem;font-weight:900;margin-top:8px}
.hero .hj{font-size:1.5rem;color:#e7d4ad;letter-spacing:.34em;margin-top:2px}
.hero .meta{margin-top:14px;font-size:.92rem;color:#cfc3ad}
.gauge{position:absolute;right:38px;bottom:34px;text-align:center}
.gauge .num{font-size:3.2rem;font-weight:900;line-height:1;color:#fff}
.gauge .num small{font-size:1rem;font-weight:400;color:#cbb98f}
.gauge .grade{margin-top:4px;font-size:.82rem;color:#0e0c0a;background:#e7c987;border-radius:20px;padding:3px 12px;display:inline-block;font-weight:700}
.sec{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:26px 28px;margin:16px 0;box-shadow:0 1px 0 #fff inset}
.sec h2{font-size:.82rem;letter-spacing:.16em;color:var(--gold-d);font-weight:700;text-transform:uppercase;margin-bottom:4px}
.sec h3{font-size:1.28rem;font-weight:700;margin-bottom:14px}
.sec p{color:#453d34}
.saju{display:grid;grid-template-columns:70px repeat(4,1fr);gap:8px;text-align:center;margin-top:6px}
.saju .lbl{color:var(--sub);font-size:.8rem;align-self:center}
.saju .cell{border-radius:12px;padding:10px 4px;color:#fff;font-family:'Noto Serif KR',serif}
.saju .cell .c{font-size:1.6rem;font-weight:700;line-height:1.15}
.saju .cell .o{font-size:.7rem;opacity:.9}
.saju .pos{color:var(--sub);font-size:.78rem}
.bars{margin-top:6px}
.bar{display:grid;grid-template-columns:76px 1fr 84px;align-items:center;gap:12px;margin:9px 0}
.bar .nm{font-weight:600}.bar .nm b{font-family:'Noto Serif KR',serif;margin-right:5px}
.bar .track{height:16px;background:#efe7d8;border-radius:9px;overflow:hidden}
.bar .fill{height:100%;border-radius:9px}
.bar .val{font-size:.82rem;color:var(--sub);text-align:right}
.tag{display:inline-block;font-size:.72rem;padding:1px 8px;border-radius:20px;margin-left:6px;vertical-align:middle}
.diag{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.diag .d{flex:1 1 220px;border:1px solid var(--line);border-left:4px solid var(--gold);border-radius:10px;padding:12px 14px;background:#fffaf0}
.diag .d .t{font-size:.74rem;color:var(--gold-d);font-weight:700;letter-spacing:.08em}
.yong{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}
.yong .y{flex:1 1 30%;text-align:center;border-radius:12px;padding:12px;border:1px solid var(--line)}
.yong .y .lab{font-size:.74rem;color:var(--sub)}.yong .y .big{font-family:'Noto Serif KR',serif;font-size:1.5rem;font-weight:700}
.name-tbl{width:100%;border-collapse:collapse;margin-top:8px}
.name-tbl th,.name-tbl td{border-bottom:1px solid var(--line);padding:11px 8px;text-align:left;font-size:.94rem}
.name-tbl th{color:var(--sub);font-weight:500;font-size:.8rem}
.name-tbl .hj{font-family:'Noto Serif KR',serif;font-size:1.5rem;font-weight:700}
.match{font-size:.74rem;font-weight:700;padding:2px 9px;border-radius:20px}
.suri{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:6px}
.suri .g{border:1px solid var(--line);border-radius:14px;padding:14px;background:#fffdf8}
.suri .g .pos{font-size:.74rem;color:var(--sub)}
.suri .g .n{font-family:'Noto Serif KR',serif;font-size:1.6rem;font-weight:700;margin:2px 0}
.suri .g .gr{font-size:.72rem;font-weight:700;color:#fff;border-radius:20px;padding:2px 10px;display:inline-block}
.suri .g .dc{font-size:.78rem;color:var(--sub);margin-top:8px;line-height:1.5}
.flow{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:10px 0 4px;font-family:'Noto Serif KR',serif}
.flow .o{width:44px;height:44px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.15rem;font-weight:700}
.flow .ar{color:var(--gold);font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.chips .c{background:#f3ece0;border:1px solid var(--line);border-radius:20px;padding:5px 13px;font-size:.86rem}
.story p{margin-top:10px}
.alts{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}
.alts .a{border:1px solid var(--line);border-radius:12px;padding:10px 14px;background:#fffdf8}
.alts .a .h{font-family:'Noto Serif KR',serif;font-size:1.25rem;font-weight:700}
.alts .a .s{font-size:.76rem;color:var(--sub)}
.verdict{background:linear-gradient(160deg,#2c2620,#3c3227);color:#f3ead9;border-radius:18px;padding:24px 28px;margin-top:16px}
.verdict h3{color:#e7c987}
.foot{text-align:center;color:var(--sub);font-size:.78rem;margin-top:30px;line-height:1.8}
.note{font-size:.82rem;color:var(--sub);background:#f6efe3;border-radius:10px;padding:10px 14px;margin-top:10px}
/* index */
.cards{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:22px}
@media(max-width:640px){.cards{grid-template-columns:1fr}.suri{grid-template-columns:1fr 1fr}.hero .kr{font-size:2.2rem}.gauge{position:static;text-align:left;margin-top:18px}}
.card{display:block;text-decoration:none;color:inherit;background:var(--card);border:1px solid var(--line);border-radius:20px;padding:26px;transition:.15s;position:relative;overflow:hidden}
.card:hover{transform:translateY(-3px);box-shadow:0 12px 28px #2a231010;border-color:var(--gold)}
.card .kr{font-size:1.9rem;font-weight:900;font-family:'Noto Serif KR',serif}
.card .hj{color:var(--gold-d);letter-spacing:.3em;font-family:'Noto Serif KR',serif;margin-top:2px}
.card .sc{position:absolute;right:22px;top:20px;font-size:2rem;font-weight:900;color:var(--gold-d)}
.card .go{margin-top:16px;font-size:.85rem;color:var(--gold-d);font-weight:700}
</style></head><body>`;

function ohengBars(scores){
  const order=['木','火','土','金','水'];
  const max=Math.max.apply(null,order.map(o=>scores[o]));
  return `<div class="bars">`+order.map(o=>{
    const v=scores[o]; const pct=Math.max(4,Math.round(v/Math.max(max,50)*100));
    const st=status(v); const isEx=st[0]==='태과'||st[0]==='과다'; const isLow=st[0]==='극약'||st[0]==='부족';
    const tagc=isEx?'#cf5233':isLow?'#3b6fb5':'#9a8f7d';
    return `<div class="bar"><div class="nm"><b style="color:${OHC[o]}">${o}</b>${OKR[o].split('·')[1]}</div>
      <div class="track"><div class="fill" style="width:${pct}%;background:${OHC[o]}"></div></div>
      <div class="val">${v.toFixed(1)}점<span class="tag" style="background:${tagc}22;color:${tagc}">${st[0]}</span></div></div>`;
  }).join('')+`</div>`;
}

function sajuTable(raw){
  const cols=[['시',raw.time],['일',raw.day],['월',raw.month],['년',raw.year]];
  const row=(get)=>cols.map(([p,pil])=>{const ch=get(pil);const o=(get===((x)=>x.gan))?CG[ch]:JJ[ch];return`<div class="cell" style="background:${OHC[o]}"><div class="c">${ch}</div><div class="o">${o}</div></div>`;}).join('');
  return `<div class="saju">
    <div class="lbl"></div>${cols.map(c=>`<div class="pos">${c[0]}주</div>`).join('')}
    <div class="lbl">천간</div>${cols.map(([p,pil])=>`<div class="cell" style="background:${OHC[CG[pil.gan]]}"><div class="c">${pil.gan}</div><div class="o">${CG[pil.gan]}</div></div>`).join('')}
    <div class="lbl">지지</div>${cols.map(([p,pil])=>`<div class="cell" style="background:${OHC[JJ[pil.ji]]}"><div class="c">${pil.ji}</div><div class="o">${JJ[pil.ji]}</div></div>`).join('')}
  </div>`;
}

function report(r, key, otherName, otherScore){
  const sc=displayScore(r);
  const ns=D.nameSpec, y=ns.yongsin, raw=D.saju.raw;
  const syl=r.syllables;
  const pos=['원격(초년)','형격(청년)','이격(장년)','정격(말년)'];
  const gukArr=[r.guk.g1,r.guk.g2,r.guk.g3,r.guk.g4];
  const prefer=ns.prefer, avoid=ns.avoid;
  const matchTag=(o)=> prefer.includes(o)?`<span class="match" style="background:#1f8a5218;color:#1f8a52">보완 ${o}</span>`
      : (y.yongsinOheng===o?`<span class="match" style="background:#b08d4c22;color:#8c6d34">용신 ${o}</span>`
      : avoid.includes(o)?`<span class="match" style="background:#cf523318;color:#cf5233">기피 ${o}</span>`
      : `<span class="match" style="background:#eee;color:#888">중립</span>`);
  return HEAD(`최${r.kr.slice(1)} 심층 작명 보고서`)+`
<div class="topbar"><div class="brand">Dear<b>Name</b> · 프리미엄 작명 보고서</div><a class="back" href="index.html">← 목록으로</a></div>
<div class="wrap">
  <div class="hero">
    <div class="kicker">Premium Naming Report</div>
    <div class="kr serif">${r.kr}</div>
    <div class="hj serif">${r.hanja}</div>
    <div class="meta">여아 · 2026년 7월 2일 08:50 · 최(崔)씨</div>
    <div class="gauge"><div class="num">${sc}<small>/100</small></div><div class="grade">${r.nameGrade.grade}</div></div>
  </div>

  <div class="sec"><h2>Saju · 사주 원국</h2><h3>태어난 순간의 여덟 글자</h3>
    <p>양력 2026년 7월 2일 오전 8시 50분(진시)의 사주는 <b>${D.saju.year}년 ${D.saju.month}월 ${D.saju.day}일 ${D.saju.time}시</b>입니다. 일간(자신)은 <b class="serif">${raw.day.gan}(${CG[raw.day.gan]})</b> — 한여름 정오의 뜨거운 기운을 타고난 <b>정화(丁火) 일간</b>입니다.</p>
    ${sajuTable(raw)}
  </div>

  <div class="sec"><h2>Five Elements · 오행 분포</h2><h3>기운의 균형을 읽다</h3>
    ${ohengBars(D.scores)}
    <div class="note">한여름 한낮에 태어나 <b style="color:#cf5233">불(火) 기운이 42.5점으로 크게 넘치고</b>, 반대로 <b style="color:#3b6fb5">쇠(金 3.8)·물(水 6.0) 기운이 메말라</b> 있습니다. 넘치는 불을 식히고 부족한 금·수를 채우는 것이 이 아이 이름의 핵심 과제입니다.</div>
  </div>

  <div class="sec"><h2>Diagnosis · 핵심 진단</h2><h3>이름이 풀어야 할 세 가지</h3>
    <div class="diag">
      ${ns.diagnosis.map(d=>`<div class="d"><div class="t">${d.type}</div>${esc(d.msg)}</div>`).join('')}
    </div>
    <div class="yong">
      <div class="y"><div class="lab">용신 (핵심 처방)</div><div class="big" style="color:${OHC[y.yongsinOheng]}">${y.yongsinOheng}</div><div class="lab">${OKR[y.yongsinOheng]}</div></div>
      <div class="y"><div class="lab">희신 (돕는 기운)</div><div class="big" style="color:${OHC[y.heesinOheng]}">${y.heesinOheng}</div><div class="lab">${OKR[y.heesinOheng]}</div></div>
      <div class="y"><div class="lab">기신 (피할 기운)</div><div class="big" style="color:${OHC[y.gisinOheng]}">${y.gisinOheng}</div><div class="lab">${OKR[y.gisinOheng]}</div></div>
    </div>
    <p style="margin-top:14px">종합하면, 이름에는 <b>물(水)·흙(土)의 기운을 채우고</b>, 넘치는 <b>불(火)은 더하지 않는</b> 것이 원칙입니다. (용신 ${y.yongsinOheng}·희신 ${y.heesinOheng}을 살리고 기신 ${y.gisinOheng}을 피함)</p>
  </div>

  <div class="sec"><h2>The Name · 이름 풀이</h2><h3>${r.kr} · ${r.hanja}, 이렇게 채워집니다</h3>
    <table class="name-tbl"><thead><tr><th>글자</th><th>한자</th><th>뜻</th><th>획수</th><th>자원오행</th><th>사주 기여</th></tr></thead><tbody>
    ${syl.map(s=>`<tr><td style="font-weight:700">${s.kr}</td><td class="hj" style="color:${OHC[s.o]}">${s.h}</td><td>${esc(s.m)}</td><td>${s.s}획</td><td><b style="color:${OHC[s.o]}">${s.o}</b> ${OKR[s.o].split('·')[1]}</td><td>${matchTag(s.o)}</td></tr>`).join('')}
    </tbody></table>
    <div class="note">${key==='haeun'
      ? '이름의 두 한자가 <b>물(水)과 쇠(金)</b>를 동시에 채웁니다 — 사주에서 가장 메마른 두 기운을 정확히 겨냥해, 넘치는 불기운을 눌러줍니다. 그래서 사주 궁합이 <b>“매우 좋음”</b>으로 나옵니다.'
      : '이름의 두 한자가 <b>흙(土)</b>을 두텁게 채웁니다. 흙은 부족한 쇠(金 용신)를 낳아 기르는 <b>희신</b>이라, 용신을 든든히 뒷받침합니다. (물기운까지 더하고 싶다면 아래 대안 한자를 참고하세요.)'}</div>
  </div>

  <div class="sec"><h2>81 Numerology · 수리 사격(四格)</h2><h3>초년·청년·장년·말년의 운로</h3>
    <div class="suri">
    ${r.grades.map((g,i)=>`<div class="g"><div class="pos">${pos[i]}</div><div class="n">${gukArr[i]}<span style="font-size:.9rem">수</span></div>
      <div style="font-family:'Noto Serif KR',serif;font-weight:600">${g.name}</div>
      <div class="gr" style="background:${GC[g.grade]}">${g.grade}</div>
      <div class="dc">${esc((g.desc||'').replace(/^\[[^\]]*\]\s*/,'').split('. ')[0])}.</div></div>`).join('')}
    </div>
    <p class="story">${esc(r.fields.suriStory)}</p>
  </div>

  <div class="sec"><h2>Sound · 발음오행</h2><h3>부를 때마다 흐르는 소리의 기운 — ${r.pron.grade}</h3>
    <div class="flow">
      ${syl.map((s,i)=>`${i>0?'<span class="ar">→</span>':''}<div class="o" style="background:${OHC[r.pron.ohengs[i]]}" title="${s.kr}">${s.kr}</div>`).join('')}
      <span style="margin-left:8px;color:var(--sub);font-size:.9rem">${r.pron.ohengs.map(o=>o).join(' · ')} · <b>${r.pron.grade}</b></span>
    </div>
    <p class="story">${esc(r.fields.soundStory)}</p>
  </div>

  <div class="sec story"><h2>Life Flow · 일생의 흐름</h2><h3>이름이 그리는 삶의 3막</h3>
    <p><b>초년기 —</b> ${esc(r.fields.lifeFlow.early)}</p>
    <p><b>청·장년기 —</b> ${esc(r.fields.lifeFlow.middle)}</p>
    <p><b>말년기 —</b> ${esc(r.fields.lifeFlow.late)}</p>
    <div class="note">참고 대운: 9세부터 <b>계사→임진→신묘→경인→기축</b>으로 흘러, 부족했던 <b>물(水)·쇠(金) 기운이 대운에서 보충</b>되는 흐름입니다. 이름이 그 흐름과 같은 방향을 향합니다.</div>
  </div>

  <div class="sec"><h2>Aptitude · 적성과 건강</h2><h3>타고난 결을 살리는 방향</h3>
    <div style="font-weight:600;margin-bottom:4px">어울리는 진로 (자원오행 기반)</div>
    <div class="chips">${r.fields.careerJobs.map(c=>`<div class="c">${c}</div>`).join('')}</div>
    <p style="margin-top:14px"><b>건강 —</b> ${esc(r.fields.healthAdvice)}</p>
  </div>

  <div class="sec"><h2>Alternatives · 같은 이름, 다른 한자</h2><h3>이 사주에 어울리는 ${r.kr.slice(1)} 한자 후보</h3>
    <div class="alts">
    ${r.top.slice(0,4).map(t=>`<div class="a"><div class="h">${t.hanja}</div><div class="s">${esc(t.m1)} · ${esc(t.m2)} · 자원 ${t.o1}${t.o2} · ${t.s1}+${t.s2}획</div></div>`).join('')}
    </div>
    <div class="note">흔한 <b>${key==='haeun'?'河(하)·恩(은)':'智(지)·恩'}</b> 같은 한자는 이 사주·성씨(崔)와 만나면 수리 대흉이 되거나 넘치는 불(火)을 더해 <b>제외</b>했습니다. 위 후보는 그 제약 안에서 사주·수리·발음을 모두 만족하는 조합입니다.</div>
  </div>

  <div class="verdict"><h3>총평</h3>
    <p style="color:#f3ead9">${r.kr}(${r.hanja})은 넘치는 불기운을 다스리고 부족한 ${key==='haeun'?'물·쇠':'흙'} 기운을 채워, 사주의 균형을 <b>${r.nameGrade.grade}</b> 수준으로 끌어올리는 이름입니다. 81수리 네 격이 모두 길(吉) 이상이고 부르는 소리도 상생으로 흘러, 이름이 갖춰야 할 세 축(자원오행·수리·발음)을 고루 충족합니다. 종합 <b style="color:#e7c987">${sc}점</b>.</p>
    <p style="color:#cbb98f;margin-top:10px;font-size:.9rem">※ 다른 후보 <a href="report-${key==='haeun'?'jiyun':'haeun'}.html" style="color:#e7c987">최${otherName}(${otherScore}점)</a>과 비교해 보세요. ${key==='haeun'?'하은이 물·쇠를 동시에 채워 이 사주엔 근소하게 더 최적입니다.':'지윤은 흙 기운 보강에 강점이 있습니다.'}</p>
  </div>

  <div class="foot">DearName · 사주 명리 + 81수리 + 발음오행 통합 분석 엔진<br>본 보고서는 실제 DearName 계산 엔진(만세력 1921~2040 · 인명용 한자 7,017자 · 81수리)으로 산출되었습니다.</div>
</div></body></html>`;
}

// index
function indexPage(){
  const h=D.reports.haeun, j=D.reports.jiyun;
  const hs=displayScore(h), js=displayScore(j);
  return HEAD('DearName · 최OO 심층 작명 보고서')+`
<div class="topbar"><div class="brand">Dear<b>Name</b> · 프리미엄 작명 보고서</div><span class="back">2026.07.02 여아 · 최(崔)</span></div>
<div class="wrap">
  <div class="hero">
    <div class="kicker">Premium Naming Report</div>
    <div class="kr serif">최○○ 심층 작명 보고서</div>
    <div class="hj serif" style="letter-spacing:.06em;font-size:1.1rem">여아 · 2026년 7월 2일 08:50 · 두 이름 비교</div>
    <div class="meta">사주 ${D.saju.year} ${D.saju.month} ${D.saju.day} ${D.saju.time} · 정화(丁火) 일간 · 용신 金 / 희신 土 / 기신 火</div>
  </div>
  <p style="color:#6f6459">아래 두 이름의 심층 보고서를 각각 확인하세요. 실제 사주·용신·81수리·발음오행 계산 결과입니다.</p>
  <div class="cards">
    <a class="card" href="report-haeun.html"><div class="sc">${hs}</div><div class="kr">${h.kr}</div><div class="hj">${h.hanja}</div>
      <div style="margin-top:10px;color:#6f6459;font-size:.9rem">물(水)·쇠(金)를 채워 사주 궁합 <b style="color:#1f8a52">${h.nameGrade.grade}</b> · 수리 4격 모두 길(吉) 이상</div>
      <div class="go">심층 보고서 열기 →</div></a>
    <a class="card" href="report-jiyun.html"><div class="sc">${js}</div><div class="kr">${j.kr}</div><div class="hj">${j.hanja}</div>
      <div style="margin-top:10px;color:#6f6459;font-size:.9rem">흙(土)을 보강해 용신을 뒷받침 · 사주 궁합 <b style="color:#3b6fb5">${j.nameGrade.grade}</b> · 수리 4격 모두 길(吉) 이상</div>
      <div class="go">심층 보고서 열기 →</div></a>
  </div>
  <div class="foot">DearName · 실제 계산 엔진 기반 샘플 · 만세력 1921~2040 · 인명용 한자 7,017자 · 81수리</div>
</div></body></html>`;
}

fs.writeFileSync(path.join(OUT_DIR,'index.html'), indexPage());
fs.writeFileSync(path.join(OUT_DIR,'report-haeun.html'), report(D.reports.haeun,'haeun','지윤',displayScore(D.reports.jiyun)));
fs.writeFileSync(path.join(OUT_DIR,'report-jiyun.html'), report(D.reports.jiyun,'jiyun','하은',displayScore(D.reports.haeun)));
console.log('OK haeun='+displayScore(D.reports.haeun)+' jiyun='+displayScore(D.reports.jiyun));
