import { createClient } from '@/lib/supabase/server';
import FunnelChart from '@/components/FunnelChart';

export const dynamic = 'force-dynamic';

const STAGES = [
  { name: 'self_done', label: '셀프분석 완료', fill: '#fcd9a8' },
  { name: 'premium_view', label: '프리미엄 조회', fill: '#e8b568' },
  { name: 'checkout_start', label: '결제 시작', fill: '#c9973a' },
  { name: 'paid', label: '결제 완료', fill: '#8a5f22' },
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
      <h1 className="text-xl font-semibold text-slate-900">전환율 퍼널</h1>
      <p className="mt-1 text-sm text-slate-500">
        셀프분석 완료 → 프리미엄 조회 → 결제 시작 → 결제 완료까지의 이용자 흐름입니다.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        {first === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">아직 쌓인 이벤트가 없습니다.</p>
        ) : (
          <FunnelChart data={stages.map(({ label, value, fill }) => ({ name: label, value, fill }))} />
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stages.map((s, i) => {
          const prev = i > 0 ? stages[i - 1].value : null;
          const rate = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
          return (
            <div key={s.name} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">{s.label}</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{s.value.toLocaleString('ko-KR')}건</p>
              {rate != null && <p className="mt-1 text-xs text-slate-400">이전 단계 대비 {rate}%</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
