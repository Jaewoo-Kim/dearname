import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/serviceRole';
import { isAllowedEmail } from '@/lib/authz';

// 보고서 "재발급" (STEP 6) — 실제 이메일 발송 인프라가 아직 없으므로,
// 운영자가 report-view.html 링크를 복사해 고객에게 직접 전달하는 것을 전제로
// 이 호출은 감사 로그만 남긴다(누가·언제·어떤 보고서를 재발급했는지).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!isAllowedEmail(user?.email)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
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

  await db.from('audit_logs').insert({
    actor: user!.email,
    action: 'resend_report',
    target_type: 'report',
    target_id: params.id,
    detail: { babyNameKr: report.baby_name_kr, orderId: report.order_id },
  });

  return NextResponse.json({ status: 'ok' });
}
