// scripts/splice_sieun.js — index.html의 10옵션 데모 블록을 최시은 3옵션으로 교체
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const htmlPath = path.join(ROOT, 'index.html');
const blockPath = path.join(ROOT, '_sieun_block.txt');

const html = fs.readFileSync(htmlPath, 'utf8');
const block = fs.readFileSync(blockPath, 'utf8');

const START_TEXT = '10개 옵션: 성씨 최(崔) · 2026-07-02 08:50 여아 · 현대적 인기 이름';
const lineIdx = html.indexOf(START_TEXT);
if (lineIdx === -1) throw new Error('START_TEXT not found');
const lineStart = html.lastIndexOf('\n', lineIdx) + 1;
const sepLineStart = html.lastIndexOf('\n', lineStart - 2) + 1;
const END_MARKER = '        _renderReportContent(_demo1, _report1, 0);';

const startIdx = sepLineStart;
const endIdx = html.indexOf(END_MARKER, startIdx);
if (endIdx === -1) throw new Error('END marker not found');
const endOfEnd = endIdx + END_MARKER.length;

const newHtml = html.slice(0, startIdx) + block + html.slice(endOfEnd);
fs.writeFileSync(htmlPath, newHtml, 'utf8');
console.log('교체 완료. 이전 블록 길이:', endOfEnd - startIdx, '→ 새 블록 길이:', block.length);
