import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchRole } from '@/lib/adminUser';
import { formatDate, formatKRW, maskContact, maskName, PRODUCT_LABEL } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import RefundButton from '@/components/RefundButton';
import SuspendButton from '@/components/SuspendButton';
import BackLink from '@/components/BackLink';
import EmptyState from '@/components/EmptyState';
import type { Member, Order } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MemberDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isViewer = (await fetchRole(supabase, user?.email || '')) === 'viewer';

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

  const isWithdrawn = !!typedMember.withdrawn_at;
  const isSuspended = !!typedMember.suspended_at;

  const FIELDS: Array<[string, string]> = [
    ['이름', isWithdrawn ? '(삭제됨)' : maskName(typedMember.name)],
    ['연락처', isWithdrawn ? '(삭제됨)' : maskContact(typedMember.contact)],
    ['가입 경로', typedMember.login_provider || '-'],
    ['가입일', formatDate(typedMember.created_at)],
    ['누적 구매', `${typedMember.order_count}건`],
    ['누적 결제액', formatKRW(typedMember.total_spent)],
    ['최근 주문', formatDate(typedMember.last_order_at)],
  ];

  return (
    <div className="max-w-4xl">
      <BackLink href="/members" label="회원 목록으로" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">회원 상세</h1>
        {!isWithdrawn && (
          <SuspendButton
            memberId={params.id}
            suspended={isSuspended}
            disabled={isViewer}
            disabledReason={isViewer ? '조회 권한만 있어 이용제한을 처리할 수 없습니다' : undefined}
          />
        )}
      </div>

      {isWithdrawn && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <b className="text-slate-800">탈퇴한 회원입니다</b> ({formatDate(typedMember.withdrawn_at)} 탈퇴)<br />
          이름·연락처 등 회원을 식별할 수 있는 정보는 삭제되었습니다. 아래 주문 기록은
          전자상거래법상 보존의무에 따라 남아 있으며, 환불 등 처리는 그대로 가능합니다.
        </div>
      )}

      {isSuspended && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <b>이용이 제한된 회원입니다</b> ({formatDate(typedMember.suspended_at)} 제한, {typedMember.suspended_by} 처리)<br />
          사유: {typedMember.suspended_reason || '(사유 미기재)'}
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          {FIELDS.map(([label, value]) => (
            <div key={label}>
              <p className="text-slate-500">{label}</p>
              <p className="mt-1 font-medium tabular-nums text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-500">구매 이력</h2>
        {typedOrders.length === 0 ? (
          <EmptyState title="구매 이력이 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="whitespace-nowrap py-2 font-medium">주문일시</th>
                  <th className="whitespace-nowrap py-2 font-medium">상품</th>
                  <th className="whitespace-nowrap py-2 font-medium">금액</th>
                  <th className="whitespace-nowrap py-2 font-medium">상태</th>
                  <th className="py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {typedOrders.map((o) => (
                  <tr key={o.id} className="border-b border-slate-50 last:border-0">
                    <td className="whitespace-nowrap py-2">
                      <Link href={`/orders/${o.id}`} className="text-brand-700 hover:underline">
                        {formatDate(o.created_at)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap py-2 text-slate-600">{PRODUCT_LABEL[o.product] || o.product}</td>
                    <td className="whitespace-nowrap py-2 font-medium tabular-nums text-slate-900">{formatKRW(o.amount)}</td>
                    <td className="whitespace-nowrap py-2"><StatusBadge status={o.status} /></td>
                    <td className="whitespace-nowrap py-2 text-right">
                      {o.status === 'paid' && (
                        <RefundButton
                          orderId={o.id}
                          disabled={isViewer}
                          disabledReason={isViewer ? '조회 권한만 있어 환불할 수 없습니다' : undefined}
                        />
                      )}
                    </td>
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
