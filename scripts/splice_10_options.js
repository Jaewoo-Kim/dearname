// scripts/splice_10_options.js — index.html의 기존 4탭 데모 블록을 10탭 블록으로 교체
'use strict';
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const START = '        // ── 이름 1: 최하은 (崔嘏銀)';
const END_MARKER = '        _renderReportContent(_demo1, _report1, 0);';

const s = src.indexOf(START);
if (s < 0) { console.error('시작 마커를 찾지 못함'); process.exit(1); }
const e = src.indexOf(END_MARKER, s);
if (e < 0) { console.error('끝 마커를 찾지 못함'); process.exit(1); }
const endPos = e + END_MARKER.length;

const newBlock = fs.readFileSync(path.join(__dirname, '..', '_10opt_block.txt'), 'utf8').replace(/\n$/, '');

src = src.slice(0, s) + newBlock + src.slice(endPos);
fs.writeFileSync(FILE, src, 'utf8');
console.log('교체 완료: 제거 ' + (endPos - s) + '자, 삽입 ' + newBlock.length + '자');
