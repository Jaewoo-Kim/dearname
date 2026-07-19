'use client';

import { useState } from 'react';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import type { PricingSettings } from '@/lib/types';

interface TierRow {
  id: string;
  count: number;
  price: number;
}

function withIds(tiers: PricingSettings['tiers']): TierRow[] {
  return tiers.map((t, i) => ({ id: `t${i}-${t.count}-${t.price}`, count: t.count, price: t.price }));
}

const DEFAULT_PROMOTION = { enabled: false, percent: 0, label: '' };

export default function PricingSettingsForm({ initial }: { initial: PricingSettings }) {
  const [selfPrice, setSelfPrice] = useState(initial.self ?? 0);
  const [tiers, setTiers] = useState<TierRow[]>(withIds(initial.tiers));
  const [promoEnabled, setPromoEnabled] = useState(initial.promotion?.enabled ?? DEFAULT_PROMOTION.enabled);
  const [promoPercent, setPromoPercent] = useState(initial.promotion?.percent ?? DEFAULT_PROMOTION.percent);
  const [promoLabel, setPromoLabel] = useState(initial.promotion?.label ?? DEFAULT_PROMOTION.label);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');

  function updateTier(id: string, field: 'count' | 'price', value: number) {
    setStatus('idle');
    setTiers((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  function addTier() {
    setStatus('idle');
    const nextCount = tiers.length ? Math.max(...tiers.map((t) => t.count)) + 1 : 1;
    setTiers((prev) => [...prev, { id: `new-${Date.now()}`, count: nextCount, price: 0 }]);
  }

  function removeTier(id: string) {
    setStatus('idle');
    setTiers((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSave() {
    const counts = tiers.map((t) => t.count);
    const prices = tiers.map((t) => t.price);
    if (new Set(counts).size !== counts.length || new Set(prices).size !== prices.length) {
      setStatus('error');
      setError('구성별 개수와 가격은 서로 겹치지 않게 설정해 주세요(가격이 같으면 결제 시 다른 구성으로 잘못 매칭될 수 있습니다).');
      return;
    }
    if (promoEnabled && (promoPercent <= 0 || promoPercent > 90)) {
      setStatus('error');
      setError('프로모션 할인율은 1~90% 사이로 설정해 주세요.');
      return;
    }
    setStatus('saving');
    setError('');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'pricing',
          value: {
            self: selfPrice,
            tiers: tiers.map(({ count, price }) => ({ count, price })),
            promotion: { enabled: promoEnabled, percent: promoPercent, label: promoLabel },
          },
        }),
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
      <h2 className="text-sm font-semibold text-slate-500">가격 설정</h2>
      <p className="mt-1 text-xs text-slate-400">저장하면 다음 결제 모달부터 바로 반영됩니다.</p>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-700">셀프 작명 가격</p>
        <p className="mt-0.5 text-xs text-slate-400">
          본 서비스는 현재 셀프 작명을 무료로 제공합니다. 이 값을 바꿔도 실제 결제 화면은 아직
          연결돼 있지 않아 참고용으로만 저장됩니다(실제 과금을 원하시면 별도 개발이 필요해요).
        </p>
        <div className="mt-2 flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={1000}
            value={selfPrice}
            onChange={(e) => {
              setStatus('idle');
              setSelfPrice(parseInt(e.target.value || '0', 10));
            }}
            className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-sm text-slate-400">원</span>
        </div>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-sm font-medium text-slate-700">AI 프리미엄 작명 상품 구성</p>
        <div className="mt-2 space-y-2">
          {tiers.map((tier) => (
            <div key={tier.id} className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={tier.count}
                onChange={(e) => updateTier(tier.id, 'count', parseInt(e.target.value || '1', 10))}
                className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <span className="shrink-0 text-sm text-slate-500">개 —</span>
              <input
                type="number"
                min={0}
                step={1000}
                value={tier.price}
                onChange={(e) => updateTier(tier.id, 'price', parseInt(e.target.value || '0', 10))}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <span className="shrink-0 text-sm text-slate-400">원</span>
              <button
                type="button"
                onClick={() => removeTier(tier.id)}
                disabled={tiers.length <= 1}
                title={tiers.length <= 1 ? '최소 1개는 있어야 합니다' : '삭제'}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTier}
          className="mt-3 flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          <Plus className="h-4 w-4" />
          구성 추가
        </button>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-700">프로모션 할인</p>
            <p className="mt-0.5 text-xs text-slate-400">
              켜면 위 상품 구성 가격에 전부 일괄 %할인이 적용돼 결제 모달에 정가와 함께 표시됩니다.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={promoEnabled}
            onClick={() => {
              setStatus('idle');
              setPromoEnabled((v) => !v);
            }}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${promoEnabled ? 'bg-brand-600' : 'bg-slate-200'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                promoEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {promoEnabled && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={90}
              value={promoPercent}
              onChange={(e) => {
                setStatus('idle');
                setPromoPercent(parseInt(e.target.value || '0', 10));
              }}
              className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-center text-sm tabular-nums focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <span className="shrink-0 text-sm text-slate-500">% 할인 —</span>
            <input
              type="text"
              value={promoLabel}
              onChange={(e) => {
                setStatus('idle');
                setPromoLabel(e.target.value);
              }}
              placeholder="프로모션 이름(선택, 예: 여름 프로모션)"
              className="min-w-[180px] flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === 'saving' || tiers.length === 0}
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
