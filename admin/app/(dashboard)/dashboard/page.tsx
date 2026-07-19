import Link from 'next/link';
import { CreditCard, ReceiptText, RotateCcw, Wallet } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatKRW } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import RevenueChart from '@/components/RevenueChart';
import ProductMixChart from '@/components/ProductMixChart';
import PaymentMethodChart from '@/components/PaymentMethodChart';
import type { PaymentMethodRow, ProductMixRow, RevenueRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RangeKey = 'day' | 'month' | 'year';

const RANGE_CONFIG: Record<RangeKey, { view: string; label: string }> = {
  day: { view: 'revenue_daily', label: '오늘' },
  month: { view: 'revenue_monthly', label: '이번달' },
  year: { view: 'revenue_yearly', label: '올해' },
};

const RANGE_TABS: Array<{ value: RangeKey; label: string }> = [
  { value: 'day', label: '일별' },
  { value: 'month', label: '월별' },
  { value: 'year', label: '연도별' },
];

// 매출 추이 그래프는 필터와 무관하게 항상 최근 12개월 고정
const TREND_MONTHS = 12;
const formatMonth = (b: string) => new Date(b).toLocaleDateString('ko-KR', { year: '2-digit', month: 'short' });

function pctChange(current: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((current - prev) / prev) * 100);
}

async function getDashboardData(range: RangeKey) {
  const supabase = createClient();
  const cfg = RANGE_CONFIG[range];

  const [{ data: statDesc }, { data: trendDesc }, { data: productMix }, { data: paymentMix }, { count: memberCount }] =
    await Promise.all([
      supabase.from(cfg.view).select('*').order('bucket', { ascending: false }).limit(2),
      supabase.from('revenue_monthly').select('*').order('bucket', { ascending: false }).limit(TREND_MONTHS),
      supabase.from('revenue_by_product').select('*'),
      supabase.from('revenue_by_payment_method').select('*'),
      supabase.from('members').select('*', { count: 'exact', head: true }),
    ]);

  const stats = ((statDesc as unknown as RevenueRow[]) || []).slice().reverse();
  const latest = stats[stats.length - 1];
  const prev = stats[stats.length - 2];

  const trend = ((trendDesc as unknown as RevenueRow[]) || []).slice().reverse();

  return {
    trend,
    latest,
    prev,
    productMix: (productMix as unknown as ProductMixRow[]) || [],
    paymentMix: (paymentMix as unknown as PaymentMethodRow[]) || [],
    memberCount: memberCount || 0,
  };
}

export default async function DashboardPage({ searchParams }: { searchParams: { range?: string } }) {
  const range: RangeKey = (['day', 'month', 'year'] as string[]).includes(searchParams.range || '')
    ? (searchParams.range as RangeKey)
    : 'month';

  const { trend, latest, prev, productMix, paymentMix, memberCount } = await getDashboardData(range);
  const cfg = RANGE_CONFIG[range];

  const avgOrderValue = latest && latest.order_count > 0 ? Math.round(latest.revenue / latest.order_count) : 0;
  const prevAvgOrderValue = prev && prev.order_count > 0 ? Math.round(prev.revenue / prev.order_count) : 0;

  const revenueTrend = prev ? pctChange(latest?.revenue || 0, prev.revenue) : null;
  const orderTrend = prev ? pctChange(latest?.order_count || 0, prev.order_count) : null;
  const avgTrend = prev ? pctChange(avgOrderValue, prevAvgOrderValue) : null;

  const chartData = trend.map((row) => ({
    label: formatMonth(row.bucket),
    revenue: row.revenue,
    orderCount: row.order_count,
  }));

  return (
    <div>
      <PageHeader
        title="대시보드"
        description="이전 구간 대비 변화율과 함께 최근 매출 현황을 한눈에 봅니다."
        actions={RANGE_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/dashboard?range=${tab.value}`}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              range === tab.value
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={`${cfg.label} 매출`}
          value={formatKRW(latest?.revenue || 0)}
          icon={Wallet}
          trend={revenueTrend != null ? { value: revenueTrend, label: '이전 구간 대비' } : undefined}
        />
        <StatCard
          label={`${cfg.label} 주문`}
          value={`${(latest?.order_count || 0).toLocaleString('ko-KR')}건`}
          icon={ReceiptText}
          accent="slate"
          trend={orderTrend != null ? { value: orderTrend, label: '이전 구간 대비' } : undefined}
        />
        <StatCard
          label="평균 객단가"
          value={formatKRW(avgOrderValue)}
          icon={CreditCard}
          accent="slate"
          trend={avgTrend != null ? { value: avgTrend, label: '이전 구간 대비' } : undefined}
        />
        <StatCard
          label={`${cfg.label} 환불`}
          value={formatKRW(latest?.refund_amount || 0)}
          icon={RotateCcw}
          accent="red"
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-500">매출 추이 (최근 12개월)</h2>
          {chartData.length === 0 ? (
            <EmptyState title="표시할 데이터가 없습니다" />
          ) : (
            <div className="mt-2">
              <RevenueChart data={chartData} />
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-sm font-semibold text-slate-500">상품 비중 (매출 기준)</h2>
          <ProductMixChart data={productMix} />
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-500">결제수단별 매출</h2>
          <PaymentMethodChart data={paymentMix} />
        </section>
      </div>

      <p className="mt-4 text-xs text-slate-400">전체 회원 수 {memberCount.toLocaleString('ko-KR')}명</p>
    </div>
  );
}
