'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const MIN_PASSWORD_LENGTH = 8;

export default function ChangePasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus('error');
      setError(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
      return;
    }
    if (password !== confirm) {
      setStatus('error');
      setError('두 비밀번호가 서로 다릅니다.');
      return;
    }

    setStatus('saving');
    setError('');
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setStatus('error');
      setError('비밀번호 변경에 실패했습니다.');
      return;
    }

    setPassword('');
    setConfirm('');
    setStatus('saved');
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-3">
      <div>
        <label className="text-sm font-medium text-slate-700">새 비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setStatus('idle');
          }}
          placeholder="8자 이상"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-slate-700">새 비밀번호 확인</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setStatus('idle');
          }}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={status === 'saving'}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          변경
        </button>
        {status === 'saved' && <span className="text-sm text-emerald-600">변경되었습니다.</span>}
        {status === 'error' && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
