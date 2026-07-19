import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatKRW, getPeriodStartUTC, maskName, PRODUCT_LABEL } from '@/lib/format';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'paid', label: '결제완료' },
  { value: 'refunded', label: '환불' },
  { value: 'failed', label: '실패' },
];
const PERIOD_OPTIONS = [
  { value: '', label: '전체 기간' },
  { value: 'today', label: '오늘' },
  { value: 'week', label: '이번주' },
  { value: 'month', label: '이번달' },
  { value: 'year', label: '올해' },
];

function buildHref(base: Record<string, string>, overrides: Record<string, string>) {
  const params = new URLSearchParams({ ...base, ...overrides });
  for (const [k, v] of Array.from(params.entries())) {
    if (!v) params.delete(k);
  }
  const qs = params.toString();
  return qs ? `/orders?${qs}` : '/orders';
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; period?: string; page?: string };
}) {
  const supabase = createClient();
  const status = searchParams.status || '';
  const period = searchParams.period || '';
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('orders')
    .select('*, members(name, contact)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);
  const periodStart = getPeriodStartUTC(period);
  if (periodStart) query = query.gte('created_at', periodStart.toISOString());

  const { data, count, error } = await query;
  const orders = (data as unknown as Order[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);
  const baseParams = { status, period };

  return (
    <div>
      <PageHeader
        title="주문·결제"
        actions={STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={buildHref(baseParams, { status: tab.value, page: '' })}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-brand-600 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={buildHref(baseParams, { period: opt.value, page: '' })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              period === opt.value
                ? 'bg-slate-800 text-white'
                : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-600">
            주문 목록을 불러오지 못했습니다: {error.message}
          </p>
        ) : orders.length === 0 ? (
          <EmptyState title="주문 내역이 없습니다" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">주문일시</th>
                <th className="px-4 py-3 font-medium">회원</th>
                <th className="px-4 py-3 font-medium">상품</th>
                <th className="px-4 py-3 font-medium">금액</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                      {formatDate(o.created_at)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{maskName(o.members?.name)}</td>
                  <td className="px-4 py-3 text-slate-600">{PRODUCT_LABEL[o.product] || o.product}</td>
                  <td className="px-4 py-3 font-medium tabular-nums text-slate-900">{formatKRW(o.amount)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/orders/${o.id}`}>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>총 {(count || 0).toLocaleString('ko-KR')}건</span>
        <div className="flex gap-3">
          {page > 1 && (
            <Link className="hover:underline" href={buildHref(baseParams, { page: String(page - 1) })}>이전</Link>
          )}
          <span>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="hover:underline" href={buildHref(baseParams, { page: String(page + 1) })}>다음</Link>
          )}
        </div>
      </div>
    </div>
  );
}
