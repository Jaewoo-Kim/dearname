import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatKRW, maskContact, maskName, PRODUCT_LABEL } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import RefundButton from '@/components/RefundButton';
import type { Member, Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!member) notFound();
  const typedMember = member as unknown as Member;

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('member_id', params.id)
    .order('created_at', { ascending: false });

  const typedOrders = (orders as unknown as Order[]) || [];

  return (
    <div className="max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">회원 상세</h1>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <div>
            <p className="text-slate-500">이름</p>
            <p className="mt-1 font-medium text-slate-900">{maskName(typedMember.name)}</p>
          </div>
          <div>
            <p className="text-slate-500">연락처</p>
            <p className="mt-1 font-medium text-slate-900">{maskContact(typedMember.contact)}</p>
          </div>
          <div>
            <p className="text-slate-500">가입 경로</p>
            <p className="mt-1 font-medium text-slate-900">{typedMember.login_provider || '-'}</p>
          </div>
          <div>
            <p className="text-slate-500">가입일</p>
            <p className="mt-1 font-medium text-slate-900">{formatDate(typedMember.created_at)}</p>
          </div>
          <div>
            <p className="text-slate-500">누적 구매</p>
            <p className="mt-1 font-medium text-slate-900">{typedMember.order_count}건</p>
          </div>
          <div>
            <p className="text-slate-500">누적 결제액</p>
            <p className="mt-1 font-medium text-slate-900">{formatKRW(typedMember.total_spent)}</p>
          </div>
          <div>
            <p className="text-slate-500">최근 주문</p>
            <p className="mt-1 font-medium text-slate-900">{formatDate(typedMember.last_order_at)}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">구매 이력</h2>
        {typedOrders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">구매 이력이 없습니다.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs text-slate-500">
              <tr>
                <th className="py-2 font-medium">주문일시</th>
                <th className="py-2 font-medium">상품</th>
                <th className="py-2 font-medium">금액</th>
                <th className="py-2 font-medium">상태</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {typedOrders.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2">
                    <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                      {formatDate(o.created_at)}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-600">{PRODUCT_LABEL[o.product] || o.product}</td>
                  <td className="py-2 font-medium text-slate-900">{formatKRW(o.amount)}</td>
                  <td className="py-2"><StatusBadge status={o.status} /></td>
                  <td className="py-2 text-right">
                    {o.status === 'paid' && <RefundButton orderId={o.id} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
