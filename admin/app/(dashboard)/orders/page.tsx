import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatKRW, maskName, PRODUCT_LABEL } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import type { Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;
const STATUS_TABS = [
  { value: '', label: '전체' },
  { value: 'paid', label: '결제완료' },
  { value: 'refunded', label: '환불' },
  { value: 'failed', label: '실패' },
];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const supabase = createClient();
  const status = searchParams.status || '';
  const page = Math.max(parseInt(searchParams.page || '1', 10), 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = supabase
    .from('orders')
    .select('*, members(name, contact)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (status) query = query.eq('status', status);

  const { data, count, error } = await query;
  const orders = (data as unknown as Order[]) || [];
  const totalPages = Math.max(Math.ceil((count || 0) / PAGE_SIZE), 1);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">주문·결제</h1>

      <div className="mt-4 flex gap-2">
        {STATUS_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/orders?status=${tab.value}` : '/orders'}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              status === tab.value
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">주문일시</th>
              <th className="px-4 py-3 font-medium">회원</th>
              <th className="px-4 py-3 font-medium">상품</th>
              <th className="px-4 py-3 font-medium">금액</th>
              <th className="px-4 py-3 font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-red-600">주문 목록을 불러오지 못했습니다: {error.message}</td></tr>
            )}
            {!error && orders.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">주문 내역이 없습니다.</td></tr>
            )}
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                    {formatDate(o.created_at)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{maskName(o.members?.name)}</td>
                <td className="px-4 py-3 text-slate-600">{PRODUCT_LABEL[o.product] || o.product}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{formatKRW(o.amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
        <span>총 {(count || 0).toLocaleString('ko-KR')}건</span>
        <div className="flex gap-2">
          {page > 1 && (
            <Link className="hover:underline" href={`/orders?status=${status}&page=${page - 1}`}>이전</Link>
          )}
          <span>{page} / {totalPages}</span>
          {page < totalPages && (
            <Link className="hover:underline" href={`/orders?status=${status}&page=${page + 1}`}>다음</Link>
          )}
        </div>
      </div>
    </div>
  );
}
