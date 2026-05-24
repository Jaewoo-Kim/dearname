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

// ── 동추원 만세력 기준 지역별 지방시 보정값 (초 단위) ──────────────
// 출처: 동추원만세력 4페이지 — 동경135도 기준시간과의 차이
// 보정: 표준시(KST) - 보정초 = 실태양시(지방시)
// 도시 미선택 시 기본값: 서울 1925초(32분5초)
const CITY_CORRECTION_SEC = {
  '백령도':2426, '홍도':2350, '흑산도':2294, '연평도':2232,
  '덕적도':2134, '신안군':2114, '목포':2066,  '서산':2050,
  '제주도':2032, '보령':2028,  '서귀포':2024, '인천':2012,
  '완도':2012,  '군산':2008,  '정읍':1972,  '광주':1937,
  '서울':1925,  '수원':1913,  '평택':1893,  '전주':1884,
  '천안':1884,  '남원':1828,  '대전':1819,  '청주':1803,
  '춘천':1744,  '여수':1740,  '충주':1700,  '원주':1692,
  '사천':1640,  '김천':1632,  '상주':1616,  '통영':1552,
  '마산':1544,  '속초':1536,  '대구':1532,  '안동':1504,
  '강릉':1463,  '태백':1447,  '부산':1428,  '동해':1408,
  '경주':1387,  '울산':1363,  '포항':1353,  '울진':1345,
  '울릉도':985, '독도':741,
};
// 별칭 매핑 (UI 표시명 → DB 키 통일)
const CITY_ALIAS = { '제주':2032, '창원':1544, '세종':1819, '고양':1913 };

// 도시명 → 보정 초 반환 (없으면 서울 기본값)
function getCityCorrection(city) {
  if (!city) return 1925; // 서울 기본
  return CITY_CORRECTION_SEC[city] ?? CITY_ALIAS[city] ?? 1925;
}

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
 * 표준시 보정: 동경 127도30분 표준시 사용 기간에는 기록된 시각이
 * 동경 135도 기준보다 30분 느리므로 절기 비교 시 +30분 보정 필요.
 * 출처: 동추원만세력
 *   Period 1: 1908-04-29 18:00 ~ 1912-01-01 11:30 (KST 135° 기준)
 *   Period 2: 1954-03-21 00:00 ~ 1961-08-10 00:00 (KST 135° 기준)
 * @returns {number} 분 단위 보정값 (+30 또는 0)
 */
function getStdTimeBonus(y, m, d) {
  // Period 1: 1908-04-29 ~ 1912-01-01 (전날까지)
  if (y === 1908 && (m > 4 || (m === 4 && d >= 29))) return 30;
  if (y === 1909 || y === 1910 || y === 1911) return 30;
  if (y === 1912 && m === 1 && d === 1) return 30; // 당일까지
  // Period 2: 1954-03-21 ~ 1961-08-10 (전날까지)
  if (y === 1954 && (m > 3 || (m === 3 && d >= 21))) return 30;
  if (y === 1955 || y === 1956 || y === 1957 || y === 1958 || y === 1959 || y === 1960) return 30;
  if (y === 1961 && (m < 8 || (m === 8 && d < 10))) return 30;
  return 0;
}

/**
 * 서머타임(일광절약시간) 보정: 시계가 1시간 앞당겨진 기간에는
 * 기록된 시각이 실제 태양시보다 1시간 빠르므로 -60분 보정.
 * 출처: 동추원만세력
 */
function getDstPenalty(y, m, d) {
  // [md] 형식 비교용: m*100+d
  const md = m * 100 + d;
  // 동경 135도 사용 연도 (23시→24시 조정, 즉 시작일 자정부터 적용)
  if (y === 1948 && md >= 531 && md <= 912) return -60;
  if (y === 1949 && md >= 402 && md <= 910) return -60;
  if (y === 1950 && md >= 331 && md <= 909) return -60;
  if (y === 1951 && md >= 506 && md <= 908) return -60;
  // 동경 127도30분 사용 연도 (00시→01시 조정)
  if (y === 1955 && md >= 505 && md <= 909) return -60;
  if (y === 1956 && md >= 520 && md <= 930) return -60;
  if (y === 1957 && md >= 505 && md <= 922) return -60;
  if (y === 1958 && md >= 504 && md <= 921) return -60;
  if (y === 1959 && md >= 503 && md <= 920) return -60;
  if (y === 1960 && md >= 501 && md <= 918) return -60;
  // 동경 135도 사용 연도 (02시→03시 조정)
  if (y === 1987 && md >= 510 && md <= 1011) return -60;
  if (y === 1988 && md >= 508 && md <= 1009) return -60;
  return 0;
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

  const applyLocal = options.apply30min !== false; // default: true (지방시 보정)
  const useYajasi  = options.yajasi     !== false; // default: true
  const city       = options.city       || '';

  if (!MANJURYEOK[String(y)]) {
    console.warn(`만세력 없음: ${y}년 (범위: 1921~2040)`);
    return null;
  }

  // ── 시간 보정 (KST → 실태양시) ───────────────────────────────────
  // 출처: 동추원만세력 — 지역별 경도 기준 지방시 보정
  // 보정값: 도시 선택 시 해당 도시 값, 미선택 시 서울(1925초=32분5초)
  // 보정 미적용 시(apply30min=false): 원본 시각 그대로 사용
  const corrSec    = applyLocal ? getCityCorrection(city) : 0;
  const corrMin    = Math.round(corrSec / 60);  // 분 단위 환산 (정수)
  // 표준시 보정: 동경127도30분 사용 기간 +30분 (기록시각이 135도보다 느림)
  const stdBonus   = applyLocal ? getStdTimeBonus(y, m, d) : 0;
  // 서머타임 보정: 시계가 1시간 앞당겨진 기간 -60분
  const dstPenalty = applyLocal ? getDstPenalty(y, m, d) : 0;
  let adjTotal = h * 60 + (min || 0) - corrMin + stdBonus + dstPenalty;
  let adjY = y, adjM = m, adjD = d;
  if (adjTotal < 0) {
    adjTotal += 1440; // 전날로 이동
    const pd = new Date(Date.UTC(y, m - 1, d - 1));
    adjY = pd.getUTCFullYear(); adjM = pd.getUTCMonth() + 1; adjD = pd.getUTCDate();
  }
  const adjH   = Math.floor(adjTotal / 60);
  const adjMin = adjTotal % 60;

  if (!MANJURYEOK[String(adjY)]) {
    console.warn(`만세력 없음: ${adjY}년 (범위: 1921~2040)`);
    return null;
  }

  // ── 연주: 입춘(j['2']) 기준으로 결정 ─────────────────────────────
  // 보정된 날짜·시각 기준으로 입춘 이전이면 전년도 연주 사용
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

  // ── 월주: 보정된 날짜·시각 기준, 만세력 데이터 그대로 사용 ─────────
  // (月干은 달력 연도의 만세력 m[] 데이터를 그대로 따름 — 재산출 하지 않음)
  const monthPillar = getMonthPillar(adjY, adjM, adjD, adjH, adjMin);

  // ── 일주: 보정된 날짜 기준 ────────────────────────────────────────
  const dayPillar = getDayPillar(adjY, adjM, adjD);

  // ── 야자시(夜子時): 보정 후 시각 23:00 이상 → 시주 천간에 다음날 일간 사용 ──
  let timeDayGan = dayPillar.gan;
  if (useYajasi && adjH >= 23) {
    const nd = new Date(Date.UTC(adjY, adjM - 1, adjD + 1));
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

// ── 60갑자 인덱스 변환 ─────────────────────────────────────
function _ganjiToIdx(gan, ji) {
  const gIdx = CHEONGAN.indexOf(gan);
  const jIdx = JIJI.indexOf(ji);
  // n % 10 == gIdx AND n % 12 == jIdx 인 n (0~59) 찾기
  for (let i = 0; i < 6; i++) {
    const n = gIdx + i * 10;
    if (n % 12 === jIdx) return n;
  }
  return 0;
}

// 지지 → 오행 (정기)
const JIJI_OHENG = {
  '子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
  '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'
};

// 대운 하나의 오행 점수 (천간 40pt + 지지 지장간 60pt)
function _calcDaeunOhengScores(gan, ji) {
  const sc = {'木':0,'火':0,'土':0,'金':0,'水':0};
  const go = CHEONGAN_OHENG[gan];
  if (go) sc[go] += 40;
  for (const { gan:jg, ratio } of (JIJANGGAN[ji] || [])) {
    const jo = CHEONGAN_OHENG[jg];
    if (jo) sc[jo] += 60 * ratio;
  }
  return sc;
}

/**
 * 대운 계산
 * @param {Object} saju        calcSaju() 결과
 * @param {string} birthDateStr 'YYYY-MM-DD'
 * @param {string} birthTimeStr 'HH:MM'
 * @param {string} gender      'M' | 'F'
 * @param {Object} options     { apply30min }
 * @returns {{ startAge:number, isForward:boolean, cycles:Array }}
 */
function calcDaeun(saju, birthDateStr, birthTimeStr, gender, options = {}) {
  if (!saju || !birthDateStr) return null;

  const YANG_GAN = new Set(['甲','丙','戊','庚','壬']);
  const isYangYear = YANG_GAN.has(saju.year.gan);
  const isMale     = gender === 'M';
  const isForward  = (isYangYear && isMale) || (!isYangYear && !isMale);

  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const [bh, bmin]   = (birthTimeStr || '12:00').split(':').map(Number);

  // 출생일시를 JS Date (UTC 기준)로 변환
  const birthMs = Date.UTC(by, bm - 1, bd, bh, bmin);

  // 절기 날짜를 ms로 변환하는 헬퍼
  function jeolgiMs(year, monthKey) {
    const yData = MANJURYEOK[String(year)];
    const j = yData?.j?.[String(monthKey)];
    if (!j) return null;
    return Date.UTC(year, monthKey - 1, j.d, j.h, j.min || 0);
  }

  // 순행: 이후 가장 가까운 절기 찾기 (최대 13개월 탐색)
  function daysToNext() {
    for (let delta = 0; delta <= 13; delta++) {
      let y = by, mk = bm + delta;
      while (mk > 12) { mk -= 12; y++; }
      const ms = jeolgiMs(y, mk);
      if (ms !== null && ms > birthMs) {
        return (ms - birthMs) / 86400000;
      }
    }
    return 30; // fallback
  }

  // 역행: 이전 가장 가까운 절기 찾기
  function daysToPrev() {
    for (let delta = 0; delta <= 13; delta++) {
      let y = by, mk = bm - delta;
      while (mk < 1) { mk += 12; y--; }
      const ms = jeolgiMs(y, mk);
      if (ms !== null && ms <= birthMs) {
        return (birthMs - ms) / 86400000;
      }
    }
    return 30; // fallback
  }

  const days     = isForward ? daysToNext() : daysToPrev();
  const startAge = Math.max(1, Math.round(days / 3));

  // 월주 간지 인덱스
  const monthIdx = _ganjiToIdx(saju.month.gan, saju.month.ji);

  // 8개 대운 생성
  const cycles = [];
  for (let i = 1; i <= 8; i++) {
    const idx = isForward
      ? (monthIdx + i) % 60
      : ((monthIdx - i) % 60 + 60) % 60;

    const gan = CHEONGAN[idx % 10];
    const ji  = JIJI[idx % 12];
    cycles.push({
      idx,
      startAge: startAge + (i - 1) * 10,
      endAge:   startAge + i * 10 - 1,
      gan,
      ji,
      ganOheng:    CHEONGAN_OHENG[gan] || '',
      jiOheng:     JIJI_OHENG[ji]      || '',
      ohengScores: _calcDaeunOhengScores(gan, ji),
    });
  }

  return { startAge, isForward, cycles };
}

/**
 * 셀프작명 사주오행 평가 (line 1698 교체용)
 */
function calcSajuOhengGrade(hanjaOhengs, birthDate, birthTime, options = {}) {
  if (!birthDate) {
    const _KR0 = {'木':'나무(木)','火':'불(火)','土':'흙(土)','金':'쇠(金)','水':'물(水)'};
    const hanjaKr = hanjaOhengs.map(o => _KR0[o] || o).join(', ');
    return {
      grade: '나쁨',
      desc: `선택하신 한자의 자원오행은 [${hanjaKr}]입니다. 정확한 평가를 위해 출생일시를 입력해주세요.`
    };
  }

  const saju = calcSaju(birthDate, birthTime || '12:00', options);
  if (!saju) {
    return { grade: '나쁨', desc: '1921~2040년 범위의 날짜를 입력해주세요.' };
  }

  // 셀프 진단 전용: 지장간 미포함, 단순 8자 카운트 기준 (칩 표시와 동일 기준)
  const _CG = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'};
  const _JJ = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'};
  const cnt = {'木':0,'火':0,'土':0,'金':0,'水':0};
  for (const p of [saju.year, saju.month, saju.day, saju.time]) {
    if (p?.gan && _CG[p.gan]) cnt[_CG[p.gan]]++;
    if (p?.ji  && _JJ[p.ji])  cnt[_JJ[p.ji]]++;
  }
  const weakOhengs    = Object.entries(cnt).filter(([,c]) => c === 0).map(([o]) => o);
  const compensated   = weakOhengs.filter(o =>  hanjaOhengs.includes(o));
  const uncompensated = weakOhengs.filter(o => !hanjaOhengs.includes(o));

  if (!weakOhengs.length) {
    // 균형 사주: 단순 "매우 좋음" 대신 상대적 강약으로 세분화
    const _KR = {'木':'나무(木)','火':'불(火)','土':'흙(土)','金':'쇠(金)','水':'물(水)'};
    const _total = Object.values(cnt).reduce((a,b)=>a+b,0);
    const _avg   = _total / 5;
    const relWeak   = Object.entries(cnt).filter(([,c]) => c < _avg).map(([o]) => o);
    const relStrong = Object.entries(cnt).filter(([,c]) => c > _avg).map(([o]) => o);

    // 편중형: 빈 오행은 없지만 한 오행이 정확히 3개로 쏠림 ({3,2,1,1,1})
    const _maxCnt  = Math.max(...Object.values(cnt));
    const _domSet  = Object.entries(cnt).filter(([,c]) => c === _maxCnt).map(([o]) => o);
    const _isSkewed   = _maxCnt === 3;
    const _nameHitsDom = hanjaOhengs.some(o => _domSet.includes(o));

    // 완전 균등 분포(모든 오행 동수)거나 이름 오행 없으면 기본 최고 등급
    if (!relWeak.length || !hanjaOhengs.length) {
      return { grade:'매우 좋음', desc:'사주 오행이 완전히 균등하게 분포되어 있습니다. 이름의 자원오행 선택 자유도가 높습니다.' };
    }

    const hitsRelWeak   = hanjaOhengs.some(o => relWeak.includes(o));
    const hitsRelStrong = hanjaOhengs.some(o => relStrong.includes(o));
    const weakInName    = relWeak.filter(o => hanjaOhengs.includes(o)).map(o => _KR[o]).join(', ');
    const strongInName  = relStrong.filter(o => hanjaOhengs.includes(o)).map(o => _KR[o]).join(', ');
    const allRelWeakKr  = relWeak.map(o => _KR[o]).join(', ');

    // 편중형 + 쏠린(지배) 오행을 이름이 강화 → 나쁨 (약한 걸 일부 채웠더라도)
    if (_isSkewed && _nameHitsDom) {
      const _domInName = _domSet.filter(o => hanjaOhengs.includes(o)).map(o => _KR[o]).join(', ');
      return { grade:'나쁨', desc:`이름이 사주에서 가장 강한 ${_domInName} 기운을 더 강화합니다. ${_domInName} 기운이 한쪽으로 쏠려 있어, ${allRelWeakKr} 위주의 한자 선택을 권장합니다.` };
    }

    if (hitsRelWeak && !hitsRelStrong) {
      return { grade:'매우 좋음', desc:`균형 잡힌 사주에서 상대적으로 약한 ${weakInName} 기운을 이름이 보충합니다.` };
    }
    if (hitsRelWeak && hitsRelStrong) {
      return { grade:'좋음', desc:`이름이 상대적으로 약한 ${weakInName} 기운을 보충하지만, 이미 강한 ${strongInName} 기운도 함께 강화합니다. ${allRelWeakKr} 위주의 한자 선택이 더 이상적입니다.` };
    }
    if (hitsRelStrong) {
      return { grade:'나쁨', desc:`이름의 자원오행이 사주에서 이미 강한 ${strongInName} 기운을 더욱 강화합니다. 상대적으로 약한 ${allRelWeakKr} 기운의 한자 선택을 권장합니다.` };
    }
    // 이름 오행이 중간값(relWeak도 relStrong도 아닌 균등 구간)
    return { grade:'매우 좋음', desc:'사주 오행이 고루 균형 잡혀 있어 이름의 자원오행이 사주와 자연스럽게 조화를 이룹니다.' };
  }
  // 오행 한자 → 한국어 변환 (불균형 분기용)
  const _KR2 = {'木':'나무(木)','火':'불(火)','土':'흙(土)','金':'쇠(金)','水':'물(水)'};
  const _toKr = arr => arr.map(o => _KR2[o] || o).join(', ');
  if (compensated.length === weakOhengs.length)
    return { grade:'매우 좋음', desc:`사주에 부족한 ${_toKr(weakOhengs)} 기운을 이름의 한자가 채워주고 있습니다.` };
  if (compensated.length > 0)
    return { grade:'좋음',     desc:`${_toKr(compensated)} 기운은 보완됩니다. ${_toKr(uncompensated)} 기운 보완도 함께 고려해보세요.` };
  return   { grade:'나쁨',     desc:`사주에 없는 ${_toKr(weakOhengs)} 기운이 이름에 반영되지 않았습니다. 해당 오행의 한자 선택을 권장합니다.` };
}
