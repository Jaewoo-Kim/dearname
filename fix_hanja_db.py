# fix_hanja_db.py
# hanja-db.js 수정 스크립트
# 실행: python fix_hanja_db.py

import re
import json
import shutil
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DB_PATH = r'C:\dearname\data\hanja-db.js'
BACKUP_PATH = r'C:\dearname\data\hanja-db.js.bak'

# ============================================================
# 1. 파일 읽기
# ============================================================
with open(DB_PATH, 'r', encoding='utf-8') as f:
    original = f.read()

print(f"원본 파일 크기: {len(original):,} bytes")

# 백업
shutil.copy(DB_PATH, BACKUP_PATH)
print(f"백업 완료: {BACKUP_PATH}")

# ============================================================
# 2. 헤더/푸터 분리 후 JSON 파싱
# ============================================================
# 헤더: 첫 줄부터 'const HANJA_DB_FULL = {' 직전까지 + 'const HANJA_DB_FULL = '
db_marker = 'const HANJA_DB_FULL = '
db_start = original.find(db_marker)
if db_start == -1:
    raise ValueError("HANJA_DB_FULL 마커를 찾지 못했습니다")

header = original[:db_start + len(db_marker)]

# 마지막 '};' 위치 찾기
db_end = original.rfind('};')
if db_end == -1:
    raise ValueError("'};' 마커를 찾지 못했습니다")

json_str = original[db_start + len(db_marker):db_end + 1]
footer = original[db_end + 1:]  # '};' 이후 (module.exports 등)

print(f"헤더 길이: {len(header):,}")
print(f"JSON 길이: {len(json_str):,}")
print(f"푸터 길이: {len(footer):,}")

data = json.loads(json_str)
print(f"파싱된 음 그룹 수: {len(data)}")

# 전체 항목 수 카운트
total_before = sum(len(v) for v in data.values())
print(f"수정 전 총 항목 수: {total_before:,}")

# ============================================================
# 3. PUA 항목 분석 결과
# ============================================================
# 각 PUA 항목에 대한 처리 결정:
#
# [나] 많을 10획 水 -> 哪(U+54EA, 10획, 水) 교체
#   (하지만 나 음에 이미 나 음 항목들이 많으므로 확인 필요)
#   -> 判断 불가(10획 水 많을 나 한자가 명확하지 않음), 제거
#
# [다] 차 15획 木 -> 다 음에 茶(12획)이 이미 있고,
#   15획 차 다 한자가 명확하지 않음 -> 제거
#
# [래] 올 15획 土 -> 來(8획), 徠(11획) 있음, 15획 올 래는 불명확 -> 제거
#
# [민] 강할 18획 火 -> 18획 강할 민 한자 불명확 -> 제거
#
# [서] 슬기로울 15획 金 -> 諝(16획 金)이 있음, 15획 金 슬기로울 서 -> 제거
#
# [솔] 거느릴 17획 火 -> 率(11획 火) 이미 있음, 17획은 불명확 -> 제거
#
# [예] 예도 6획 木 -> 礼(U+793C, 6획 木)가 이미 있음 -> 중복이므로 제거
#
# [예] 아름다울 19획 金 -> 19획 아름다울 예 -> 壡(19획 土)과 다름, 불명확 -> 제거
#
# [온] 어질,온화할 10획 水 -> 昷(9획 Fire)가 있음(뜻=어질,온화할), 10획 水는 불명확 -> 제거
#
# [온] 번성할,모양 15획 木 -> 褞(15획 木, 뜻=기둥,번성할)이 있음 -> 유사하나 뜻 다름, 불명확 -> 제거
#
# [은] 옥 15획 金 -> 15획 金 옥 은 = 誾(온화할,平화)는 아님, 불명확 -> 제거
#
# [은] 온화할 19획 金 -> 殷(10획 金)과 다름, 19획 金 온화할 은 -> 불명확 -> 제거
#
# [정] 아름다울 17획 火 -> 17획 Fire 아름다울 정 -> 불명확 -> 제거
#
# [하] 대답할 19획 金 -> 賀(12획 Gold)이 있으나 뜻은 하례할, 19획 대답할 하 -> 불명확 -> 제거
#
# [후] 땅 이름 12획 Fire -> 불명확 -> 제거
#
# [훈] 향기.향풀 21획 木 -> 薰(U+85B0, DB에 이미 19-20획으로 2개 존재)
#   21획은 다른 자형일 수 있으나, 이미 薰이 중복 항목으로 있고,
#   PUA는 판별 불가이므로 -> 제거
#
# 결론: 모든 PUA 항목 제거 (16개)
# 단, 나 음에는 PUA 외에도 중복된 실제 한자들이 있음 (喇 중복, 累 중복, 拏 중복)
# 이것들은 별도 처리

def is_pua(h):
    return h and len(h) > 0 and 0xE000 <= ord(h[0]) <= 0xF8FF

# ============================================================
# 4. 수정사항 적용
# ============================================================

modified = 0

# ---- 4-1. 획수 오류 수정 ----
print("\n=== 획수 오류 수정 ===")

# 禮 (예): s 값을 8에서 18로 수정
fixed_rei = 0
for item in data.get('예', []):
    if item['h'] == '禮' and item['s'] == 8:
        print(f"  禮(예) 획수 수정: {item['s']} -> 18")
        item['s'] = 18
        fixed_rei += 1
        modified += 1
print(f"  禮 수정: {fixed_rei}건")

# 胡 (호): s 값을 9에서 11로 수정
fixed_ho = 0
for item in data.get('호', []):
    if item['h'] == '胡' and item['s'] == 9:
        print(f"  胡(호) 획수 수정: {item['s']} -> 11")
        item['s'] = 11
        fixed_ho += 1
        modified += 1
print(f"  胡 수정: {fixed_ho}건")

# ---- 4-2. 같은 읽음 내 중복 제거 ----
print("\n=== 중복 항목 제거 ===")

# 중복 대상 목록: (음, h값)
# 나 음에는 PUA가 아닌 실제 한자 중복도 있음 (喇, 累, 拏)
# 이것들은 4-2에서 처리
duplicates_to_remove = [
    ('간', '偘'),
    ('경', '梗'),
    ('대', '旲'),
    ('래', '崍'),
    ('미', '冞'),
    ('미', '米'),
    ('병', '竝'),
    ('사', '思'),
    ('상', '嘗'),
    ('석', '碩'),
    ('순', '橓'),
    ('예', '乂'),
    ('온', '昷'),
    ('용', '溶'),
    ('우', '俁'),
    ('위', '尉'),
    ('위', '魏'),
    ('유', '侑'),
    ('유', '牖'),
    ('익', '熤'),
    ('인', '寅'),
    ('저', '著'),
    ('정', '亭'),
    ('정', '靚'),
    ('진', '辰'),
    ('탁', '拓'),
    ('황', '黃'),
    ('훈', '薰'),
]

total_dup_removed = 0

for eum, h_val in duplicates_to_remove:
    if eum not in data:
        print(f"  경고: 음 '{eum}' 없음")
        continue
    items = data[eum]
    seen = set()
    new_items = []
    removed = 0
    for item in items:
        if item['h'] == h_val:
            if h_val in seen:
                removed += 1
                modified += 1
            else:
                seen.add(h_val)
                new_items.append(item)
        else:
            new_items.append(item)
    if removed > 0:
        data[eum] = new_items
        total_dup_removed += removed
        print(f"  [{eum}] {h_val} 중복 {removed}건 제거")
    else:
        print(f"  [{eum}] {h_val} 중복 없음 (이미 처리됨이거나 확인 필요)")

print(f"\n  총 중복 제거: {total_dup_removed}건")

# ---- 4-3. PUA 문자 제거 및 나 음 중복 한자 제거 ----
print("\n=== PUA 항목 처리 ===")

# 나 음의 특수 처리: PUA + 실제 한자 중복 (喇, 累, 拏) 모두 제거
# 나 음 항목 분석:
# 喇: 나팔,말할 12획 水 (정상) / 나팔 나 12획 水 (중복 PUA로 표시됨 - 실제로는 정상 한자의 중복)
# 累: 정상 항목 없음, 벌거벗을나 11획 木 -> DB에 없는 항목이지만 PUA 표시됨
# 拏: 붙잡을,잡을 9획 木 (정상) / 잡을.붙잡을 9획 木 (중복)
# -> 나 음의 마지막 3개 항목(喇 중복, 累, 拏 중복)은 PUA로 표시됐지만 실제로는 정상 한자

# 그러나 위에서 확인한 나 음 출력에서 마지막 4개 중 1개만 \ue000이고
# 나머지 3개(喇, 累, 拏)는 정상 한자인데 PUA 표시됨 - 즉 이들은 중복이므로 제거 대상

pua_removed = 0
dup_na_removed = 0

for eum in list(data.keys()):
    items = data[eum]

    # PUA 항목 제거
    new_items = []
    for item in items:
        if is_pua(item['h']):
            pua_removed += 1
            modified += 1
            print(f"  [{eum}] PUA 항목 제거: 뜻={item['m']}, 획수={item['s']}, 오행={item['o']}")
        else:
            new_items.append(item)
    data[eum] = new_items

# 나 음의 나머지 중복 처리 (위 PUA 제거 후)
# 나 음에 喇(12획 Water)가 2개, 拏(9획 Wood)가 2개 있으면 두 번째 제거
for eum, h_val in [('나', '喇'), ('나', '拏'), ('나', '累')]:
    if eum in data:
        items = data[eum]
        seen = set()
        new_items = []
        removed = 0
        for item in items:
            if item['h'] == h_val:
                if h_val in seen:
                    removed += 1
                    modified += 1
                    dup_na_removed += 1
                else:
                    seen.add(h_val)
                    new_items.append(item)
            else:
                new_items.append(item)
        if removed > 0:
            data[eum] = new_items
            print(f"  [{eum}] {h_val} 중복 {removed}건 제거")

print(f"\n  PUA 제거: {pua_removed}건")
print(f"  나 음 중복 추가 제거: {dup_na_removed}건")

# ---- 4-4. 예 음의 \uE000 중복 (중복 제거에서 처리됨) ----
# 예 음에는 \uE000이 2개 있었고, PUA 제거로 모두 삭제됨
# 단, "예: \uE000 중복" 이라는 항목은 이미 위의 중복 제거 목록에 있었으나
# h='\uE000'이 여러 음에서 중복으로 나타남
# - 예: \uE000 2개 -> PUA 제거로 처리됨
# - 온: \uE000 2개 -> PUA 제거로 처리됨
# - 은: \uE000 2개 -> PUA 제거로 처리됨
# (중복 제거 목록의 예:\uE000, 온:\uE000, 은:\uE000은 PUA 제거로 이미 처리됨)

# ---- 4-5. 불용한자 丑(축) 제거 ----
print("\n=== 불용한자 제거 ===")

chuk_removed = 0
if '축' in data:
    items = data['축']
    new_items = [item for item in items if item['h'] != '丑']
    chuk_removed = len(items) - len(new_items)
    if chuk_removed > 0:
        data['축'] = new_items
        modified += chuk_removed
        print(f"  [축] 丑 제거: {chuk_removed}건")
    else:
        print(f"  [축] 丑 항목 없음")

# ---- 4-6. 훈 음 暈 중복 제거 ----
# 훈 음에 暈(13획 火)가 2개 있음
print("\n=== 훈 음 暈 중복 ===")
if '훈' in data:
    items = data['훈']
    seen_hun = set()
    new_items = []
    hun_removed = 0
    for item in items:
        if item['h'] == '暈':
            if '暈' in seen_hun:
                hun_removed += 1
                modified += 1
            else:
                seen_hun.add('暈')
                new_items.append(item)
        else:
            new_items.append(item)
    if hun_removed > 0:
        data['훈'] = new_items
        print(f"  [훈] 暈 중복 {hun_removed}건 제거")
    else:
        print(f"  [훈] 暈 중복 없음")

# ============================================================
# 5. 수정 후 통계
# ============================================================
total_after = sum(len(v) for v in data.values())
print(f"\n=== 결과 ===")
print(f"수정 전 총 항목 수: {total_before:,}")
print(f"수정 후 총 항목 수: {total_after:,}")
print(f"제거된 항목 수: {total_before - total_after:,}")
print(f"총 수정 작업 수: {modified:,}")

# ============================================================
# 6. JS 파일로 다시 저장
# ============================================================
# JSON을 JS 형식으로 직렬화 (들여쓰기 2칸)
new_json = json.dumps(data, ensure_ascii=False, indent=2)

# 원본의 들여쓰기 스타일 확인 후 맞추기
# 원본은 키가 4칸 들여쓰기였음 -> 재확인
sample = original[db_start + len(db_marker):db_start + len(db_marker) + 200]
print(f"\n원본 들여쓰기 샘플:\n{repr(sample[:150])}")

new_content = header + new_json + footer

with open(DB_PATH, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"\n저장 완료: {DB_PATH}")
print(f"새 파일 크기: {len(new_content):,} bytes")

# ============================================================
# 7. 검증
# ============================================================
with open(DB_PATH, 'r', encoding='utf-8') as f:
    verify = f.read()

# 재파싱 확인
v_start = verify.find('const HANJA_DB_FULL = ')
v_end = verify.rfind('};')
v_json = verify[v_start + len('const HANJA_DB_FULL = '):v_end + 1]
v_data = json.loads(v_json)
v_total = sum(len(v) for v in v_data.values())
print(f"\n검증: 재파싱 성공, 항목 수 = {v_total:,}")

# PUA 잔여 확인
pua_remain = 0
for eum, items in v_data.items():
    for item in items:
        if is_pua(item['h']):
            pua_remain += 1
            print(f"  PUA 잔여: [{eum}] {repr(item['h'])}, {item['m']}")
print(f"PUA 잔여 항목: {pua_remain}건")

# 丑 잔여 확인
if '축' in v_data:
    chuk_items = [i for i in v_data['축'] if i['h'] == '丑']
    print(f"丑(축) 잔여: {len(chuk_items)}건")

# 禮 획수 확인
if '예' in v_data:
    rei_items = [i for i in v_data['예'] if i['h'] == '禮']
    for r in rei_items:
        print(f"禮(예) 획수: {r['s']} (목표: 18)")

# 胡 획수 확인
if '호' in v_data:
    ho_items = [i for i in v_data['호'] if i['h'] == '胡']
    for h in ho_items:
        print(f"胡(호) 획수: {h['s']} (목표: 11)")

print("\n완료!")
