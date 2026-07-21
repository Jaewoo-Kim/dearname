function toCsvField(value: unknown): string {
  const s = value == null ? '' : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const UTF8_BOM = '﻿';

// 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다.
export function buildCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(toCsvField).join(','));
  return UTF8_BOM + lines.join('\r\n');
}
