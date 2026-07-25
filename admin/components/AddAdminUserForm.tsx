'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Shuffle } from 'lucide-react';
import { ALL_ROLES, ROLE_LABEL, type AdminRole } from '@/lib/roles';

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generatePassword(length = 12): string {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('');
}

export default function AddAdminUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('viewer');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function handleAdd() {
    if (!email.trim() || !password) return;
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(data.error || '추가에 실패했습니다.');
        return;
      }
      setCreated({ email: email.trim(), password });
      setEmail('');
      setPassword('');
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
        이메일·비밀번호·등급으로 바로 로그인 가능한 계정을 만듭니다. 생성한 비밀번호는
        나중에 다시 볼 수 없으니 아래에 표시될 때 안전하게 전달해주세요(예: 사내 메신저).
        최초 로그인 시 본인만 아는 비밀번호로 바꾸도록 자동으로 안내됩니다.
      </p>

      {created && (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="font-medium text-emerald-800">계정이 생성되었습니다. 아래 정보를 전달해주세요.</p>
          <p className="mt-1 text-emerald-700">
            이메일: <b>{created.email}</b> · 비밀번호: <b>{created.password}</b>
          </p>
          <p className="mt-1 text-emerald-600">최초 로그인 시 비밀번호 변경 화면으로 자동 이동합니다.</p>
        </div>
      )}

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
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="초기 비밀번호(8자 이상)"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={() => setPassword(generatePassword())}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Shuffle className="h-4 w-4" />
          무작위 생성
        </button>
        <button
          type="button"
          onClick={handleAdd}
          disabled={status === 'saving' || !email.trim() || password.length < 8}
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
