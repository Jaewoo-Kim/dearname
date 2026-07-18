'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, Mail, MailCheck, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const searchParams = useSearchParams();
  const notAllowed = searchParams.get('error') === 'not_allowed';

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });

    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/60 via-slate-50 to-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-popover">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Sparkles className="h-5 w-5" strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">DearName 어드민</h1>
        <p className="mt-1 text-sm text-slate-500">운영자 이메일로 로그인 링크를 보내드립니다.</p>

        {notAllowed && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            이 이메일은 어드민 접근 권한이 없습니다. 다른 계정으로 시도해주세요.
          </div>
        )}

        {status === 'sent' ? (
          <div className="mt-6 flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-3 text-sm text-brand-700">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <b>{email}</b> 주소로 로그인 링크를 보냈습니다. 메일함을 확인해주세요.
            </span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                required
                placeholder="admin@dearname.kr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <button
              type="submit"
              disabled={status === 'sending'}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {status === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
              {status === 'sending' ? '전송 중...' : '로그인 링크 받기'}
            </button>
            {status === 'error' && (
              <p className="flex items-start gap-1.5 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {errorMsg}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
