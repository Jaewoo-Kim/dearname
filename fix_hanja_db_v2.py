# fix_hanja_db_v2.py
# hanja-db.js 수정 스크립트 (최종판)

import re
import json
import shutil
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

DB_PATH = r'C:\dearname\data\hanja-db.js'
BACKUP_PATH = r'C:\dearname\data\hanja-db.js.bak'

# ============================================================
# 1. 파일 읽기 및 백업
# ============================================================
with open(DB_PATH, 'r', encoding='utf-8') as f:
    original = f.read()

print(f"원본 파일 크기: {len(original):,} bytes")

shutil.copy(DB_PATH, BACKUP_PATH)
print(f"백업 완료: {BACKUP_PATH}")

# ============================================================
# 2. 헤더/푸터 분리 후 JSON 파싱
# ============================================================
db_marker = 'const HANJA_DB_FULL = '
db_start = original.find(db_marker)
header = original[:db_start + len(db_marker)]

db_end = original.rfind('};')
json_str = original[db_start + len(db_marker):db_end + 1]
footer = original[db_end + 1:]

data = json.loads(json_str)
total_before = sum(len(v) for v in data.values())
print(f"파싱된 음 그룹 수: {len(data)}")
print(f"수정 전 총 항목 수: {total_before:,}")

# ============================================================
# 헬퍼 함수
# ============================================================
def is_pua(h):
    """U+E000~F8FF: Private Use Area"""
    return h and len(h) > 0 and 0xE000 <= ord(h[0]) <= 0xF8FF

def remove_first_match(items, h_val):
    """같은 h_val의 두 번째 이후 항목 제거 (첫 번째는 유지)"""
    seen = False
    new_items = []
    removed = 0
    for item in items:
        if item['h'] == h_val:
            if seen:
                removed += 1
            else:
                seen = True
                new_items.append(item)
        else:
            new_items.append(item)
    return new_items, removed

# ============================================================
# 3. 수정사항 1: 획수 오류 수정
# ============================================================
print("\n=== 획수 오류 수정 ===")
modified = 0

# 禮 (예): 8 -> 18
for item in data.get('예', []):
    if item['h'] == '禮' and item['s'] == 8:
        print(f"  禮(예) 획수: {item['s']} -> 18")
        item['s'] = 18
        modified += 1

# 胡 (호): 9 -> 11
for item in data.get('호', []):
    if item['h'] == '胡' and item['s'] == 9:
        print(f"  胡(호) 획수: {item['s']} -> 11")
        item['s'] = 11
        modified += 1

# ============================================================
# 4. 수정사항 2: 같은 읽음 내 중복 제거
# ============================================================
print("\n=== 중복 항목 제거 ===")

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
    data[eum], removed = remove_first_match(data[eum], h_val)
    if removed > 0:
        total_dup_removed += removed
        modified += removed
        print(f"  [{eum}] {h_val} 중복 {removed}건 제거")
    else:
        print(f"  [{eum}] {h_val} 중복 없음")

print(f"\n  중복 제거 합계: {total_dup_removed}건")

# ============================================================
# 5. 수정사항 3: PUA 문자 제거
#    - U+E000~F8FF: Private Use Area (진짜 PUA)
#    - 나 음의 CJK 호환 한자 U+F90B(喇), U+F94F(累), U+F95B(拏):
#      원본에서 PUA 섹션 뒤에 붙어 있던 불필요한 중복 항목들
# ============================================================
print("\n=== PUA 항목 처리 ===")

# 나 음에서 제거할 CJK 호환 한자 코드포인트 (원래 PUA 중복 섹션의 일부였던 것들)
NA_COMPAT_REMOVE = {0xF90B, 0xF94F, 0xF95B}  # 喇(F90B), 累(F94F), 拏(F95B)

pua_removed = 0
na_compat_removed = 0

for eum in list(data.keys()):
    new_items = []
    for item in data[eum]:
        h = item['h']
        cp = ord(h[0]) if h else 0

        if is_pua(h):
            # 진짜 PUA (E000-F8FF) 제거
            pua_removed += 1
            modified += 1
            print(f"  [{eum}] PUA 제거: 뜻={item['m']}, 획수={item['s']}, 오행={item['o']}")
        elif eum == '나' and cp in NA_COMPAT_REMOVE:
            # 나 음의 불필요한 CJK 호환 한자 중복 제거
            na_compat_removed += 1
            modified += 1
            print(f"  [나] 호환한자 중복 제거: h={h!r}(U+{cp:04X}), 뜻={item['m']}")
        else:
            new_items.append(item)
    data[eum] = new_items

print(f"\n  PUA 제거: {pua_removed}건")
print(f"  나 음 호환한자 중복 제거: {na_compat_removed}건")

# ============================================================
# 6. 수정사항 4: 불용한자 丑(축) 제거
# ============================================================
print("\n=== 불용한자 제거 ===")

chuk_removed = 0
if '축' in data:
    orig_len = len(data['축'])
    data['축'] = [item for item in data['축'] if item['h'] != '丑']
    chuk_removed = orig_len - len(data['축'])
    modified += chuk_removed
    if chuk_removed:
        print(f"  [축] 丑 제거: {chuk_removed}건")
    else:
        print(f"  [축] 丑 항목 없음")

# ============================================================
# 7. 결과 통계
# ============================================================
total_after = sum(len(v) for v in data.values())
print(f"\n=== 최종 결과 ===")
print(f"수정 전 총 항목 수: {total_before:,}")
print(f"수정 후 총 항목 수: {total_after:,}")
print(f"제거된 항목 수: {total_before - total_after:,}")
print(f"총 수정 건수: {modified:,}")

# ============================================================
# 8. 저장
# ============================================================
new_json = json.dumps(data, ensure_ascii=False, indent=2)
new_content = header + new_json + footer

with open(DB_PATH, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(f"\n저장 완료: {DB_PATH}")
print(f"새 파일 크기: {len(new_content):,} bytes")

# ============================================================
# 9. 검증
# ============================================================
with open(DB_PATH, 'r', encoding='utf-8') as f:
    verify = f.read()

v_start = verify.find('const HANJA_DB_FULL = ')
v_end = verify.rfind('};')
v_data = json.loads(verify[v_start + len('const HANJA_DB_FULL = '):v_end + 1])
v_total = sum(len(v) for v in v_data.values())
print(f"\n검증 - 재파싱 성공, 항목 수 = {v_total:,}")

# PUA 잔여
pua_remain = sum(
    1 for eum, items in v_data.items()
    for item in items if is_pua(item['h'])
)
print(f"PUA(E000-F8FF) 잔여: {pua_remain}건")

# 나 음 호환한자 잔여
na_compat_remain = sum(
    1 for item in v_data.get('나', [])
    if item['h'] and ord(item['h'][0]) in NA_COMPAT_REMOVE
)
print(f"나 음 호환한자 잔여: {na_compat_remain}건")

# 丑 잔여
chuk_remain = sum(1 for item in v_data.get('축', []) if item['h'] == '丑')
print(f"丑(축) 잔여: {chuk_remain}건")

# 禮 획수
rei_strokes = [item['s'] for item in v_data.get('예', []) if item['h'] == '禮']
print(f"禮(예) 획수: {rei_strokes} (목표: [18])")

# 胡 획수
ho_strokes = [item['s'] for item in v_data.get('호', []) if item['h'] == '胡']
print(f"胡(호) 획수: {ho_strokes} (목표: [11])")

# 중복 최종 확인
print("\n중복 잔여 확인:")
for eum, items in v_data.items():
    from collections import Counter
    h_counts = Counter(item['h'] for item in items)
    dups = {h: c for h, c in h_counts.items() if c > 1}
    if dups:
        print(f"  [{eum}] 중복: {dups}")

print("\n완료!")
