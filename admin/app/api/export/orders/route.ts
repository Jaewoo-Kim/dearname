import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { applyOrdersSearch } from '@/lib/queries/orders';
import { buildCsv } from '@/lib/csv';
import { formatDate, maskContact, maskName, PRODUCT_LABEL, STATUS_LABEL } from '@/lib/format';
import type { Order } from '@/lib/types';

// 주문·결제 목록 화면과 동일한 기간·상태·검색 필터를 적용한 CSV 내보내기.
// 화면에 이미 보이는 데이터를 그대로 파일로 받는 것뿐이라 조회 권한(뷰어 포함)만 있으면 된다.
// 개인정보는 화면과 동일하게 마스킹해 내보낸다.
const MAX_ROWS = 10000;

export async function GET(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || '';
  const period = searchParams.get('period') || '';
  const q = searchParams.get('q') || '';

  let query = supabase
    .from('orders')
    .select('*, members(name, contact)')
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS);

  query = await applyOrdersSearch(supabase, query, { status, period, q });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: `내보내기 실패: ${error.message}` }, { status: 500 });
  }

  const orders = (data as unknown as Order[]) || [];
  const headers = ['주문일시', '회원 이름', '연락처', '상품', '금액', '상태', '결제수단', '토스 주문번호', '환불일시'];
  const rows = orders.map((o) => [
    formatDate(o.created_at),
    maskName(o.members?.name),
    maskContact(o.members?.contact),
    PRODUCT_LABEL[o.product] || o.product,
    o.amount,
    STATUS_LABEL[o.status] || o.status,
    o.payment_method || '',
    o.toss_order_id || '',
    o.refunded_at ? formatDate(o.refunded_at) : '',
  ]);

  const csv = buildCsv(headers, rows);
  const filename = `orders_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
