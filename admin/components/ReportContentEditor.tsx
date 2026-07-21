'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Save, X } from 'lucide-react';
import EmptyState from '@/components/EmptyState';

const FIELD_DEFS = [
  { key: 'tagline', label: '핵심 메시지' },
  { key: 'sajuStory', label: '사주 원국 서사' },
  { key: 'jawonStory', label: '자원오행 보완' },
  { key: 'hanjaStory', label: '한자 종합 의미' },
  { key: 'conclusionLetter', label: '부모님께 드리는 편지' },
  { key: 'careerAdvice', label: '이름의 역할' },
] as const;

type FieldKey = (typeof FIELD_DEFS)[number]['key'];

export default function ReportContentEditor({
  reportId,
  initial,
  readOnly,
}: {
  reportId: string;
  initial: Partial<Record<FieldKey, string>>;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<FieldKey, string>>(() =>
    Object.fromEntries(FIELD_DEFS.map((f) => [f.key, initial[f.key] || ''])) as Record<FieldKey, string>
  );
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');

  function handleCancel() {
    setValues(Object.fromEntries(FIELD_DEFS.map((f) => [f.key, initial[f.key] || ''])) as Record<FieldKey, string>);
    setEditing(false);
    setStatus('idle');
    setError('');
  }

  async function handleSave() {
    setStatus('saving');
    setError('');
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: values }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(data.error || '저장에 실패했습니다.');
        return;
      }
      setStatus('idle');
      setEditing(false);
      router.refresh();
    } catch {
      setStatus('error');
      setError('네트워크 오류로 저장하지 못했습니다.');
    }
  }

  const hasAnyContent = FIELD_DEFS.some((f) => values[f.key]);

  if (!hasAnyContent && !editing) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-card">
        <EmptyState title="저장된 보고서 본문을 표시할 수 없습니다" />
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      {!readOnly && (
        <div className="flex items-center justify-end gap-2">
          {error && <span className="text-sm text-red-600">{error}</span>}
          {editing ? (
            <>
              <button
                type="button"
                onClick={handleCancel}
                disabled={status === 'saving'}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={status === 'saving'}
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                저장
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="h-4 w-4" />
              본문 수정
            </button>
          )}
        </div>
      )}

      {FIELD_DEFS.map((f) => {
        if (!editing && !values[f.key]) return null;
        return (
          <div key={f.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h2 className="text-sm font-semibold text-slate-500">{f.label}</h2>
            {editing ? (
              <textarea
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                rows={4}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            ) : (
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{values[f.key]}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
