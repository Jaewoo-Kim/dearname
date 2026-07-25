import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { fetchRole } from '@/lib/adminUser';
import { canWrite } from '@/lib/roles';

// 보고서 "재발급" — 링크를 복사해 운영자가 직접 전달하던 기존 방식 대신, 고객이
// 로그인 상태에서 결제 없이 새 프리미엄 보고서를 1회 더 생성할 수 있는 "무료 생성권"을
// 회원에게 부여한다. 본 서비스는 /proxy/credit/check·/proxy/credit/consume로 이를 소진한다.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  if (!canWrite(await fetchRole(supabase, user!.email!))) {
    return NextResponse.json({ error: '조회 권한만 있어 생성권을 부여할 수 없습니다.' }, { status: 403 });
  }

  const db = createServiceRoleClient();

  const { data: report, error: fetchError } = await db
    .from('reports')
    .select('id, baby_name_kr, order_id')
    .eq('id', params.id)
    .single();

  if (fetchError || !report) {
    return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!report.order_id) {
    return NextResponse.json({ error: '연결된 주문이 없어 생성권을 부여할 회원을 알 수 없습니다.' }, { status: 400 });
  }

  const { data: order } = await db.from('orders').select('member_id').eq('id', report.order_id).single();
  const memberId = order?.member_id;
  if (!memberId) {
    return NextResponse.json({ error: '연결된 회원을 찾을 수 없습니다.' }, { status: 400 });
  }

  const { data: member, error: memberFetchError } = await db
    .from('members')
    .select('id, bonus_credits')
    .eq('id', memberId)
    .single();

  if (memberFetchError || !member) {
    return NextResponse.json({ error: '회원 정보를 불러오지 못했습니다.' }, { status: 404 });
  }

  const nextCredits = (member.bonus_credits || 0) + 1;
  const { error: updateError } = await db
    .from('members')
    .update({ bonus_credits: nextCredits })
    .eq('id', memberId);

  if (updateError) {
    return NextResponse.json({ error: `생성권 부여 실패: ${updateError.message}` }, { status: 500 });
  }

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'grant_report_credit',
    target_type: 'report',
    target_id: params.id,
    detail: { babyNameKr: report.baby_name_kr, memberId, newCredits: nextCredits },
  });

  return NextResponse.json({ status: 'ok', credits: nextCredits });
}
