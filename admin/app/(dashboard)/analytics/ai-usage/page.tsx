import { Bot, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import AiCostChart from '@/components/AiCostChart';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import SubTabs from '@/components/SubTabs';

export const dynamic = 'force-dynamic';

interface AiCostRow {
  bucket: string;
  model: string;
  kind: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

async function getRows() {
  const supabase = createClient();
  // ai_cost_daily는 (day, model, kind) 단위로 나뉘어 있어 최근 14일 안에도 여러 행이 나올 수 있다 — 넉넉히 가져와 걸러낸다.
  const { data } = await supabase.from('ai_cost_daily').select('*').order('bucket', { ascending: false }).limit(14 * 6);
  return (data as unknown as AiCostRow[]) || [];
}

export default async function AiUsagePage() {
  const rows = await getRows();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);
  const recent = rows.filter((r) => new Date(r.bucket) >= cutoff);

  const byDay = new Map<string, { date: string; cost: number; calls: number }>();
  for (const r of recent) {
    const cur = byDay.get(r.bucket) || { date: r.bucket, cost: 0, calls: 0 };
    cur.cost += Number(r.cost_usd);
    cur.calls += r.calls;
    byDay.set(r.bucket, cur);
  }
  const chartData = Array.from(byDay.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      label: new Date(d.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
      cost: Number(d.cost.toFixed(4)),
      calls: d.calls,
    }));

  const byModel = new Map<string, { model: string; cost: number; calls: number }>();
  for (const r of rows) {
    const cur = byModel.get(r.model) || { model: r.model, cost: 0, calls: 0 };
    cur.cost += Number(r.cost_usd);
    cur.calls += r.calls;
    byModel.set(r.model, cur);
  }
  const modelRows = Array.from(byModel.values()).sort((a, b) => b.cost - a.cost);

  const totalCost14d = chartData.reduce((s, d) => s + d.cost, 0);
  const totalCalls14d = chartData.reduce((s, d) => s + d.calls, 0);

  return (
    <div>
      <PageHeader
        title="AI 비용"
        description="Claude/Gemini 호출 시 서버가 자동 기록한 추정 비용입니다(마진 관리 참고용, 실제 청구 금액과 다를 수 있음)."
      />
      <SubTabs
        active="/analytics/ai-usage"
        tabs={[
          { href: '/analytics', label: '전환율 퍼널' },
          { href: '/analytics/ai-usage', label: 'AI 비용' },
          { href: '/analytics/naming-stats', label: '작명 통계' },
        ]}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="최근 14일 비용" value={`$${totalCost14d.toFixed(2)}`} icon={Zap} />
        <StatCard
          label="최근 14일 호출 수"
          value={`${totalCalls14d.toLocaleString('ko-KR')}건`}
          icon={Bot}
          accent="slate"
        />
      </div>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-500">일별 비용 추이 (최근 14일)</h2>
        {chartData.length === 0 ? (
          <EmptyState title="표시할 데이터가 없습니다" />
        ) : (
          <AiCostChart data={chartData} />
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-500">모델별 비용 (전체 기간)</h2>
        {modelRows.length === 0 ? (
          <EmptyState title="표시할 데이터가 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[420px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="whitespace-nowrap py-2 font-medium">모델</th>
                  <th className="whitespace-nowrap py-2 font-medium">호출 수</th>
                  <th className="whitespace-nowrap py-2 font-medium">비용</th>
                </tr>
              </thead>
              <tbody>
                {modelRows.map((m) => (
                  <tr key={m.model} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap py-2 text-slate-600">{m.model}</td>
                    <td className="whitespace-nowrap py-2 text-slate-600">{m.calls.toLocaleString('ko-KR')}건</td>
                    <td className="whitespace-nowrap py-2 font-medium tabular-nums text-slate-900">${m.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
