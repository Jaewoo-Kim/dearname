'use client';

import { useState } from 'react';
import { Loader2, RotateCcw, Save, Search } from 'lucide-react';
import type { HanjaSearchResult } from '@/lib/types';

const OHENG_OPTIONS = ['木', '火', '土', '金', '水'];

interface RowState {
  m: string;
  s: string;
  o: string;
}

function keyOf(r: { kr: string; h: string }) {
  return `${r.kr}-${r.h}`;
}

export default function HanjaDbSearch({ siteUrl }: { siteUrl: string | null }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<HanjaSearchResult[]>([]);
  const [edits, setEdits] = useState<Record<string, RowState>>({});
  const [rowStatus, setRowStatus] = useState<Record<string, 'saving' | 'error'>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  async function handleSearch() {
    const q = query.trim();
    if (!q || !siteUrl) return;
    setSearching(true);
    setSearchError('');
    try {
      const res = await fetch(`${siteUrl.replace(/\/$/, '')}/api/hanja/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSearchError(data.error || '검색에 실패했습니다.');
        setResults([]);
        return;
      }
      const rows: HanjaSearchResult[] = data.results || [];
      setResults(rows);
      setEdits(
        Object.fromEntries(
          rows.map((r) => [keyOf(r), { m: r.m || '', s: r.s != null ? String(r.s) : '', o: r.o || '' }])
        )
      );
    } catch {
      setSearchError('네트워크 오류로 검색하지 못했습니다.');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  function updateEdit(key: string, field: keyof RowState, value: string) {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleSave(r: HanjaSearchResult) {
    const key = keyOf(r);
    const edit = edits[key];
    setRowStatus((prev) => ({ ...prev, [key]: 'saving' }));
    setRowError((prev) => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch('/api/hanja-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hanja: r.h,
          kr: r.kr,
          m: edit.m,
          s: edit.s ? parseInt(edit.s, 10) : null,
          o: edit.o,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowStatus((prev) => ({ ...prev, [key]: 'error' }));
        setRowError((prev) => ({ ...prev, [key]: data.error || '저장에 실패했습니다.' }));
        return;
      }
      setResults((prev) =>
        prev.map((row) => (keyOf(row) === key ? { ...row, m: edit.m, s: parseInt(edit.s, 10) || null, o: edit.o, overridden: true } : row))
      );
      setRowStatus((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch {
      setRowStatus((prev) => ({ ...prev, [key]: 'error' }));
      setRowError((prev) => ({ ...prev, [key]: '네트워크 오류로 저장하지 못했습니다.' }));
    }
  }

  async function handleRevert(r: HanjaSearchResult) {
    const key = keyOf(r);
    setRowStatus((prev) => ({ ...prev, [key]: 'saving' }));
    setRowError((prev) => ({ ...prev, [key]: '' }));
    try {
      const res = await fetch('/api/hanja-overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hanja: r.h, kr: r.kr }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRowStatus((prev) => ({ ...prev, [key]: 'error' }));
        setRowError((prev) => ({ ...prev, [key]: data.error || '원복에 실패했습니다.' }));
        return;
      }
      setResults((prev) =>
        prev.map((row) => (keyOf(row) === key ? { ...row, m: row.baseM, s: row.baseS, o: row.baseO, overridden: false } : row))
      );
      setEdits((prev) => ({
        ...prev,
        [key]: { m: r.baseM || '', s: r.baseS != null ? String(r.baseS) : '', o: r.baseO || '' },
      }));
      setRowStatus((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch {
      setRowStatus((prev) => ({ ...prev, [key]: 'error' }));
      setRowError((prev) => ({ ...prev, [key]: '네트워크 오류로 원복하지 못했습니다.' }));
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-slate-500">한자 검색</h2>
      <p className="mt-1 text-xs text-slate-400">
        한글 음(예: 가) 또는 한자 1글자로 검색합니다. 본 서비스({siteUrl || '주소 미설정'})의 실제 한자
        DB를 조회합니다.
      </p>

      {!siteUrl ? (
        <p className="mt-4 text-sm text-slate-400">
          NEXT_PUBLIC_DEARNAME_SITE_URL 환경변수를 설정하면 검색 기능이 활성화됩니다.
        </p>
      ) : (
        <>
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="가  또는  串"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              검색
            </button>
          </div>
          {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}

          {results.length > 0 && (
            <div className="mt-4 space-y-3">
              {results.map((r) => {
                const key = keyOf(r);
                const edit = edits[key] || { m: '', s: '', o: '' };
                const busy = rowStatus[key] === 'saving';
                return (
                  <div key={key} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="text-lg font-medium text-slate-900">{r.h}</span>
                      <span>({r.kr})</span>
                      {r.overridden && (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          수정됨
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={edit.m}
                        onChange={(e) => updateEdit(key, 'm', e.target.value)}
                        placeholder="뜻"
                        className="min-w-[8rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <input
                        type="number"
                        value={edit.s}
                        onChange={(e) => updateEdit(key, 's', e.target.value)}
                        placeholder="획수"
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <select
                        value={edit.o}
                        onChange={(e) => updateEdit(key, 'o', e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        {OHENG_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => handleSave(r)}
                        disabled={busy}
                        className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        저장
                      </button>
                      {r.overridden && (
                        <button
                          type="button"
                          onClick={() => handleRevert(r)}
                          disabled={busy}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-4 w-4" />
                          원복
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      원본값: {r.baseM || '-'} · {r.baseS ?? '-'}획 · {r.baseO || '-'}
                    </p>
                    {rowError[key] && <p className="mt-1 text-xs text-red-600">{rowError[key]}</p>}
                  </div>
                );
              })}
            </div>
          )}
          {!searching && results.length === 0 && query.trim() && !searchError && (
            <p className="mt-4 text-sm text-slate-400">검색 결과가 없습니다.</p>
          )}
        </>
      )}
    </section>
  );
}
