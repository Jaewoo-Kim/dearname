#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF 텍스트 추출 - 240523_인명용한자표.pdf
이 PDF는 한자를 이미지(LTImage)로 저장한 형태라 pdfplumber 텍스트 추출 시
한자 자체는 추출되지 않고 구조(괄호, 페이지번호, 레이아웃 정보)만 추출됩니다.
OCR이 필요하다면 Tesseract 설치 후 별도 처리 필요.
"""

import pdfplumber
from pathlib import Path

PDF_PATH = r"J:\내 드라이브\CrazyStudio_work\작명 서비스\자료\240523_인명용한자표.pdf"
RAW_OUT  = r"C:\dearname\data\daebeopwon_hanja_raw.txt"

def extract_pdf():
    print(f"[Task 1] PDF 추출 시작")
    lines = []

    lines.append("=" * 70)
    lines.append("  240523_인명용한자표.pdf - pdfplumber 추출 결과")
    lines.append("  주의: 이 PDF는 한자를 이미지(LTImage)로 저장하고 있어")
    lines.append("  텍스트 레이어에는 한자가 포함되지 않습니다.")
    lines.append("  추출된 내용: 페이지 구조, 괄호, 페이지 번호 등 메타 정보")
    lines.append("  완전한 한자 추출을 위해서는 OCR(Tesseract) 또는")
    lines.append("  인명용한자표_구조화.xlsx 파일 활용을 권장합니다.")
    lines.append("=" * 70)

    with pdfplumber.open(PDF_PATH) as pdf:
        total_pages = len(pdf.pages)
        lines.append(f"\n총 페이지 수: {total_pages}\n")

        for i, page in enumerate(pdf.pages, 1):
            lines.append(f"\n{'='*60}")
            lines.append(f"[ PAGE {i} / {total_pages} ]")
            lines.append(f"{'='*60}")

            # 텍스트
            text = page.extract_text()
            if text and text.strip():
                lines.append("\n[TEXT]")
                lines.append(text)

            # chars (문자 레벨)
            chars = page.chars
            char_texts = [c['text'] for c in chars if c['text'].strip()]
            if char_texts:
                lines.append(f"\n[CHARS ({len(char_texts)}개)] {' '.join(char_texts[:50])}")

            # 테이블
            tables = page.extract_tables()
            if tables:
                lines.append(f"\n[TABLES: {len(tables)}개]")
                for t_idx, table in enumerate(tables, 1):
                    lines.append(f"  Table {t_idx}:")
                    for row in table:
                        if row and any(c for c in row if c):
                            cleaned = [cell.strip() if cell else '' for cell in row]
                            lines.append("    " + " | ".join(cleaned))

            # 이미지 수 (한자가 이미지로 저장된 수)
            images = page.images
            if images:
                lines.append(f"\n[IMAGES: {len(images)}개 - 한자 이미지로 추정]")

            if i % 10 == 0:
                print(f"  {i}/{total_pages} 페이지 처리 중...")

    output = '\n'.join(lines)
    Path(RAW_OUT).write_text(output, encoding='utf-8')
    print(f"  저장 완료: {RAW_OUT}")
    print(f"  파일 크기: {Path(RAW_OUT).stat().st_size:,} bytes")
    print(f"  총 {total_pages} 페이지 처리")
    return total_pages

if __name__ == '__main__':
    pages = extract_pdf()
    print(f"[완료] {pages} 페이지 추출")
