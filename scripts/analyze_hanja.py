#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hanja-db.js 통계 분석 → hanja_analysis_report.txt
구조: const HANJA_DB_FULL = { "가": [{h, m, s, o}, ...], ... }
"""

import re
import json
from pathlib import Path
from collections import Counter, defaultdict

HANJA_DB = r"C:\dearname\data\hanja-db.js"
REPORT   = r"C:\dearname\data\hanja_analysis_report.txt"

def parse_hanja_db():
    content = Path(HANJA_DB).read_text(encoding='utf-8')

    # 주석 제거
    content = re.sub(r'//[^\n]*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

    # HANJA_DB_FULL = { ... 시작 위치 찾기
    m = re.search(r'const\s+HANJA_DB_FULL\s*=\s*(\{)', content)
    if not m:
        raise ValueError("HANJA_DB_FULL을 찾을 수 없습니다.")

    # { 부터 파일 끝까지 잘라서 세미콜론 제거
    raw = content[m.start(1):].strip().rstrip(';').strip()

    # trailing comma 제거 (JSON 표준 미지원)
    raw = re.sub(r',\s*([}\]])', r'\1', raw)

    return json.loads(raw)


def analyze():
    print(f"[Task 2] hanja-db.js 분석 중...")
    data = parse_hanja_db()

    # data = { "가": [...], "나": [...], ... }
    all_entries = []
    for reading, items in data.items():
        for item in items:
            item['_reading'] = reading
            all_entries.append(item)

    report = []
    report.append("=" * 70)
    report.append("  한자 DB (hanja-db.js) 분석 리포트")
    report.append("  생성일: 2026-04-24")
    report.append("=" * 70)

    # ── 1. 총 항목 수 ──
    report.append(f"\n[1] 총 한자 항목 수: {len(all_entries):,}개")
    report.append(f"    읽음(음) 종류 수: {len(data):,}개")

    # ── 2. h 필드 분석 ──
    no_h = [e for e in all_entries if not e.get('h', '').strip()]
    hanja_list = [e['h'].strip() for e in all_entries if e.get('h', '').strip()]

    report.append(f"\n[2] 한자(h) 필드 분석:")
    report.append(f"    - h 있음: {len(hanja_list):,}개")
    report.append(f"    - h 없거나 빈 값: {len(no_h):,}개")
    if no_h:
        report.append("    - 빈 항목 (최대 10개):")
        for e in no_h[:10]:
            report.append(f"      {json.dumps(e, ensure_ascii=False)}")

    # ── 3. 중복 한자 분석 ──
    hanja_counter = Counter(hanja_list)
    duplicates = {h: cnt for h, cnt in hanja_counter.items() if cnt > 1}

    report.append(f"\n[3] 중복 한자 분석 (전체 기준):")
    report.append(f"    - 고유 한자 수: {len(hanja_counter):,}개")
    report.append(f"    - 중복 한자 수 (2회 이상): {len(duplicates):,}개")
    if duplicates:
        report.append("    - 상위 30개 중복 한자:")
        for h, cnt in sorted(duplicates.items(), key=lambda x: -x[1])[:30]:
            # 어떤 읽음에서 나오는지 확인
            readings_with = [e['_reading'] for e in all_entries if e.get('h', '').strip() == h]
            report.append(f"      '{h}' → {cnt}회 (읽음: {', '.join(readings_with)})")

    # ── 4. 같은 읽음 내 중복 ──
    dup_in_reading = {}
    for reading, items in data.items():
        h_in_reading = [e.get('h', '').strip() for e in items if e.get('h', '').strip()]
        cnt = Counter(h_in_reading)
        dups = {h: c for h, c in cnt.items() if c > 1}
        if dups:
            dup_in_reading[reading] = dups

    report.append(f"\n[4] 같은 읽음 내 중복 한자:")
    report.append(f"    - 중복 발생 읽음 수: {len(dup_in_reading):,}개")
    if dup_in_reading:
        for r, dups in list(dup_in_reading.items())[:20]:
            report.append(f"      '{r}': {dups}")

    # ── 5. 오행(o) 분포 ──
    ohaeng_counter = Counter()
    no_o = 0
    for e in all_entries:
        o = e.get('o', '')
        if o and str(o).strip():
            ohaeng_counter[str(o).strip()] += 1
        else:
            no_o += 1

    total_with_o = sum(ohaeng_counter.values())
    report.append(f"\n[5] 오행(o) 분포:")
    report.append(f"    - 오행 있음: {total_with_o:,}개")
    report.append(f"    - 오행 없음: {no_o:,}개")

    ohaeng_order = ['木', '火', '土', '金', '水']
    for o in ohaeng_order:
        cnt = ohaeng_counter.get(o, 0)
        pct = cnt / max(total_with_o, 1) * 100
        bar = '█' * int(pct / 2)
        report.append(f"      {o}: {cnt:5,}개 ({pct:5.1f}%) {bar}")

    unexpected = {k: v for k, v in ohaeng_counter.items() if k not in ohaeng_order}
    if unexpected:
        report.append(f"    - 기타 오행 값 (예상 외): {unexpected}")

    # ── 6. 획수(s) 분포 ──
    stroke_counter = Counter()
    no_s = 0
    for e in all_entries:
        s = e.get('s')
        if s is not None:
            stroke_counter[int(s)] += 1
        else:
            no_s += 1

    report.append(f"\n[6] 획수(s) 분포:")
    report.append(f"    - 획수 있음: {sum(stroke_counter.values()):,}개 / 없음: {no_s:,}개")
    report.append(f"    - 획수 범위: {min(stroke_counter.keys())} ~ {max(stroke_counter.keys())}")
    report.append(f"    - 획수별 분포 (획수: 한자 수):")
    for s in sorted(stroke_counter.keys()):
        cnt = stroke_counter[s]
        bar = '■' * min(cnt // 5, 40)
        report.append(f"      {s:2d}획: {cnt:4d}개 {bar}")

    # ── 7. 읽음별 한자 수 분포 ──
    reading_counts = {r: len(items) for r, items in data.items()}
    report.append(f"\n[7] 읽음별 한자 수 (상위 30):")
    for r, cnt in sorted(reading_counts.items(), key=lambda x: -x[1])[:30]:
        report.append(f"      '{r}': {cnt:4d}개")

    # ── 8. 뜻(m) 필드 누락 ──
    no_m = [e for e in all_entries if not e.get('m', '')]
    report.append(f"\n[8] 뜻(m) 필드 누락: {len(no_m):,}개")

    report.append(f"\n{'='*70}")
    report.append("  분석 완료")
    report.append(f"{'='*70}\n")

    out_text = '\n'.join(report)
    Path(REPORT).write_text(out_text, encoding='utf-8')

    print(f"  저장 완료: {REPORT}")
    print(f"  파일 크기: {Path(REPORT).stat().st_size:,} bytes")
    print(f"\n  [주요 결과]")
    print(f"  - 총 항목: {len(all_entries):,}")
    print(f"  - h 필드 빈 항목: {len(no_h)}")
    print(f"  - 고유 한자: {len(hanja_counter):,}")
    print(f"  - 중복 한자: {len(duplicates)}")
    print(f"  - 오행 분포: { {o: ohaeng_counter.get(o,0) for o in ohaeng_order} }")


if __name__ == '__main__':
    analyze()
    print("[Task 2 완료]")
