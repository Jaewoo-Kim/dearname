import { createClient } from '@/lib/supabase/server';
import { formatKRW } from '@/lib/format';

export const dynamic = 'force-dynamic';

async function getStats() {
  const supabase = createClient();

  const [{ count: orderCount }, { count: memberCount }, { count: refundCount }, { data: paidOrders }] =
    await Promise.all([
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
      supabase.from('members').select('*', { count: 'exact', head: true }),
      supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'refunded'),
      // MVP: 결제완료 주문의 금액을 가져와 합산. 주문량이 커지면 SQL 뷰/RPC로 교체 권장.
      supabase.from('orders').select('amount').eq('status', 'paid'),
    ]);

  const totalRevenue = (paidOrders || []).reduce((sum, o) => sum + (o.amount || 0), 0);

  return {
    orderCount: orderCount || 0,
    memberCount: memberCount || 0,
    refundCount: refundCount || 0,
    totalRevenue,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: '결제완료 주문', value: `${stats.orderCount.toLocaleString('ko-KR')}건` },
    { label: '누적 매출', value: formatKRW(stats.totalRevenue) },
    { label: '회원 수', value: `${stats.memberCount.toLocaleString('ko-KR')}명` },
    { label: '환불 건수', value: `${stats.refundCount.toLocaleString('ko-KR')}건` },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">대시보드</h1>
      <p className="mt-1 text-sm text-slate-500">
        일/월/연 전환과 매출 추이 그래프는 다음 단계(Phase 2)에서 추가될 예정입니다.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
