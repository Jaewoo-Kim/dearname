'use client';

import { useState } from 'react';
import { Loader2, Plus, X } from 'lucide-react';
import type { TabooHanjaRow } from '@/lib/types';

export default function TabooHanjaForm({ initial, readOnly }: { initial: TabooHanjaRow[]; readOnly?: boolean }) {
  const [rows, setRows] = useState<TabooHanjaRow[]>(initial);
  const [newHanja, setNewHanja] = useState('');
  const [newReason, setNewReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleAdd() {
    const hanja = newHanja.trim();
    if (!hanja) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/taboo-hanja', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hanja, reason: newReason.trim() || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '추가에 실패했습니다.');
        return;
      }
      setRows((prev) => [...prev.filter((r) => r.hanja !== hanja), { hanja, reason: newReason.trim() || null }]);
      setNewHanja('');
      setNewReason('');
    } catch {
      setError('네트워크 오류로 추가하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(hanja: string) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/taboo-hanja', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hanja }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '삭제에 실패했습니다.');
        return;
      }
      setRows((prev) => prev.filter((r) => r.hanja !== hanja));
    } catch {
      setError('네트워크 오류로 삭제하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-slate-500">금기 한자 관리</h2>
      <p className="mt-1 text-xs text-slate-400">
        뜻이 불길하거나 이름에 부적합한 한자입니다. 이름 탐색 결과 후보군에서 자동으로 제외됩니다.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {rows.length === 0 && <p className="text-sm text-slate-400">등록된 금기 한자가 없습니다.</p>}
        {rows.map((r) => (
          <span
            key={r.hanja}
            title={r.reason || undefined}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1.5 text-sm text-red-700"
          >
            {r.hanja}
            {!readOnly && (
              <button
                type="button"
                onClick={() => handleRemove(r.hanja)}
                disabled={busy}
                className="text-red-400 hover:text-red-700 disabled:opacity-50"
                aria-label={`${r.hanja} 삭제`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>

      {readOnly ? (
        <p className="mt-4 text-sm text-slate-400">조회 권한만 있어 금기 한자를 수정할 수 없습니다.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            type="text"
            maxLength={2}
            value={newHanja}
            onChange={(e) => setNewHanja(e.target.value)}
            placeholder="한자 1글자"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <input
            type="text"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            placeholder="사유(선택)"
            className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={busy || !newHanja.trim()}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            추가
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
