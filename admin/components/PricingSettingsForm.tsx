'use client';

import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import type { PricingSettings, PricingTier } from '@/lib/types';

export default function PricingSettingsForm({ initial }: { initial: PricingSettings }) {
  const [tiers, setTiers] = useState<PricingTier[]>(initial.tiers);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  function updateTier(index: number, price: number) {
    setStatus('idle');
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, price } : t)));
  }

  async function handleSave() {
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'pricing', value: { tiers } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setError(data.error || '저장에 실패했습니다.');
        return;
      }
      setStatus('saved');
    } catch {
      setStatus('error');
      setError('네트워크 오류로 저장하지 못했습니다.');
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <h2 className="text-sm font-semibold text-slate-500">프리미엄 가격</h2>
      <p className="mt-1 text-xs text-slate-400">
        소견서 개수별 결제 금액입니다. 저장하면 다음 결제 모달부터 바로 반영됩니다.
      </p>

      <div className="mt-4 space-y-3">
        {tiers.map((tier, i) => (
          <div key={tier.count} className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-sm text-slate-600">소견서 {tier.count}개</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={tier.price}
              onChange={(e) => updateTier(i, parseInt(e.target.value || '0', 10))}
              className="w-full flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="w-6 shrink-0 text-sm text-slate-400">원</span>
          </div>
        ))}
      </div>

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
        {status === 'error' && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </section>
  );
}
