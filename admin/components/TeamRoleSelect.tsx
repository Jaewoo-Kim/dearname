'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Trash2 } from 'lucide-react';
import { ALL_ROLES, ROLE_LABEL, type AdminRole } from '@/lib/roles';

export default function TeamRoleSelect({
  email,
  role,
  isSelf,
}: {
  email: string;
  role: AdminRole;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleRoleChange(nextRole: AdminRole) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role: nextRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '변경에 실패했습니다.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('네트워크 오류로 변경하지 못했습니다.');
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`${email} 계정을 삭제할까요? 더 이상 로그인해도 등급이 없어 접근이 제한됩니다.`)) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin-users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '삭제에 실패했습니다.');
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError('네트워크 오류로 삭제하지 못했습니다.');
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={role}
        disabled={busy || isSelf}
        onChange={(e) => handleRoleChange(e.target.value as AdminRole)}
        title={isSelf ? '본인 등급은 다른 어드민이 변경해야 합니다' : undefined}
        className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {ALL_ROLES.map((r) => (
          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
        ))}
      </select>
      {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" />}
      {!isSelf && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          title="삭제"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
