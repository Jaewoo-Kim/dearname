'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import type { MaintenanceSettings } from '@/lib/types';
import type { AdminRole } from '@/lib/roles';

export default function MaintenanceSettingsForm({ initial, role }: { initial: MaintenanceSettings; role: AdminRole }) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [message, setMessage] = useState(initial.message);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'pending' | 'error'>('idle');
  const [error, setError] = useState('');
  const readOnly = role === 'viewer';

  async function handleSave() {
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'maintenance', value: { enabled, message } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(data.error || '저장에 실패했습니다.');
        return;
      }
      setStatus(data.status === 'pending' ? 'pending' : 'saved');
    } catch {
      setStatus('error');
      setError('네트워크 오류로 저장하지 못했습니다.');
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-500">점검 모드</h2>
          <p className="mt-1 text-xs text-slate-400">
            켜면 본 서비스에 점검 배너가 표시되고 프리미엄 신청이 일시 제한됩니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={readOnly}
          onClick={() => {
            setEnabled((v) => !v);
            setStatus('idle');
          }}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${enabled ? 'bg-red-500' : 'bg-slate-200'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          setStatus('idle');
        }}
        readOnly={readOnly}
        placeholder="점검 안내 문구 (비워두면 기본 문구 사용)"
        rows={2}
        className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50"
      />

      {readOnly ? (
        <p className="mt-4 text-sm text-slate-400">조회 권한만 있어 점검모드를 변경할 수 없습니다.</p>
      ) : (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={status === 'saving'}
            className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            저장
          </button>
          {status === 'saved' && <span className="text-sm text-emerald-600">저장되었습니다.</span>}
          {status === 'pending' && (
            <span className="text-sm text-amber-600">변경 요청이 접수되었습니다. 어드민 승인 후 적용됩니다.</span>
          )}
          {status === 'error' && <span className="text-sm text-red-600">{error}</span>}
        </div>
      )}
    </section>
  );
}
