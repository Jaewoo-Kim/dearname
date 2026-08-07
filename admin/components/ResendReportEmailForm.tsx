'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';

// 보고서 보관용 링크 재발송 — 고객이 "메일을 못 받았다"고 문의했을 때 운영자가 바로 다시 보낸다.
// 기본값은 주문에 남은 회원 연락처이고, 다른 주소로 받고 싶다는 요청도 있어 수정할 수 있게 둔다.
export default function ResendReportEmailForm({
  reportId,
  defaultEmail,
  readOnly,
}: {
  reportId: string;
  defaultEmail?: string | null;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(defaultEmail || '');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (readOnly) {
    return (
      <p className="mt-3 text-sm text-slate-400">조회 권한만 있어 메일을 재발송할 수 없습니다.</p>
    );
  }

  async function handleSend() {
    if (!email.includes('@')) {
      setStatus('error');
      setMessage('올바른 이메일 주소를 입력해주세요.');
      return;
    }
    setStatus('sending');
    setMessage('');
    try {
      const res = await fetch(`/api/reports/${reportId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || '재발송에 실패했습니다.');
        return;
      }
      setStatus('done');
      setMessage('메일을 다시 보냈습니다.');
      router.refresh();
    } catch {
      setStatus('error');
      setMessage('네트워크 오류로 재발송하지 못했습니다.');
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus('idle');
          }}
          placeholder="받을 이메일 주소"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={status === 'sending'}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {status === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          링크 재발송
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-sm ${status === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>{message}</p>
      )}
    </div>
  );
}
