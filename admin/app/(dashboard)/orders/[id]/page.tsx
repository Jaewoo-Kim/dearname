import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatKRW, maskContact, maskName, PRODUCT_LABEL } from '@/lib/format';
import StatusBadge from '@/components/StatusBadge';
import type { Member, Order, Report } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const { data: order } = await supabase
    .from('orders')
    .select('*, members(*)')
    .eq('id', params.id)
    .single();

  if (!order) notFound();

  const typedOrder = order as unknown as Order & { members: Member | null };

  const { data: reports } = await supabase
    .from('reports')
    .select('*')
    .eq('order_id', params.id)
    .order('created_at', { ascending: false });

  const typedReports = (reports as unknown as Report[]) || [];

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">주문 상세</h1>
        <StatusBadge status={typedOrder.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ① 회원 요약 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">회원</h2>
          {typedOrder.members ? (
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-base font-medium text-slate-900">{maskName(typedOrder.members.name)}</p>
              <p className="text-slate-500">{maskContact(typedOrder.members.contact)}</p>
              <p className="text-slate-500">가입: {formatDate(typedOrder.members.created_at)}</p>
              <p className="text-slate-500">누적 구매 {typedOrder.members.order_count}건 · {formatKRW(typedOrder.members.total_spent)}</p>
              <Link href={`/members/${typedOrder.members.id}`} className="mt-2 inline-block text-brand-700 hover:underline">
                회원 상세 보기 →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">연결된 회원 정보가 없습니다.</p>
          )}
        </section>

        {/* ② 결제·주문 정보 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-500">결제·주문</h2>
          <div className="mt-3 space-y-1 text-sm text-slate-600">
            <p>주문일시: {formatDate(typedOrder.created_at)}</p>
            <p>상품: {PRODUCT_LABEL[typedOrder.product] || typedOrder.product}</p>
            <p>금액: <span className="font-medium text-slate-900">{formatKRW(typedOrder.amount)}</span></p>
            <p>토스 주문번호: {typedOrder.toss_order_id || '-'}</p>
            {typedOrder.refunded_at && <p>환불일시: {formatDate(typedOrder.refunded_at)}</p>}
          </div>

          <button
            type="button"
            disabled
            title="환불 기능은 다음 단계(STEP 5)에서 서버 함수와 함께 지원될 예정입니다"
            className="mt-4 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-400"
          >
            환불 (다음 단계에서 지원 예정)
          </button>
        </section>
      </div>

      {/* ③ 연결 보고서 */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-500">연결 보고서</h2>
        {typedReports.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">이 주문에 연결된 보고서가 없습니다.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-50">
            {typedReports.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{r.baby_name_kr}</span>
                  <span className="ml-2 text-slate-400">{r.baby_name_hanja}</span>
                  <span className="ml-2 text-slate-500">{r.score != null ? `${r.score}점` : ''}</span>
                </div>
                <Link href={`/reports/${r.id}`} className="text-brand-700 hover:underline">
                  상세 보기 →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
