#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Task 1: PDF 텍스트/테이블 추출 → daebeopwon_hanja_raw.txt
Task 2: hanja-db.js 통계 분석 → hanja_analysis_report.txt
"""

import pdfplumber
import json
import re
from pathlib import Path
from collections import Counter, defaultdict

# ─────────────────────────────────────────
# Task 1: PDF 추출
# ─────────────────────────────────────────

PDF_PATH = r"J:\내 드라이브\CrazyStudio_work\작명 서비스\자료\240523_인명용한자표.pdf"
RAW_OUT  = r"C:\dearname\data\daebeopwon_hanja_raw.txt"

def extract_pdf():
    print(f"\n[Task 1] PDF 추출 시작: {PDF_PATH}")
    lines = []

    with pdfplumber.open(PDF_PATH) as pdf:
        total_pages = len(pdf.pages)
        print(f"  총 페이지 수: {total_pages}")

        for i, page in enumerate(pdf.pages, 1):
            lines.append(f"\n{'='*60}")
            lines.append(f"[ PAGE {i} / {total_pages} ]")
            lines.append(f"{'='*60}\n")

            # 텍스트 추출
            text = page.extract_text()
            if text:
                lines.append("--- TEXT ---")
                lines.append(text)

            # 테이블 추출
            tables = page.extract_tables()
            if tables:
                lines.append(f"\n--- TABLES ({len(tables)} found) ---")
                for t_idx, table in enumerate(tables, 1):
                    lines.append(f"\n[Table {t_idx}]")
                    for row in table:
                        if row:
                            # None → '' 처리 후 탭 구분
                            cleaned = [cell if cell else '' for cell in row]
                            lines.append('\t'.join(cleaned))

            if i % 10 == 0:
                print(f"  처리 중: {i}/{total_pages} 페이지")

    output = '\n'.join(lines)
    Path(RAW_OUT).write_text(output, encoding='utf-8')
    print(f"  저장 완료: {RAW_OUT}")
    print(f"  파일 크기: {Path(RAW_OUT).stat().st_size:,} bytes")
    return total_pages


# ─────────────────────────────────────────
# Task 2: hanja-db.js 분석
# ─────────────────────────────────────────

HANJA_DB = r"C:\dearname\data\hanja-db.js"
REPORT   = r"C:\dearname\data\hanja_analysis_report.txt"

def parse_hanja_db():
    """hanja-db.js에서 JS 배열/객체를 Python 구조로 파싱"""
    content = Path(HANJA_DB).read_text(encoding='utf-8')

    # const hanjaDB = [...] 또는 export default [...] 형태 파악
    # JSON-like 배열 추출
    # JS 특수 처리: //주석 제거, trailing comma 허용

    # 주석 제거
    content = re.sub(r'//[^\n]*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)

    # JS 변수 선언 제거 (const/let/var/export default)
    content = re.sub(r'^\s*(export\s+default\s+|const\s+\w+\s*=\s*|let\s+\w+\s*=\s*|var\s+\w+\s*=\s*)', '', content, flags=re.MULTILINE)

    # 마지막 세미콜론 제거
    content = content.strip().rstrip(';').strip()

    # trailing comma before } or ] (JSON 허용 안 됨 → 제거)
    content = re.sub(r',\s*([}\]])', r'\1', content)

    try:
        data = json.loads(content)
        return data
    except json.JSONDecodeError as e:
        print(f"  JSON 파싱 오류: {e}")
        # 구조 미리보기
        print("  파일 첫 500자:")
        print(Path(HANJA_DB).read_text(encoding='utf-8')[:500])
        raise


def analyze_hanja_db():
    print(f"\n[Task 2] hanja-db.js 분석 시작: {HANJA_DB}")

    data = parse_hanja_db()

    report_lines = []
    report_lines.append("=" * 70)
    report_lines.append("  한자 DB (hanja-db.js) 분석 리포트")
    report_lines.append(f"  생성일: 2026-04-24")
    report_lines.append("=" * 70)

    # ── 구조 파악 ──
    # data가 리스트인지, 딕셔너리인지 확인
    if isinstance(data, list):
        all_entries = data
    elif isinstance(data, dict):
        # {음: [항목...]} 형태일 수 있음
        all_entries = []
        for key, val in data.items():
            if isinstance(val, list):
                for item in val:
                    if isinstance(item, dict):
                        item['_key'] = key
                    all_entries.append(item)
            elif isinstance(val, dict):
                val['_key'] = key
                all_entries.append(val)

    report_lines.append(f"\n[1] 총 한자 항목 수: {len(all_entries):,}")

    # 샘플로 구조 파악
    if all_entries:
        sample = all_entries[0]
        report_lines.append(f"\n[2] 항목 구조 샘플 (첫 번째):")
        report_lines.append(f"    {json.dumps(sample, ensure_ascii=False)}")

    # ── 한자(h) 필드 분석 ──
    no_hanja = []
    hanja_list = []

    for i, entry in enumerate(all_entries):
        h = entry.get('h', '') if isinstance(entry, dict) else ''
        if not h or h.strip() == '':
            no_hanja.append((i, entry))
        else:
            hanja_list.append(h)

    report_lines.append(f"\n[3] 한자(h) 필드 분석:")
    report_lines.append(f"    - h 필드 있음: {len(hanja_list):,}")
    report_lines.append(f"    - h 필드 없거나 빈 값: {len(no_hanja):,}")
    if no_hanja:
        report_lines.append(f"    - 빈 항목 예시 (최대 10개):")
        for idx, entry in no_hanja[:10]:
            report_lines.append(f"      [{idx}] {json.dumps(entry, ensure_ascii=False)}")

    # ── 중복 한자 분석 ──
    # 같은 한자가 여러 번 등장
    hanja_counter = Counter(hanja_list)
    duplicates = {h: cnt for h, cnt in hanja_counter.items() if cnt > 1}

    report_lines.append(f"\n[4] 중복 한자 분석:")
    report_lines.append(f"    - 고유 한자 수: {len(hanja_counter):,}")
    report_lines.append(f"    - 중복 한자 수 (2회 이상): {len(duplicates):,}")
    if duplicates:
        report_lines.append(f"    - 상위 중복 한자 (빈도순):")
        for h, cnt in sorted(duplicates.items(), key=lambda x: -x[1])[:30]:
            report_lines.append(f"      '{h}' → {cnt}회")

    # ── 읽음별 중복 분석 ──
    # 같은 읽음(r 또는 음) 내 중복
    reading_hanja = defaultdict(list)  # {읽음: [한자들]}

    for entry in all_entries:
        if not isinstance(entry, dict):
            continue
        h = entry.get('h', '').strip()
        if not h:
            continue
        # 읽음 필드 탐색 (r, reading, 음, key 등)
        r = (entry.get('r') or entry.get('reading') or
             entry.get('음') or entry.get('_key') or '')
        if r:
            reading_hanja[str(r)].append(h)

    if reading_hanja:
        dup_in_reading = {}
        for r, hlist in reading_hanja.items():
            cnt = Counter(hlist)
            dups = {h: c for h, c in cnt.items() if c > 1}
            if dups:
                dup_in_reading[r] = dups

        report_lines.append(f"\n[5] 같은 읽음 내 중복 한자:")
        report_lines.append(f"    - 중복 발생 읽음 수: {len(dup_in_reading):,}")
        for r, dups in list(dup_in_reading.items())[:20]:
            report_lines.append(f"      읽음 '{r}': {dups}")

    # ── 오행(o) 분포 ──
    ohaeng_counter = Counter()
    no_ohaeng = 0

    for entry in all_entries:
        if not isinstance(entry, dict):
            continue
        o = entry.get('o', '') or entry.get('오행', '')
        if o:
            ohaeng_counter[str(o)] += 1
        else:
            no_ohaeng += 1

    report_lines.append(f"\n[6] 오행(o) 분포:")
    total_with_o = sum(ohaeng_counter.values())
    report_lines.append(f"    - 오행 있음: {total_with_o:,}")
    report_lines.append(f"    - 오행 없음: {no_ohaeng:,}")

    ohaeng_order = ['木', '火', '土', '金', '水']
    report_lines.append(f"    - 분포:")
    for o in ohaeng_order:
        cnt = ohaeng_counter.get(o, 0)
        pct = cnt / max(total_with_o, 1) * 100
        bar = '█' * int(pct / 2)
        report_lines.append(f"      {o}: {cnt:5,}개 ({pct:5.1f}%) {bar}")

    # 기타 오행 값 (예상 외 값)
    unexpected = {k: v for k, v in ohaeng_counter.items() if k not in ohaeng_order}
    if unexpected:
        report_lines.append(f"    - 기타 오행 값: {unexpected}")

    # ── 획수(s) 분포 ──
    stroke_counter = Counter()
    for entry in all_entries:
        if not isinstance(entry, dict):
            continue
        s = entry.get('s') or entry.get('획') or entry.get('stroke')
        if s is not None:
            stroke_counter[str(s)] += 1

    if stroke_counter:
        report_lines.append(f"\n[7] 획수(s) 분포 (상위 10):")
        for s, cnt in sorted(stroke_counter.items(), key=lambda x: -x[1])[:10]:
            report_lines.append(f"      획수 {s:>3}: {cnt:,}개")

    # ── 읽음별 한자 수 분포 ──
    if reading_hanja:
        report_lines.append(f"\n[8] 읽음별 한자 수 (상위 20):")
        for r, hlist in sorted(reading_hanja.items(), key=lambda x: -len(x[1]))[:20]:
            report_lines.append(f"      '{r}': {len(hlist)}개")

    report_lines.append(f"\n{'='*70}")
    report_lines.append("  분석 완료")
    report_lines.append(f"{'='*70}\n")

    output = '\n'.join(report_lines)
    Path(REPORT).write_text(output, encoding='utf-8')
    print(f"  저장 완료: {REPORT}")
    print(f"  파일 크기: {Path(REPORT).stat().st_size:,} bytes")

    # 주요 결과 콘솔 출력
    print(f"\n  [주요 결과]")
    print(f"  - 총 항목: {len(all_entries):,}")
    print(f"  - h 없음: {len(no_hanja)}")
    print(f"  - 중복 한자: {len(duplicates)}")
    print(f"  - 오행 분포: {dict(ohaeng_counter)}")


# ─────────────────────────────────────────
# Main
# ─────────────────────────────────────────

if __name__ == '__main__':
    # Task 1
    try:
        pages = extract_pdf()
        print(f"[Task 1 완료] {pages} 페이지 추출")
    except Exception as e:
        print(f"[Task 1 오류] {e}")

    # Task 2
    try:
        analyze_hanja_db()
        print("[Task 2 완료]")
    except Exception as e:
        import traceback
        print(f"[Task 2 오류] {e}")
        traceback.print_exc()
