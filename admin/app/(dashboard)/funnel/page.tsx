import { CheckCircle2, CreditCard, MousePointerClick, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import FunnelChart from '@/components/FunnelChart';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';

export const dynamic = 'force-dynamic';

const STAGES = [
  { name: 'self_done', label: '셀프분석 완료', fill: '#fcd9a8', icon: Sparkles },
  { name: 'premium_view', label: '프리미엄 조회', fill: '#e8b568', icon: MousePointerClick },
  { name: 'checkout_start', label: '결제 시작', fill: '#c9973a', icon: CreditCard },
  { name: 'paid', label: '결제 완료', fill: '#8a5f22', icon: CheckCircle2 },
];

async function getCounts() {
  const supabase = createClient();
  const results = await Promise.all(
    STAGES.map((s) => supabase.from('events').select('*', { count: 'exact', head: true }).eq('name', s.name))
  );
  return STAGES.map((s, i) => ({ ...s, value: results[i].count || 0 }));
}

export default async function FunnelPage() {
  const stages = await getCounts();
  const first = stages[0]?.value || 0;

  return (
    <div>
      <PageHeader
        title="전환율 퍼널"
        description="셀프분석 완료 → 프리미엄 조회 → 결제 시작 → 결제 완료까지의 이용자 흐름입니다."
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        {first === 0 ? (
          <EmptyState title="아직 쌓인 이벤트가 없습니다" />
        ) : (
          <FunnelChart data={stages.map(({ label, value, fill }) => ({ name: label, value, fill }))} />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].value : null;
          const rate = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
          return (
            <StatCard
              key={s.name}
              label={s.label}
              value={`${s.value.toLocaleString('ko-KR')}건`}
              icon={s.icon}
              accent={i === stages.length - 1 ? 'emerald' : 'slate'}
              footnote={rate != null ? `이전 단계 대비 ${rate}%` : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
