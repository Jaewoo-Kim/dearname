import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { isAllowedEmail } from '@/lib/authz';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 환불 처리 (admin_site_plan.md 3-B / STEP 5)
// 브라우저는 절대 토스 API를 직접 호출하지 않는다 — 이 Route Handler(서버)가 대신 호출한다.
export async function POST(request: Request) {
  // ① 운영자 인증 + 권한 검증 (middleware가 1차로 막지만 여기서도 재확인)
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 환불을 처리할 수 없습니다.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const orderId = typeof body.orderId === 'string' ? body.orderId : null;
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : '';

  if (!orderId) {
    return NextResponse.json({ error: 'orderId가 필요합니다.' }, { status: 400 });
  }

  const db = createServiceRoleClient();

  const { data: order, error: fetchError } = await db
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) {
    return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
  }
  if (order.status === 'refunded') {
    return NextResponse.json({ error: '이미 환불된 주문입니다.' }, { status: 409 });
  }
  if (order.status !== 'paid') {
    return NextResponse.json({ error: `상태가 '${order.status}'인 주문은 환불할 수 없습니다.` }, { status: 400 });
  }

  // ② 실결제(라이브) 여부 판단 — Phase 0 테스트 모드로 쌓인 주문(toss_payment_key 없음/'test_' 접두)은
  //    토스 API를 호출하지 않고 상태만 정리한다.
  const TOSS_SECRET = process.env.TOSS_SECRET_KEY || '';
  const isRealPayment = !!order.toss_payment_key && !order.toss_payment_key.startsWith('test_') && !!TOSS_SECRET;
  const mode: 'live' | 'test' = isRealPayment ? 'live' : 'test';

  // ③ 실제 환불(송금 취소) — 토스페이먼츠 결제취소 API
  if (isRealPayment) {
    const credentials = Buffer.from(`${TOSS_SECRET}:`).toString('base64');
    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${order.toss_payment_key}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancelReason: reason || '관리자 환불' }),
      }
    );
    const tossResult = await tossRes.json().catch(() => null);
    if (!tossRes.ok) {
      const message = (tossResult && typeof tossResult === 'object' && 'message' in tossResult)
        ? String((tossResult as { message: unknown }).message)
        : '토스페이먼츠 환불 요청이 거부되었습니다.';
      // ⑤ 실패 처리: 상태 변경 없이 사유 노출
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // ④ 멱등성: status='paid'였던 행만 CAS로 갱신 — 동시 클릭/중복 요청으로 인한 이중 환불 차단
  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await db
    .from('orders')
    .update({ status: 'refunded', refunded_at: nowIso })
    .eq('id', orderId)
    .eq('status', 'paid')
    .select()
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: '이미 처리되었거나 상태가 변경되어 환불에 실패했습니다.' }, { status: 409 });
  }

  // ⑥ 감사 로그: 누가·언제·대상·금액
  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'refund',
    target_type: 'order',
    target_id: orderId,
    detail: { amount: order.amount, reason, mode },
  });

  return NextResponse.json({ status: 'ok', mode });
}
