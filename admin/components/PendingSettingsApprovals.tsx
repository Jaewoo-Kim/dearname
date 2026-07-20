'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { PendingSettingsChange } from '@/lib/types';

const KEY_LABEL: Record<string, string> = { pricing: '가격 설정', maintenance: '점검 모드' };

function summarize(key: string, value: unknown): string {
  if (!value || typeof value !== 'object') return '-';
  if (key === 'maintenance') {
    const v = value as { enabled?: boolean; message?: string };
    return `점검모드 ${v.enabled ? '켜짐' : '꺼짐'}${v.message ? ` · "${v.message}"` : ''}`;
  }
  if (key === 'pricing') {
    const v = value as { self?: number; tiers?: Array<{ count: number; price: number }>; promotion?: { enabled?: boolean; percent?: number; label?: string } };
    const tiers = (v.tiers || []).map((t) => `${t.count}개 ${t.price.toLocaleString()}원`).join(', ');
    const promo = v.promotion?.enabled ? ` · 프로모션 ${v.promotion.percent}%${v.promotion.label ? ` "${v.promotion.label}"` : ''}` : '';
    return `${tiers}${promo}`;
  }
  return JSON.stringify(value);
}

export default function PendingSettingsApprovals({ items }: { items: PendingSettingsChange[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  async function handleAction(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    setErrorById((prev) => ({ ...prev, [id]: '' }));
    try {
      const res = await fetch('/api/settings/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason: reasonById[id] || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorById((prev) => ({ ...prev, [id]: data.error || '처리에 실패했습니다.' }));
        setBusyId(null);
        return;
      }
      router.refresh();
    } catch {
      setErrorById((prev) => ({ ...prev, [id]: '네트워크 오류로 처리하지 못했습니다.' }));
      setBusyId(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-card">
      <h2 className="text-sm font-semibold text-amber-800">승인 대기 중인 변경 요청 ({items.length}건)</h2>
      <div className="mt-3 space-y-3">
        {items.map((item) => {
          const busy = busyId === item.id;
          return (
            <div key={item.id} className="rounded-xl border border-amber-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-900">
                {KEY_LABEL[item.key] || item.key}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {item.requested_by} · {formatDate(item.created_at)}
                </span>
              </p>
              <p className="mt-2 text-xs text-slate-400">현재: {summarize(item.key, item.previous_value)}</p>
              <p className="mt-1 text-sm text-slate-700">변경 요청: {summarize(item.key, item.requested_value)}</p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={reasonById[item.id] || ''}
                  onChange={(e) => setReasonById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="반려 사유(선택)"
                  className="min-w-[10rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => handleAction(item.id, 'approve')}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  승인
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(item.id, 'reject')}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  반려
                </button>
              </div>
              {errorById[item.id] && <p className="mt-2 text-xs text-red-600">{errorById[item.id]}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
