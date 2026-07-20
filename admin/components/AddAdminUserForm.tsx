'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus } from 'lucide-react';
import { ALL_ROLES, ROLE_LABEL, type AdminRole } from '@/lib/roles';

export default function AddAdminUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('viewer');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleAdd() {
    if (!email.trim()) return;
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(data.error || '추가에 실패했습니다.');
        return;
      }
      setEmail('');
      setRole('viewer');
      setStatus('idle');
      router.refresh();
    } catch {
      setStatus('error');
      setError('네트워크 오류로 추가하지 못했습니다.');
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-slate-500">계정 추가</h2>
      <p className="mt-1 text-xs text-slate-400">
        이메일과 등급을 미리 지정해둘 수 있습니다. 실제 로그인이 되려면 Vercel의
        ADMIN_ALLOWED_EMAILS 환경변수에도 같은 이메일이 포함되어 있어야 합니다.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as AdminRole)}
          className="rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          disabled={status === 'saving' || !email.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          추가
        </button>
      </div>
      {status === 'error' && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}
