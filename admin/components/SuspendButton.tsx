'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SuspendButton({
  memberId,
  suspended,
  disabled,
  disabledReason,
}: {
  memberId: string;
  suspended: boolean;
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
        {suspended ? '이용제한 해제 불가' : '이용제한 불가'}
      </button>
    );
  }

  async function handleConfirm() {
    if (!suspended && !reason.trim()) {
      setError('이용제한 사유를 입력해 주세요.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/members/${memberId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: suspended ? 'unsuspend' : 'suspend', reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '처리에 실패했습니다.');
        setLoading(false);
        return;
      }
      setOpen(false);
      setLoading(false);
      router.refresh();
    } catch {
      setError('네트워크 오류로 요청에 실패했습니다.');
      setLoading(false);
    }
  }

  const label = suspended ? '이용제한 해제' : '이용제한';
  const colorClass = suspended
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
    : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100';
  const confirmColorClass = suspended
    ? 'bg-emerald-600 hover:bg-emerald-700'
    : 'bg-red-600 hover:bg-red-700';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-lg border px-3 py-2 text-sm font-medium ${colorClass}`}
      >
        {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">
              {suspended ? '이용제한을 해제할까요?' : '이용을 제한할까요?'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {suspended
                ? '회원에게 해제 안내 메일이 발송됩니다.'
                : '회원이 로그인 후 서비스를 이용하려 할 때 제한 안내가 표시되며, 안내 메일도 함께 발송됩니다.'}
            </p>
            {!suspended && (
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setError('');
                }}
                placeholder="이용제한 사유(필수)"
                rows={3}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            )}
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
                className={`rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50 ${confirmColorClass}`}
              >
                {loading ? '처리 중...' : suspended ? '해제 확정' : '이용제한 확정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
