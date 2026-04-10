// lib/saju-engine.js
// 동추원 만세력 (MANJURYEOK) 기반 정확한 사주 계산 엔진
// 검증: 2025.3.25 16:29 → 乙巳년 己卯월 癸巳일 庚申시 ✅

const CHEONGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const JIJI     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

const CHEONGAN_OHENG = {
  '甲':'木','乙':'木','丙':'火','丁':'火',
  '戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'
};

// 지장간 비율 (기획서 p.13: 초기15% / 중기25% / 정기60%)
const JIJANGGAN = {
  '子':[{gan:'壬',ratio:0.40},{gan:'癸',ratio:0.60}],
  '丑':[{gan:'癸',ratio:0.15},{gan:'辛',ratio:0.25},{gan:'己',ratio:0.60}],
  '寅':[{gan:'戊',ratio:0.15},{gan:'丙',ratio:0.25},{gan:'甲',ratio:0.60}],
  '卯':[{gan:'甲',ratio:0.40},{gan:'乙',ratio:0.60}],
  '辰':[{gan:'乙',ratio:0.15},{gan:'癸',ratio:0.25},{gan:'戊',ratio:0.60}],
  '巳':[{gan:'戊',ratio:0.15},{gan:'庚',ratio:0.25},{gan:'丙',ratio:0.60}],
  '午':[{gan:'丙',ratio:0.15},{gan:'己',ratio:0.25},{gan:'丁',ratio:0.60}],
  '未':[{gan:'丁',ratio:0.15},{gan:'乙',ratio:0.25},{gan:'己',ratio:0.60}],
  '申':[{gan:'戊',ratio:0.15},{gan:'壬',ratio:0.25},{gan:'庚',ratio:0.60}],
  '酉':[{gan:'庚',ratio:0.40},{gan:'辛',ratio:0.60}],
  '戌':[{gan:'辛',ratio:0.15},{gan:'丁',ratio:0.25},{gan:'戊',ratio:0.60}],
  '亥':[{gan:'戊',ratio:0.15},{gan:'甲',ratio:0.25},{gan:'壬',ratio:0.60}],
};

// 연주 — 甲子(1984) 기준 60갑자 순환
const YEAR_BASE = { year:1984, ganIdx:0, jiIdx:0 }; // 甲(0)子(0)

function getYearPillar(year) {
  const diff = ((year - YEAR_BASE.year) % 60 + 60) % 60;
  return {
    gan: CHEONGAN[(YEAR_BASE.ganIdx + diff) % 10],
    ji:  JIJI[(YEAR_BASE.jiIdx  + diff) % 12]
  };
}

// 월주 — MANJURYEOK.m + 절기(j) 기준 정밀 분기
function getMonthPillar(year, month, day, hour, min) {
  const yData = MANJURYEOK[String(year)];
  if (!yData) return { gan:'', ji:'' };

  const jeolgi = yData.j[String(month)];

  if (jeolgi) {
    const isBeforeJeolgi =
      day < jeolgi.d ||
      (day === jeolgi.d && hour < jeolgi.h) ||
      (day === jeolgi.d && hour === jeolgi.h && min < (jeolgi.min || 0));

    if (isBeforeJeolgi) {
      // 절기 이전 → 전월 월주
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear  = month === 1 ? year - 1 : year;
      const prevData  = MANJURYEOK[String(prevYear)];
      const s = (prevData?.m[String(prevMonth)] || '').replace('月','');
      return parsePillar(s);
    }
  }

  const s = (yData.m[String(month)] || '').replace('月','');
  return parsePillar(s);
}

// 일주 — MANJURYEOK 1월1일 일진 + 경과일
function getDayPillar(year, month, day) {
  const yData = MANJURYEOK[String(year)];
  if (!yData || !yData.g) return { gan:'', ji:'' };

  const baseDate   = new Date(Date.UTC(year, 0, 1));
  const targetDate = new Date(Date.UTC(year, month - 1, day));
  const delta = Math.round((targetDate - baseDate) / 86400000);

  const ganIdx = (CHEONGAN.indexOf(yData.g) + delta + 100) % 10;
  const jiIdx  = (JIJI.indexOf(yData.z)     + delta + 120) % 12;

  return { gan: CHEONGAN[ganIdx], ji: JIJI[jiIdx] };
}

// 시주 — 일간 + 시각 (五子遁法)
function getTimePillar(dayGan, hour) {
  // 시지
  const TIME_JI = [
    [23,1,'子'],[1,3,'丑'],[3,5,'寅'],[5,7,'卯'],
    [7,9,'辰'],[9,11,'巳'],[11,13,'午'],[13,15,'未'],
    [15,17,'申'],[17,19,'酉'],[19,21,'戌'],[21,23,'亥']
  ];
  let timeJi = '子';
  if (hour === 23) {
    timeJi = '子';
  } else {
    for (const [s,e,ji] of TIME_JI) {
      if (hour >= s && hour < e) { timeJi = ji; break; }
    }
  }

  // 시간 — 甲己→甲, 乙庚→丙, 丙辛→戊, 丁壬→庚, 戊癸→壬
  const DAY_BASE = {'甲':0,'己':0,'乙':2,'庚':2,'丙':4,'辛':4,'丁':6,'壬':6,'戊':8,'癸':8};
  const base   = DAY_BASE[dayGan] ?? 0;
  const jiIdx  = JIJI.indexOf(timeJi);
  const ganIdx = (base + jiIdx) % 10;

  return { gan: CHEONGAN[ganIdx], ji: timeJi };
}

function parsePillar(s) {
  if (!s || s.length < 2) return { gan:'', ji:'' };
  return { gan: s[0], ji: s[1] };
}

/**
 * 메인 사주 계산 함수
 * @param {string} dateStr   'YYYY-MM-DD' (양력)
 * @param {string} timeStr   'HH:MM'
 * @param {Object} options
 *   apply30min {boolean}  한국 실태양시 보정 (+30분 적용, default: true)
 *                         KST(UTC+9)는 한국 경도(127.5°E) 실태양시보다 30분 빠름.
 *                         절기·시주 경계 비교 시 출생 시각에 +30분 적용.
 *   yajasi     {boolean}  야자시(夜子時) 적용 (default: true)
 *                         23:00~24:00 자시는 당일 일주를 유지하되
 *                         시주 천간 계산엔 다음날 일간 사용.
 * @returns {Object|null} { year, month, day, time } 각각 { gan, ji }
 */
function calcSaju(dateStr, timeStr, options = {}) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min]  = (timeStr || '12:00').split(':').map(Number);

  const apply30min = options.apply30min !== false; // default: true
  const useYajasi  = options.yajasi     !== false; // default: true

  if (!MANJURYEOK[String(y)]) {
    console.warn(`만세력 없음: ${y}년 (범위: 1921~2040)`);
    return null;
  }

  // ── 시간 보정 ──────────────────────────────────────────────────────
  // +30분을 출생 시각에 더해 절기·시주 경계를 비교
  let adjTotal = h * 60 + (min || 0) + (apply30min ? 30 : 0);
  let adjY = y, adjM = m, adjD = d;
  if (adjTotal >= 1440) {
    adjTotal -= 1440;
    const nd = new Date(Date.UTC(y, m - 1, d + 1));
    adjY = nd.getUTCFullYear(); adjM = nd.getUTCMonth() + 1; adjD = nd.getUTCDate();
  }
  const adjH   = Math.floor(adjTotal / 60);
  const adjMin = adjTotal % 60;

  // ── 연주: 입춘(j['2']) 기준으로 결정 ─────────────────────────────
  // 입춘 이전이면 전년도 연주 사용
  const ipchunData = MANJURYEOK[String(adjY)]?.j['2'];
  let yearForPillar = adjY;
  if (ipchunData) {
    const beforeIpchun =
      adjM < 2 ||
      (adjM === 2 && adjD < ipchunData.d) ||
      (adjM === 2 && adjD === ipchunData.d && adjH < ipchunData.h) ||
      (adjM === 2 && adjD === ipchunData.d && adjH === ipchunData.h && adjMin < (ipchunData.min || 0));
    if (beforeIpchun) yearForPillar = adjY - 1;
  }
  const yearPillar = getYearPillar(yearForPillar);

  // ── 월주: 절기 기반 지지(地支)는 유지, 입춘 이전이면 五虎遁法 천간 재산출 ──
  // getMonthPillar는 절기 경계를 정확히 비교해 지지를 결정하지만
  // 천간은 해당 연도 사이클 기준이므로, 입춘 이전엔 전년도 사이클로 재산출
  let monthPillar = getMonthPillar(adjY, adjM, adjD, adjH, adjMin);
  if (yearForPillar !== adjY && monthPillar.ji) {
    // 五虎遁法: 年干 → 子月 시작 천간 offset
    // 甲/己→0, 乙/庚→2, 丙/辛→4, 丁/壬→6, 戊/癸→8
    const MONTH_GAN_BASE = {甲:0,己:0,乙:2,庚:2,丙:4,辛:4,丁:6,壬:6,戊:8,癸:8};
    const base   = MONTH_GAN_BASE[yearPillar.gan] ?? 0;
    const jiIdx  = JIJI.indexOf(monthPillar.ji);
    monthPillar  = { gan: CHEONGAN[(base + jiIdx) % 10], ji: monthPillar.ji };
  }

  // ── 일주: 달력 기준 날짜 ──────────────────────────────────────────
  const dayPillar = getDayPillar(y, m, d);

  // ── 야자시(夜子時): 원래 입력 시각 23:00 이상 → 시주 천간에 다음날 일간 사용 ──
  let timeDayGan = dayPillar.gan;
  if (useYajasi && h >= 23) {
    const nd = new Date(Date.UTC(y, m - 1, d + 1));
    timeDayGan = getDayPillar(nd.getUTCFullYear(), nd.getUTCMonth() + 1, nd.getUTCDate()).gan;
  }

  return {
    year:  yearPillar,
    month: monthPillar,
    day:   dayPillar,
    time:  getTimePillar(timeDayGan, adjH)
  };
}

/**
 * 오행 점수 계산 (총 100점)
 * 천간 각 10점, 지지 각 15점 (지장간 비율 분배)
 */
function calcOhengScores(saju) {
  const scores = { '木':0, '火':0, '土':0, '金':0, '水':0 };
  const pillars = [saju.year, saju.month, saju.day, saju.time];

  for (const { gan, ji } of pillars) {
    if (!gan || !ji) continue;
    const ganO = CHEONGAN_OHENG[gan];
    if (ganO) scores[ganO] += 10;

    for (const { gan:jGan, ratio } of (JIJANGGAN[ji] || [])) {
      const jO = CHEONGAN_OHENG[jGan];
      if (jO) scores[jO] += 15 * ratio;
    }
  }
  return scores;
}

/**
 * 오행 점수 → 세력 상태 (기획서 p.26)
 */
function getSeoryeokStatus(score) {
  if (score < 10)  return 'extreme_weak';  // 극약
  if (score < 20)  return 'weak';          // 부족
  if (score < 30)  return 'balanced';      // 적정
  if (score < 50)  return 'strong';        // 과다
  return 'extreme_strong';                 // 태과
}

const SEORYEOK_LABEL = {
  'extreme_weak':'부족', 'weak':'약함', 'balanced':'보통', 'strong':'강함', 'extreme_strong':'과다'
};

/**
 * 셀프작명 사주오행 평가 (line 1698 교체용)
 */
function calcSajuOhengGrade(hanjaOhengs, birthDate, birthTime, options = {}) {
  if (!birthDate) {
    return {
      grade: '평',
      desc: `선택하신 한자의 자원오행은 [${hanjaOhengs.join(', ')}]입니다. 정확한 평가를 위해 출생일시를 입력해주세요.`
    };
  }

  const saju = calcSaju(birthDate, birthTime || '12:00', options);
  if (!saju) {
    return { grade: '평', desc: '1921~2040년 범위의 날짜를 입력해주세요.' };
  }

  const scores = calcOhengScores(saju);
  const weakOhengs    = Object.entries(scores).filter(([,s])=>s<10).map(([o])=>o);
  const compensated   = weakOhengs.filter(o =>  hanjaOhengs.includes(o));
  const uncompensated = weakOhengs.filter(o => !hanjaOhengs.includes(o));

  if (!weakOhengs.length)
    return { grade:'평',   desc:'사주 오행이 비교적 균형 잡혀 있습니다. 특정 보완이 필수는 아닙니다.' };
  if (compensated.length === weakOhengs.length)
    return { grade:'대길', desc:`사주에 부족한 [${weakOhengs.join(', ')}] 기운을 선택하신 한자가 완벽히 보완합니다. 탁월한 선택입니다.` };
  if (compensated.length > 0)
    return { grade:'길',   desc:`[${compensated.join(', ')}]는 보완됩니다. [${uncompensated.join(', ')}] 기운 보완도 고려해보세요.` };
  return   { grade:'흉',   desc:`사주에 부족한 [${weakOhengs.join(', ')}] 기운이 이름에 반영되지 않았습니다. 해당 오행의 한자 선택을 권장합니다.` };
}
