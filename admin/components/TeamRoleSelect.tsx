'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Shuffle, Trash2 } from 'lucide-react';
import { ALL_ROLES, ROLE_LABEL, type AdminRole } from '@/lib/roles';

const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generatePassword(length = 12): string {
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => PASSWORD_CHARS[n % PASSWORD_CHARS.length]).join('');
}

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
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [resetDone, setResetDone] = useState('');

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
    if (!confirm(`${email} 계정을 삭제할까요? 로그인 계정 자체가 삭제되어 더 이상 로그인할 수 없게 됩니다.`)) return;
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

  function openReset() {
    setResetDone('');
    setNewPassword(generatePassword());
    setResetting(true);
  }

  async function handleResetPassword() {
    if (newPassword.length < 8) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/admin-users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || '비밀번호 재설정에 실패했습니다.');
        setBusy(false);
        return;
      }
      setResetDone(newPassword);
      setResetting(false);
      setBusy(false);
    } catch {
      setError('네트워크 오류로 재설정하지 못했습니다.');
      setBusy(false);
    }
  }

  return (
    <div>
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
        <button
          type="button"
          onClick={openReset}
          disabled={busy}
          title="비밀번호 재설정"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-30"
        >
          <KeyRound className="h-4 w-4" />
        </button>
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

      {resetting && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="min-w-[10rem] rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="button"
            onClick={() => setNewPassword(generatePassword())}
            title="무작위 생성"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={busy || newPassword.length < 8}
            className="rounded-lg bg-brand-600 px-2 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            적용
          </button>
          <button
            type="button"
            onClick={() => setResetting(false)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            취소
          </button>
        </div>
      )}
      {resetDone && (
        <p className="mt-1 text-xs text-emerald-700">
          새 비밀번호로 재설정됨: <b>{resetDone}</b> (전달 후 이 메모는 새로고침하면 사라집니다).
          다음 로그인 시 본인만 아는 비밀번호로 바꾸도록 자동으로 안내됩니다.
        </p>
      )}
    </div>
  );
}
