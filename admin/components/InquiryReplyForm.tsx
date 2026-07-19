'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Send } from 'lucide-react';

export default function InquiryReplyForm({ inquiryId }: { inquiryId: string }) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!reply.trim()) {
      setStatus('error');
      setError('답변 내용을 입력해주세요.');
      return;
    }
    setStatus('saving');
    setError('');
    try {
      const res = await fetch(`/api/inquiries/${inquiryId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(data.error || '답변 저장에 실패했습니다.');
        return;
      }
      router.refresh();
    } catch {
      setStatus('error');
      setError('네트워크 오류로 저장하지 못했습니다.');
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-slate-500">답변하기</h2>
      <textarea
        value={reply}
        onChange={(e) => {
          setReply(e.target.value);
          setStatus('idle');
        }}
        placeholder="고객에게 전달할 답변을 입력하세요."
        rows={4}
        className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={status === 'saving'}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          답변 저장
        </button>
        {status === 'error' && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
