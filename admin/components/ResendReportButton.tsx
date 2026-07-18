'use client';

import { useState } from 'react';

export default function ResendReportButton({
  reportId,
  viewUrl,
}: {
  reportId: string;
  viewUrl: string | null;
}) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  async function handleClick() {
    setStatus('sending');
    try {
      const res = await fetch(`/api/reports/${reportId}/resend`, { method: 'POST' });
      if (!res.ok) {
        setStatus('error');
        return;
      }
      if (viewUrl && navigator.clipboard) {
        await navigator.clipboard.writeText(viewUrl).catch(() => {});
      }
      setStatus('done');
    } catch {
      setStatus('error');
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
        {status === 'sending' ? '처리 중...' : '재발급 (링크 복사)'}
      </button>
      {status === 'done' && (
        <span className="text-xs text-emerald-600">
          {viewUrl ? '링크가 클립보드에 복사되었습니다. 고객에게 전달해주세요.' : '재발급 기록을 남겼습니다.'}
        </span>
      )}
      {status === 'error' && <span className="text-xs text-red-600">재발급 처리에 실패했습니다.</span>}
    </div>
  );
}
