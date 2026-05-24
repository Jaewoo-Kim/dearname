# -*- coding: utf-8 -*-
# scan_saju_types.py
import sys, json, re
sys.stdout.reconfigure(encoding='utf-8')
from datetime import date, timedelta

# ── 만세력 JSON 파싱 ──
with open(r'C:\dearname\data\manjuryeok.js', encoding='utf-8') as f:
    raw = f.read()
# "const MANJURYEOK = {...};" 에서 JSON 부분 추출
match = re.search(r'const MANJURYEOK\s*=\s*(\{.*\});?', raw, re.DOTALL)
MANJURYEOK = json.loads(match.group(1))

CHEONGAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸']
JIJI     = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']

CG_OHENG = {'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土',
             '庚':'金','辛':'金','壬':'水','癸':'水'}
JJ_OHENG = {'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火',
             '午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'}

def get_year_pillar(year):
    diff = (year - 1984) % 60
    return CHEONGAN[diff % 10], JIJI[diff % 12]

def get_month_pillar(year, month, day, hour):
    ydata = MANJURYEOK.get(str(year))
    if not ydata: return '', ''
    jeolgi = ydata.get('j', {}).get(str(month))
    target_month = month
    target_year  = year
    if jeolgi:
        jd = jeolgi['d']; jh = jeolgi['h']
        before = (day < jd) or (day == jd and hour < jh)
        if before:
            target_month = month - 1 if month > 1 else 12
            target_year  = year if month > 1 else year - 1
    mdata = MANJURYEOK.get(str(target_year), ydata)
    s = mdata.get('m', {}).get(str(target_month), '')
    s = s.replace('月', '')
    if len(s) >= 2: return s[0], s[1]
    return '', ''

def get_day_pillar(year, month, day):
    ydata = MANJURYEOK.get(str(year))
    if not ydata or 'g' not in ydata: return '', ''
    base   = date(year, 1, 1)
    target = date(year, month, day)
    delta  = (target - base).days
    g_idx  = CHEONGAN.index(ydata['g'])
    z_idx  = JIJI.index(ydata['z'])
    return CHEONGAN[(g_idx + delta) % 10], JIJI[(z_idx + delta) % 12]

def get_time_pillar(day_gan, hour):
    TIME_JI = [
        (23,24,'子'),(0,1,'子'),(1,3,'丑'),(3,5,'寅'),(5,7,'卯'),
        (7,9,'辰'),(9,11,'巳'),(11,13,'午'),(13,15,'未'),
        (15,17,'申'),(17,19,'酉'),(19,21,'戌'),(21,23,'亥')
    ]
    time_ji = '子'
    for s, e, ji in TIME_JI:
        if s <= hour < e: time_ji = ji; break
    DAY_BASE = {'甲':0,'己':0,'乙':2,'庚':2,'丙':4,'辛':4,'丁':6,'壬':6,'戊':8,'癸':8}
    base    = DAY_BASE.get(day_gan, 0)
    ji_idx  = JIJI.index(time_ji)
    gan_idx = (base + ji_idx) % 10
    return CHEONGAN[gan_idx], time_ji

def calc_saju(year, month, day, hour):
    yr_g, yr_j = get_year_pillar(year)
    mo_g, mo_j = get_month_pillar(year, month, day, hour)
    da_g, da_j = get_day_pillar(year, month, day)
    ti_g, ti_j = get_time_pillar(da_g, hour)
    return [(yr_g, yr_j), (mo_g, mo_j), (da_g, da_j), (ti_g, ti_j)]

def oheng_count(pillars):
    cnt = {'木':0,'火':0,'土':0,'金':0,'水':0}
    for g, j in pillars:
        if g in CG_OHENG: cnt[CG_OHENG[g]] += 1
        if j in JJ_OHENG: cnt[JJ_OHENG[j]] += 1
    return cnt

def classify(cnt):
    vals = list(cnt.values())
    if any(v == 0 for v in vals): return '불균형'
    mx = max(vals)
    if mx >= 4: return '특수격'
    if mx == 3: return '편중형'
    return '균형'

# ── 스캔 ──
TIMES = [2, 6, 10, 14, 18, 22]

skewed  = []
special = []

print("스캔 중... (2000~2015)")
for year in range(2000, 2016):
    for month in range(1, 13):
        # 월 마지막 날
        if month == 12: last = 31
        else:           last = (date(year, month+1, 1) - timedelta(1)).day
        for day in range(1, last+1):
            for hour in TIMES:
                try:
                    p   = calc_saju(year, month, day, hour)
                    cnt = oheng_count(p)
                    cls = classify(cnt)
                    mx  = max(cnt.values())
                    dom = [o for o,v in cnt.items() if v == mx]
                    rec = {
                        'date': f'{year}-{month:02d}-{day:02d}',
                        'time': f'{hour:02d}:00',
                        'pillars': ' '.join(f'{g}{j}' for g,j in p),
                        'cnt': dict(cnt),
                        'dom': '+'.join(dom),
                        'max': mx,
                    }
                    if cls == '편중형' and len(skewed)  < 5: skewed.append(rec)
                    if cls == '특수격' and len(special) < 5: special.append(rec)
                except Exception: pass
            if len(skewed) >= 5 and len(special) >= 5: break
        if len(skewed) >= 5 and len(special) >= 5: break
    if len(skewed) >= 5 and len(special) >= 5: break

# 특수격이 없으면 범위 확대
if not special:
    print("특수격 미발견 → 1940~2020 확장 스캔...")
    for year in range(1940, 2021):
        for month in range(1, 13):
            if month == 12: last = 31
            else: last = (date(year, month+1, 1) - timedelta(1)).day
            for day in range(1, last+1):
                for hour in [2, 10, 14, 22]:
                    try:
                        p   = calc_saju(year, month, day, hour)
                        cnt = oheng_count(p)
                        cls = classify(cnt)
                        mx  = max(cnt.values())
                        dom = [o for o,v in cnt.items() if v == mx]
                        if cls == '특수격':
                            special.append({
                                'date': f'{year}-{month:02d}-{day:02d}',
                                'time': f'{hour:02d}:00',
                                'pillars': ' '.join(f'{g}{j}' for g,j in p),
                                'cnt': dict(cnt),
                                'dom': '+'.join(dom),
                                'max': mx,
                            })
                            if len(special) >= 5: break
                    except Exception: pass
                if len(special) >= 5: break
            if len(special) >= 5: break
        if len(special) >= 5: break

print("\n" + "="*55)
print("[편중형] max=3, 빈 오행 없음")
print("="*55)
for r in skewed:
    dist = ' '.join(f"{o}{v}" for o,v in r['cnt'].items())
    print(f"  양력 {r['date']}  {r['time']}  (남/여 무관)")
    print(f"     사주: {r['pillars']}")
    print(f"     분포: {dist}  지배: {r['dom']}(3개)")
    print()

print("="*55)
print("[특수격] max>=4, 빈 오행 없음")
print("="*55)
for r in special:
    dist = ' '.join(f"{o}{v}" for o,v in r['cnt'].items())
    print(f"  양력 {r['date']}  {r['time']}  (남/여 무관)")
    print(f"     사주: {r['pillars']}")
    print(f"     분포: {dist}  지배: {r['dom']}({r['max']}개)")
    print()
