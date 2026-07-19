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
import MonthPicker from '@/components/MonthPicker';
import YearPicker from '@/components/YearPicker';
import type { PaymentMethodRow, ProductMixRow, RevenueRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RangeKey = 'month' | 'year';

const RANGE_TABS: Array<{ value: RangeKey; label: string }> = [
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

function monthKey(bucket: string) {
  return bucket.slice(0, 7); // 'YYYY-MM'
}
function yearKey(bucket: string) {
  return bucket.slice(0, 4); // 'YYYY'
}

async function getDashboardData(range: RangeKey, month: string, year: string) {
  const supabase = createClient();

  const [my, mm] = month.split('-').map(Number);
  const curMonthBucket = new Date(Date.UTC(my, mm - 1, 1)).toISOString();
  const prevMonthDate = new Date(Date.UTC(my, mm - 2, 1));
  const prevMonthBucket = prevMonthDate.toISOString();
  const prevMonthKey = `${prevMonthDate.getUTCFullYear()}-${String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;

  const yNum = Number(year);
  const curYearBucket = new Date(Date.UTC(yNum, 0, 1)).toISOString();
  const prevYearBucket = new Date(Date.UTC(yNum - 1, 0, 1)).toISOString();
  const prevYearKey = String(yNum - 1);

  const [
    { data: monthRows },
    { data: yearRows },
    { data: yearOptionRows },
    { data: trendDesc },
    { data: productMix },
    { data: paymentMix },
    { count: memberCount },
  ] = await Promise.all([
    supabase.from('revenue_monthly').select('*').in('bucket', [curMonthBucket, prevMonthBucket]),
    supabase.from('revenue_yearly').select('*').in('bucket', [curYearBucket, prevYearBucket]),
    supabase.from('revenue_yearly').select('bucket').order('bucket', { ascending: false }).limit(20),
    supabase.from('revenue_monthly').select('*').order('bucket', { ascending: false }).limit(TREND_MONTHS),
    supabase.from('revenue_by_product').select('*'),
    supabase.from('revenue_by_payment_method').select('*'),
    supabase.from('members').select('*', { count: 'exact', head: true }),
  ]);

  const monthList = (monthRows as unknown as RevenueRow[]) || [];
  const yearList = (yearRows as unknown as RevenueRow[]) || [];

  const latest =
    range === 'month'
      ? monthList.find((r) => monthKey(r.bucket) === month)
      : yearList.find((r) => yearKey(r.bucket) === year);
  const prev =
    range === 'month'
      ? monthList.find((r) => monthKey(r.bucket) === prevMonthKey)
      : yearList.find((r) => yearKey(r.bucket) === prevYearKey);

  const trend = ((trendDesc as unknown as RevenueRow[]) || []).slice().reverse();

  const yearOptionsSet = new Set(
    ((yearOptionRows as unknown as Array<{ bucket: string }>) || []).map((r) => yearKey(r.bucket))
  );
  yearOptionsSet.add(String(new Date().getUTCFullYear()));
  yearOptionsSet.add(year);
  const availableYears = Array.from(yearOptionsSet).sort((a, b) => Number(b) - Number(a));

  return {
    trend,
    latest,
    prev,
    productMix: (productMix as unknown as ProductMixRow[]) || [],
    paymentMix: (paymentMix as unknown as PaymentMethodRow[]) || [],
    memberCount: memberCount || 0,
    availableYears,
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { range?: string; month?: string; year?: string };
}) {
  const range: RangeKey = searchParams.range === 'year' ? 'year' : 'month';

  const now = new Date();
  const defaultMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const defaultYear = String(now.getUTCFullYear());

  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(searchParams.month || '') ? (searchParams.month as string) : defaultMonth;
  const year = /^\d{4}$/.test(searchParams.year || '') ? (searchParams.year as string) : defaultYear;

  const { trend, latest, prev, productMix, paymentMix, memberCount, availableYears } = await getDashboardData(
    range,
    month,
    year
  );

  const [my, mm] = month.split('-');
  const rangeLabel = range === 'month' ? `${my}년 ${Number(mm)}월` : `${year}년`;

  // 월별↔연도별 탭 전환 시 보고 있던 구간을 최대한 이어가도록 링크를 계산
  // (연도별에서 월별로 가면 그 연도의 12월로, 월별에서 연도별로 가면 그 달의 연도로)
  const monthTabHref =
    range === 'year' ? `/dashboard?range=month&month=${year === defaultYear ? defaultMonth : `${year}-12`}` : `/dashboard?range=month&month=${month}`;
  const yearTabHref = range === 'month' ? `/dashboard?range=year&year=${my}` : `/dashboard?range=year&year=${year}`;
  const rangeTabHref: Record<RangeKey, string> = { month: monthTabHref, year: yearTabHref };

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
        actions={
          <>
            {RANGE_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={rangeTabHref[tab.value]}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  range === tab.value
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </Link>
            ))}
            {range === 'month' ? (
              <MonthPicker value={month} />
            ) : (
              <YearPicker value={year} options={availableYears} />
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={`${rangeLabel} 매출`}
          value={formatKRW(latest?.revenue || 0)}
          icon={Wallet}
          trend={revenueTrend != null ? { value: revenueTrend, label: '이전 구간 대비' } : undefined}
        />
        <StatCard
          label={`${rangeLabel} 주문`}
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
          label={`${rangeLabel} 환불`}
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
