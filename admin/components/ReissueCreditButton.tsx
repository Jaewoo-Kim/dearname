'use client';

import { useState } from 'react';

export default function ReissueCreditButton({ reportId }: { reportId: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [credits, setCredits] = useState<number | null>(null);

  async function handleClick() {
    setStatus('sending');
    setError('');
    try {
      const res = await fetch(`/api/reports/${reportId}/reissue`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(data.error || '생성권 부여에 실패했습니다.');
        return;
      }
      setCredits(data.credits ?? null);
      setStatus('done');
    } catch {
      setStatus('error');
      setError('네트워크 오류로 처리하지 못했습니다.');
    }
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={status === 'sending'}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {status === 'sending' ? '처리 중...' : '재발급 (생성권 부여)'}
      </button>
      {status === 'done' && (
        <span className="text-xs text-emerald-600">
          무료 생성권을 부여했습니다{credits != null ? ` (보유 ${credits}개)` : ''}. 고객이 로그인 후 결제 없이 새 보고서를 만들 수 있습니다.
        </span>
      )}
      {status === 'error' && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
