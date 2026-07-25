'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, KeyRound, Loader2, Mail, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'signing-in' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('signing-in');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus('error');
      setErrorMsg('이메일 또는 비밀번호가 올바르지 않습니다.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50/60 via-slate-50 to-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-popover">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <Sparkles className="h-5 w-5" strokeWidth={2} />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">DearName 어드민</h1>
        <p className="mt-1 text-sm text-slate-500">운영자 이메일과 비밀번호로 로그인합니다.</p>

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
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              required
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'signing-in'}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            {status === 'signing-in' && <Loader2 className="h-4 w-4 animate-spin" />}
            {status === 'signing-in' ? '로그인 중...' : '로그인'}
          </button>
          {status === 'error' && (
            <p className="flex items-start gap-1.5 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMsg}
            </p>
          )}
        </form>
        <p className="mt-4 text-xs text-slate-400">계정이 없으신가요? 어드민에게 계정 생성을 요청해주세요.</p>
      </div>
    </div>
  );
}
