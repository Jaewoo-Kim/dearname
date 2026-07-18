'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RefundButton({
  orderId,
  disabled,
  disabledReason,
}: {
  orderId: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
      >
        환불 불가
      </button>
    );
  }

  async function handleConfirm() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '환불 처리에 실패했습니다.');
        setLoading(false);
        return;
      }
      setOpen(false);
      setLoading(false);
      router.refresh();
    } catch {
      setError('네트워크 오류로 환불 요청에 실패했습니다.');
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
      >
        환불하기
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">정말 환불하시겠어요?</h3>
            <p className="mt-1 text-sm text-slate-500">
              실제 결제 취소가 토스페이먼츠로 요청됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="환불 사유(선택)"
              rows={2}
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
                className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={loading}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? '처리 중...' : '환불 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
