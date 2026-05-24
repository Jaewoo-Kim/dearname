// scan-saju-types.js
// 편중형(max=3, 빈오행없음)과 특수격(max>=4, 빈오행없음) 사주 날짜 스캔

// ── 만세력 + 엔진 로드 ──
eval(require('fs').readFileSync(__dirname + '/../data/manjuryeok.js', 'utf8'));
eval(require('fs').readFileSync(__dirname + '/../lib/saju-engine.js', 'utf8'));

const CG = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
const JJ = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};

function getOhengCount(saju) {
  const cnt = {木:0,火:0,土:0,金:0,水:0};
  for (const p of [saju.year, saju.month, saju.day, saju.time]) {
    if (CG[p.gan]) cnt[CG[p.gan]]++;
    if (JJ[p.ji])  cnt[JJ[p.ji]]++;
  }
  return cnt;
}

function classifySaju(cnt) {
  const vals = Object.values(cnt);
  const hasZero = vals.some(v => v === 0);
  const max = Math.max(...vals);
  if (hasZero)     return '불균형';
  if (max >= 4)    return '특수격';
  if (max === 3)   return '편중형';
  return '균형';
}

const TIMES = [2, 6, 10, 14, 18, 22]; // 대표 시간 6개만

const skewed  = []; // 편중형
const special = []; // 특수격

// 2000년~2010년 전 날짜 스캔
for (let year = 2000; year <= 2010; year++) {
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      for (const hour of TIMES) {
        const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const timeStr = `${String(hour).padStart(2,'0')}:00`;
        try {
          const saju = calcSaju(dateStr, timeStr, { apply30min: false, yajasi: true });
          if (!saju) continue;
          const cnt  = getOhengCount(saju);
          const cls  = classifySaju(cnt);

          if (cls === '편중형' && skewed.length < 5) {
            const dom = Object.entries(cnt).filter(([,v]) => v === Math.max(...Object.values(cnt))).map(([o]) => o).join('');
            skewed.push({ dateStr, timeStr, cnt: JSON.stringify(cnt), dom,
              pillars: `${saju.year.gan}${saju.year.ji} ${saju.month.gan}${saju.month.ji} ${saju.day.gan}${saju.day.ji} ${saju.time.gan}${saju.time.ji}` });
          }
          if (cls === '특수격' && special.length < 5) {
            const dom = Object.entries(cnt).filter(([,v]) => v === Math.max(...Object.values(cnt))).map(([o]) => o).join('');
            special.push({ dateStr, timeStr, cnt: JSON.stringify(cnt), dom,
              pillars: `${saju.year.gan}${saju.year.ji} ${saju.month.gan}${saju.month.ji} ${saju.day.gan}${saju.day.ji} ${saju.time.gan}${saju.time.ji}` });
          }
        } catch(e) {}

        if (skewed.length >= 5 && special.length >= 5) break;
      }
      if (skewed.length >= 5 && special.length >= 5) break;
    }
    if (skewed.length >= 5 && special.length >= 5) break;
  }
  if (skewed.length >= 5 && special.length >= 5) break;
}

console.log('\n=== 편중형 (max=3, 빈오행 없음) ===');
skewed.forEach(r => console.log(`📅 ${r.dateStr} ${r.timeStr}  지배:${r.dom}  오행분포:${r.cnt}\n   사주: ${r.pillars}`));

console.log('\n=== 특수격 (max>=4, 빈오행 없음) ===');
special.forEach(r => console.log(`📅 ${r.dateStr} ${r.timeStr}  지배:${r.dom}  오행분포:${r.cnt}\n   사주: ${r.pillars}`));

if (special.length === 0) {
  console.log('  → 해당 기간에 없음. 범위 확대 중...');
  // 1940~2020 전체 스캔 (특수격만)
  outer: for (let year = 1940; year <= 2020; year++) {
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        for (const hour of [2, 10, 14, 22]) {
          const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const timeStr = `${String(hour).padStart(2,'0')}:00`;
          try {
            const saju = calcSaju(dateStr, timeStr, { apply30min: false, yajasi: true });
            if (!saju) continue;
            const cnt  = getOhengCount(saju);
            const cls  = classifySaju(cnt);
            if (cls === '특수격') {
              const dom = Object.entries(cnt).filter(([,v]) => v === Math.max(...Object.values(cnt))).map(([o]) => o).join('');
              special.push({ dateStr, timeStr, cnt: JSON.stringify(cnt), dom,
                pillars: `${saju.year.gan}${saju.year.ji} ${saju.month.gan}${saju.month.ji} ${saju.day.gan}${saju.day.ji} ${saju.time.gan}${saju.time.ji}` });
              if (special.length >= 5) break outer;
            }
          } catch(e) {}
        }
      }
    }
  }
  console.log('\n=== 특수격 (확장 스캔) ===');
  special.forEach(r => console.log(`📅 ${r.dateStr} ${r.timeStr}  지배:${r.dom}  오행분포:${r.cnt}\n   사주: ${r.pillars}`));
}
