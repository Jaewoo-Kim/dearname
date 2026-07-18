import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatKRW } from '@/lib/format';
import RevenueChart from '@/components/RevenueChart';
import ProductMixChart from '@/components/ProductMixChart';
import type { ProductMixRow, RevenueRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RangeKey = 'day' | 'month' | 'year';

const RANGE_CONFIG: Record<
  RangeKey,
  { view: string; limit: number; label: string; format: (bucket: string) => string }
> = {
  day: {
    view: 'revenue_daily',
    limit: 14,
    label: '오늘',
    format: (b) => new Date(b).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }),
  },
  month: {
    view: 'revenue_monthly',
    limit: 12,
    label: '이번달',
    format: (b) => new Date(b).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' }),
  },
  year: {
    view: 'revenue_yearly',
    limit: 5,
    label: '올해',
    format: (b) => new Date(b).toLocaleDateString('ko-KR', { year: 'numeric' }),
  },
};

const RANGE_TABS: Array<{ value: RangeKey; label: string }> = [
  { value: 'day', label: '일별' },
  { value: 'month', label: '월별' },
  { value: 'year', label: '연도별' },
];

async function getDashboardData(range: RangeKey) {
  const supabase = createClient();
  const cfg = RANGE_CONFIG[range];

  const [{ data: trendDesc }, { data: productMix }, { count: memberCount }] = await Promise.all([
    supabase.from(cfg.view).select('*').order('bucket', { ascending: false }).limit(cfg.limit),
    supabase.from('revenue_by_product').select('*'),
    supabase.from('members').select('*', { count: 'exact', head: true }),
  ]);

  const trend = ((trendDesc as unknown as RevenueRow[]) || []).slice().reverse();
  const latest = trend[trend.length - 1];

  return {
    trend,
    latest,
    productMix: (productMix as unknown as ProductMixRow[]) || [],
    memberCount: memberCount || 0,
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: { range?: string } }) {
  const range: RangeKey = (['day', 'month', 'year'] as string[]).includes(searchParams.range || '')
    ? (searchParams.range as RangeKey)
    : 'month';

  const { trend, latest, productMix, memberCount } = await getDashboardData(range);
  const cfg = RANGE_CONFIG[range];

  const avgOrderValue = latest && latest.order_count > 0 ? Math.round(latest.revenue / latest.order_count) : 0;

  const cards = [
    { label: `${cfg.label} 매출`, value: formatKRW(latest?.revenue || 0) },
    { label: `${cfg.label} 주문`, value: `${(latest?.order_count || 0).toLocaleString('ko-KR')}건` },
    { label: '평균 객단가', value: formatKRW(avgOrderValue) },
    { label: `${cfg.label} 환불`, value: formatKRW(latest?.refund_amount || 0) },
  ];

  const chartData = trend.map((row) => ({
    label: cfg.format(row.bucket),
    revenue: row.revenue,
    orderCount: row.order_count,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">대시보드</h1>
        <div className="flex gap-2">
          {RANGE_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/dashboard?range=${tab.value}`}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                range === tab.value
                  ? 'bg-brand-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-500">매출 추이</h2>
          {chartData.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-400">표시할 데이터가 없습니다.</p>
          ) : (
            <div className="mt-2">
              <RevenueChart data={chartData} />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">상품 비중 (매출 기준)</h2>
          <ProductMixChart data={productMix} />
        </section>
      </div>

      <p className="mt-4 text-xs text-slate-400">전체 회원 수 {memberCount.toLocaleString('ko-KR')}명</p>
    </div>
  );
}
