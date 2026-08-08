'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Eye, RotateCcw } from 'lucide-react';
import type { LegalDocType } from '@/lib/types';

// 약관·개인정보처리방침 본문 편집기.
// 본문은 HTML이라 잘못 고치면 화면이 깨질 수 있으므로, 저장 전에 미리보기로 확인할 수 있게 한다.
export default function LegalDocumentEditor({
  docType,
  label,
  initialContent,
  initialEffectiveDate,
  source,
  publicUrl,
  readOnly,
  readOnlyReason,
}: {
  docType: LegalDocType;
  label: string;
  initialContent: string;
  initialEffectiveDate: string | null;
  source: 'db' | 'file' | 'unavailable';
  publicUrl: string | null;
  readOnly?: boolean;
  readOnlyReason?: string;
}) {
  const router = useRouter();
  const [content, setContent] = useState(initialContent);
  const [effectiveDate, setEffectiveDate] = useState(initialEffectiveDate || '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState(false);

  const dirty = content !== initialContent || (effectiveDate || '') !== (initialEffectiveDate || '');

  async function handleSave() {
    if (!content.trim()) {
      setStatus('error');
      setMessage('본문이 비어 있습니다.');
      return;
    }
    setStatus('saving');
    setMessage('');
    try {
      const res = await fetch('/api/legal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, content, effectiveDate: effectiveDate || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || '저장에 실패했습니다.');
        return;
      }
      setStatus('done');
      setMessage('저장했습니다. 서비스 페이지에 바로 반영됩니다.');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('네트워크 오류로 저장하지 못했습니다.');
    }
  }

  if (source === 'unavailable') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        본 서비스에서 {label} 본문을 불러오지 못했습니다. <code>NEXT_PUBLIC_DEARNAME_SITE_URL</code>이
        올바른지, 본 서비스가 정상 동작 중인지 확인해 주세요.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{label}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {source === 'db'
              ? '어드민에서 저장한 본문이 게시 중입니다.'
              : '아직 어드민에서 저장한 적이 없어, 저장소의 기본 본문을 불러왔습니다. 저장하면 이 내용이 게시됩니다.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              실제 페이지 보기
            </a>
          )}
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            {preview ? '편집으로' : '미리보기'}
          </button>
        </div>
      </div>

      {preview ? (
        <div
          className="prose-legal mt-4 max-h-[540px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"
          // 운영자 본인이 방금 입력한 내용을 확인용으로 렌더링한다(어드민만 접근 가능).
          dangerouslySetInnerHTML={{ __html: content }}
        />
      ) : (
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setStatus('idle');
          }}
          readOnly={readOnly}
          spellCheck={false}
          rows={22}
          className="mt-4 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
        />
      )}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-slate-500" htmlFor={`eff-${docType}`}>
            시행일 (표시용)
          </label>
          <input
            id={`eff-${docType}`}
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            readOnly={readOnly}
            className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {readOnly ? (
          <p className="text-sm text-slate-400">{readOnlyReason}</p>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSave}
              disabled={status === 'saving' || !dirty}
              className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              저장하고 게시
            </button>
            {dirty && (
              <button
                type="button"
                onClick={() => {
                  setContent(initialContent);
                  setEffectiveDate(initialEffectiveDate || '');
                  setStatus('idle');
                  setMessage('');
                }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                되돌리기
              </button>
            )}
          </>
        )}
      </div>

      {message && (
        <p className={`mt-2 text-sm ${status === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>
      )}
    </div>
  );
}
